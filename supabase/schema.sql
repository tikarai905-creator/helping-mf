-- HELP APP — DATABASE SCHEMA
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query → paste → Run).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS guards.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type post_kind as enum ('free', 'trade', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reply_status as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type confirm_status as enum ('good', 'didnt_happen', 'bad');
exception when duplicate_object then null; end $$;

do $$ begin
  create type flag_target_type as enum ('post', 'user');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- users: one row per authenticated person, mirrors auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  profile_photo_url text,
  rough_area text not null,
  age integer not null,
  is_admin boolean not null default false, -- owner/admin flag; only the app owner should have this set (via SQL editor)
  created_at timestamptz not null default now()
);

-- posts: the one post box. author_id is NULL for seed/example posts (no real person behind them).
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users(id) on delete cascade,
  body text not null,
  rough_area text not null,
  kind post_kind not null default 'free',
  status post_status not null default 'open',
  is_seed boolean not null default false,
  category text, -- filled later by the categorization AI helper; null until then
  created_at timestamptz not null default now()
);

-- One optional photo per post — the feed card redesign's photo block reads
-- this when present. No upload UI ships in this pass (out of scope: this
-- pass is the feed's visual system, not a storage/upload feature); the
-- column exists so the card system can actually hold an image post, and one
-- seed post below is given a placeholder to judge that layout against.
-- Added here (right after the table it belongs to) rather than down by the
-- other later-added columns like ai_scanned, because SEED CONTENT below —
-- which is earlier in the file than that section — writes to it; it has to
-- exist before the first thing that reads or writes it, top to bottom.
alter table public.posts add column if not exists image_url text;

-- replies: a raised hand on a post
create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  replier_id uuid not null references public.users(id) on delete cascade,
  status reply_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (post_id, replier_id) -- one hand raised per person per post
);

-- connections: the web. one row per accepted reply.
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reply_id uuid references public.replies(id) on delete set null,
  helper_id uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  first_connected_at timestamptz not null default now(),
  is_repeat boolean not null default false,
  confirmed_status confirm_status,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- flags: reports, owner-reviewed only, never auto-acted
create table if not exists public.flags (
  id uuid primary key default gen_random_uuid(),
  flagger_id uuid not null references public.users(id) on delete cascade,
  target_type flag_target_type not null,
  target_id uuid not null,
  reason text,
  ai_category text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

-- messages: private in-app chat, only for an accepted pair. Never read/analyzed by AI or the system.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_status_area_idx on public.posts (status, rough_area, created_at desc);
create index if not exists replies_post_idx on public.replies (post_id);
create index if not exists replies_replier_idx on public.replies (replier_id);
create index if not exists connections_helper_idx on public.connections (helper_id);
create index if not exists connections_receiver_idx on public.connections (receiver_id);
create index if not exists messages_connection_idx on public.messages (connection_id, created_at);
create index if not exists flags_target_idx on public.flags (target_type, target_id);

-- ============================================================================
-- NEW USER TRIGGER — creates the public.users profile row right after signup.
-- Reads display_name / rough_area / age out of the auth signup's user_metadata.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, rough_area, age)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', 'Neighbor'),
    coalesce(new.raw_user_meta_data->>'rough_area', 'Unknown area'),
    coalesce((new.raw_user_meta_data->>'age')::integer, 18)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ENGINE — THE THREE NUMBERS
-- This is the ONE place the scoring formula lives. Tune the constants below
-- to change how score reacts to good/bad confirms. Nothing else in the app
-- computes score — everything calls this function.
-- ============================================================================
create or replace function public.get_public_stats(target_user_id uuid)
returns table (helped_count integer, score numeric, got_helped_count integer)
language plpgsql
security definer set search_path = public
as $$
declare
  -- === TUNABLE DIAL — adjust these to change how score behaves ===
  good_nudge        numeric := 1.0;   -- how much a single confirmed 'good' moves score
  bad_threshold      int    := 3;     -- 'bad' confirms below this count in recent history are ignored as noise
  bad_pull           numeric := 2.0;  -- how much each 'bad' pulls score down once threshold is met
  fallback_good_mult numeric := 0.5;  -- soft-fallback quiet 'good' counts for this fraction of a real 'good'
  neutral_score      numeric := 50.0; -- starting/floor-ish neutral score
  recent_window      int    := 200;   -- how many of the user's most recent confirms count toward score
begin
  return query
  with helper_confirms as (
    select c.confirmed_status, c.is_repeat, c.confirmed_at
    from public.connections c
    where c.helper_id = target_user_id
      and c.confirmed_status is not null
    order by c.confirmed_at desc nulls last
    limit recent_window
  ),
  bad_count as (
    select count(*) as n from helper_confirms where confirmed_status = 'bad'
  ),
  good_weight as (
    -- real 'good' confirms count full weight; soft-fallback goods (didnt_happen never counts, only good/bad are ever set,
    -- fallback settling writes 'good' too — see settle_fallback_confirms — distinguished nowhere else, so it's counted as
    -- a full good here; the fallback multiplier is applied at settle time to the record itself, not recomputed here)
    select coalesce(sum(good_nudge), 0) as total
    from helper_confirms where confirmed_status = 'good'
  ),
  bad_weight as (
    select case when (select n from bad_count) >= bad_threshold
      then (select n from bad_count) * bad_pull
      else 0
    end as total
  )
  select
    (select count(distinct c.receiver_id)::integer
       from public.connections c
      where c.helper_id = target_user_id and c.is_repeat = false) as helped_count,
    (neutral_score + (select total from good_weight) - (select total from bad_weight)) as score,
    (select count(*)::integer
       from public.connections c
      where c.receiver_id = target_user_id and c.confirmed_status is not null) as got_helped_count;
end;
$$;

grant execute on function public.get_public_stats(uuid) to authenticated;

-- ============================================================================
-- ACCEPT / DECLINE — atomic RPCs so is_repeat + connection creation can't race.
-- ============================================================================
create or replace function public.accept_reply(target_reply_id uuid)
returns public.connections
language plpgsql
security definer set search_path = public
as $$
declare
  v_reply public.replies;
  v_post public.posts;
  v_is_repeat boolean;
  v_connection public.connections;
begin
  select * into v_reply from public.replies where id = target_reply_id for update;
  if v_reply is null then
    raise exception 'reply not found';
  end if;

  select * into v_post from public.posts where id = v_reply.post_id;
  if v_post.author_id <> auth.uid() then
    raise exception 'only the poster can accept a reply';
  end if;
  if v_reply.status <> 'pending' then
    raise exception 'reply is not pending';
  end if;

  select exists (
    select 1 from public.connections
    where helper_id = v_reply.replier_id and receiver_id = v_post.author_id
  ) into v_is_repeat;

  update public.replies set status = 'accepted' where id = target_reply_id;

  insert into public.connections (post_id, reply_id, helper_id, receiver_id, is_repeat)
  values (v_post.id, v_reply.id, v_reply.replier_id, v_post.author_id, v_is_repeat)
  returning * into v_connection;

  return v_connection;
end;
$$;

grant execute on function public.accept_reply(uuid) to authenticated;

create or replace function public.decline_reply(target_reply_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_reply public.replies;
  v_post public.posts;
begin
  select * into v_reply from public.replies where id = target_reply_id for update;
  if v_reply is null then
    raise exception 'reply not found';
  end if;
  select * into v_post from public.posts where id = v_reply.post_id;
  if v_post.author_id <> auth.uid() then
    raise exception 'only the poster can decline a reply';
  end if;
  if v_reply.status <> 'pending' then
    raise exception 'reply is not pending';
  end if;
  update public.replies set status = 'declined' where id = target_reply_id;
end;
$$;

grant execute on function public.decline_reply(uuid) to authenticated;

-- ============================================================================
-- CONFIRM — receiver taps good / didn't happen / bad on a connection.
-- ============================================================================
create or replace function public.confirm_connection(target_connection_id uuid, result confirm_status)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_connection public.connections;
begin
  select * into v_connection from public.connections where id = target_connection_id for update;
  if v_connection is null then
    raise exception 'connection not found';
  end if;
  if v_connection.receiver_id <> auth.uid() then
    raise exception 'only the receiver can confirm this connection';
  end if;
  if v_connection.confirmed_status is not null then
    raise exception 'already confirmed';
  end if;
  update public.connections
    set confirmed_status = result, confirmed_at = now()
    where id = target_connection_id;
end;
$$;

grant execute on function public.confirm_connection(uuid, confirm_status) to authenticated;

-- Soft fallback: connections left unconfirmed past the window settle as a quiet 'good'.
-- FALLBACK_WINDOW_DAYS is the one config value mentioned in the spec — change it here.
create or replace function public.settle_fallback_confirms()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  fallback_window_days constant int := 7; -- <- the one config value for the soft-fallback window
  v_count integer;
begin
  update public.connections
    set confirmed_status = 'good', confirmed_at = now()
    where confirmed_status is null
      and first_connected_at < now() - (fallback_window_days || ' days')::interval;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.settle_fallback_confirms() to authenticated;

-- Lets a replier's insert-policy check "is this post open, and not mine"
-- without needing SELECT access to other people's post rows (RLS on posts
-- only lets you select your own — see below). security definer bypasses
-- that just for this narrow yes/no check.
create or replace function public.post_is_open_and_not_mine(p_post_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.posts
    where id = p_post_id and status = 'open' and author_id <> auth.uid()
  );
$$;

grant execute on function public.post_is_open_and_not_mine(uuid) to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users enable row level security;
alter table public.posts enable row level security;
alter table public.replies enable row level security;
alter table public.connections enable row level security;
alter table public.flags enable row level security;
alter table public.messages enable row level security;

-- ---- users --------------------------------------------------------------
-- Identity is off in the crowd, on in the accepted pair (or when you posted
-- and someone raised a hand on it — the poster can always see repliers).
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (id = auth.uid());

-- A replier's or connected peer's FULL row (email, age) used to be visible
-- through row-level policies here — RLS gates which ROWS are readable, not
-- which columns, so anyone hitting the REST API directly with those two IDs
-- could pull email/age off someone they'd only raised a hand near. Route
-- that access through a column-limited view instead — the same trick
-- posts_feed uses to hide author_id: the view runs as its owner (bypassing
-- base-table RLS) but its own WHERE clause reproduces the row-visibility
-- rule below, and its column list simply never includes email or age.
drop policy if exists users_select_repliers_on_my_posts on public.users;
drop policy if exists users_select_connected_pair on public.users;

drop view if exists public.users_public;
create view public.users_public as
  select u.id, u.display_name, u.profile_photo_url, u.rough_area
  from public.users u
  where
    exists (
      select 1 from public.replies r
      join public.posts p on p.id = r.post_id
      where r.replier_id = u.id and p.author_id = auth.uid()
    )
    or exists (
      select 1 from public.connections c
      where (c.helper_id = auth.uid() and c.receiver_id = u.id)
         or (c.receiver_id = auth.uid() and c.helper_id = u.id)
    );

grant select on public.users_public to authenticated;

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid());

-- ---- posts ----------------------------------------------------------------
-- author_id is NEVER selectable by anyone but the post's own author — that's
-- an RLS guarantee, not just an app convention, so it holds even against a
-- client hitting the API directly. Selecting the base table only ever
-- returns your own posts (any status). Everyone else reads through the
-- posts_feed view below, which doesn't expose the column at all.
drop policy if exists posts_select_open_or_own on public.posts;
drop policy if exists posts_select_own_only on public.posts;
create policy posts_select_own_only on public.posts
  for select using (author_id = auth.uid());

-- Without this, posts_feed (open posts only) is the only way anyone but the
-- author reads a post — so the moment a post closes, anyone who raised a
-- hand or got accepted on it hits a 404 trying to get back to it, even
-- though their chat link lives on that page. This lets someone with a reply
-- or connection on the post keep reading it (still never author_id) no
-- matter its status.
--
-- The involvement check has to live in a security-definer function, not an
-- inline EXISTS against replies/connections: replies_select_own_or_posters
-- (below) itself queries posts to see if you're the post's author, so an
-- inline check here would re-trigger posts RLS from inside replies RLS from
-- inside posts RLS — Postgres error 42P17, infinite recursion. A
-- security-definer function's internal queries bypass RLS instead of
-- re-entering it, breaking the cycle (same reason accept_reply,
-- mark_post_ai_clean etc. below are all security definer).
create or replace function public.post_has_viewer_involvement(target_post_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.replies r where r.post_id = target_post_id and r.replier_id = auth.uid()
  )
  or exists (
    select 1 from public.connections c
    where c.post_id = target_post_id
      and (c.helper_id = auth.uid() or c.receiver_id = auth.uid())
  );
$$;

grant execute on function public.post_has_viewer_involvement(uuid) to authenticated;

drop policy if exists posts_select_involved on public.posts;
create policy posts_select_involved on public.posts
  for select using (public.post_has_viewer_involvement(id));

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert with check (author_id = auth.uid());

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
  for update using (author_id = auth.uid());

-- Same gap as admin_messages above: the row policy doesn't stop an owner
-- from PATCHing ai_scanned/category/is_seed/author_id on their own row via
-- the REST API directly. Column-restrict what "own post" updates can touch.
-- mark_post_ai_clean / record_ai_moderation are security definer and run as
-- the function owner, so they're unaffected — this only blocks direct
-- client-side updates, not the moderation RPCs.
-- kind/rough_area added so the poster can edit their own post (My posts on
-- the profile page) — still never ai_scanned/category/is_seed/author_id.
-- image_url included too, even with no upload UI yet, so a later photo
-- feature doesn't need its own grant migration.
revoke update on public.posts from authenticated;
grant update (body, status, kind, rough_area, image_url) on public.posts to authenticated;

-- Poster can delete their own post outright (My posts on the profile page),
-- same as the existing admin-only delete used for moderation. Cascades to
-- replies/connections/messages tied to it (see the "on delete cascade" FKs
-- on those tables) — the same consequence deletePostAdmin already has.
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts
  for delete using (author_id = auth.uid());

-- Public feed view — safe columns only, open posts only. Views default to
-- running as their owner (not the querying user) in Postgres, so this
-- bypasses the "own posts only" RLS above by design: it can't leak author_id
-- because the column was never in its select list to begin with.
-- (Full definition, including ai_scanned, is created further below — once
-- that column exists — using drop-then-create so re-running this file never
-- hits Postgres's "cannot change name of view column" restriction on
-- CREATE OR REPLACE VIEW.)

-- ---- replies ----------------------------------------------------------------
drop policy if exists replies_select_own_or_posters on public.replies;
create policy replies_select_own_or_posters on public.replies
  for select using (
    replier_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

drop policy if exists replies_insert_own on public.replies;
create policy replies_insert_own on public.replies
  for insert with check (
    replier_id = auth.uid()
    and public.post_is_open_and_not_mine(post_id)
  );

-- status changes (accept/decline) go through the RPCs above (security definer),
-- so no direct update policy is granted here — the poster can't hand-edit status.

-- ---- connections ----------------------------------------------------------------
-- created only via accept_reply(); confirmed only via confirm_connection().
drop policy if exists connections_select_pair on public.connections;
create policy connections_select_pair on public.connections
  for select using (helper_id = auth.uid() or receiver_id = auth.uid());

-- ---- flags ----------------------------------------------------------------
-- Owner/admin only. Anyone can file one; only admins can read the pile.
drop policy if exists flags_insert_own on public.flags;
create policy flags_insert_own on public.flags
  for insert with check (flagger_id = auth.uid());

drop policy if exists flags_select_admin_only on public.flags;
create policy flags_select_admin_only on public.flags
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
  );

drop policy if exists flags_update_admin_only on public.flags;
create policy flags_update_admin_only on public.flags
  for update using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
  );

-- ---- messages ----------------------------------------------------------------
-- Private chat. Only the two people on the connection can read or write it.
-- Never selected, exported, or piped to AI anywhere in the app.
drop policy if exists messages_select_pair on public.messages;
create policy messages_select_pair on public.messages
  for select using (
    exists (
      select 1 from public.connections c
      where c.id = connection_id and (c.helper_id = auth.uid() or c.receiver_id = auth.uid())
    )
  );

drop policy if exists messages_insert_pair on public.messages;
create policy messages_insert_pair on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.connections c
      where c.id = connection_id and (c.helper_id = auth.uid() or c.receiver_id = auth.uid())
    )
  );

-- ============================================================================
-- SEED CONTENT — THE EMPTY ROOM
-- Labeled example posts so day-one feed isn't blank. author_id is NULL on
-- purpose: there is no real person behind these, so nobody can raise a hand
-- on them (the app disables replying for is_seed posts as a second guard).
-- ============================================================================
insert into public.posts (body, rough_area, kind, status, is_seed)
select * from (values
  ('John needs a hand moving a couch up two flights of stairs this weekend.', 'Downtown', 'free'::post_kind, 'open'::post_status, true),
  ('Maria would like someone to talk to over coffee — just company, no agenda.', 'Riverside', 'free'::post_kind, 'open'::post_status, true),
  ('Looking for someone to help trim an overgrown hedge in exchange for fresh vegetables.', 'Maple Heights', 'trade'::post_kind, 'open'::post_status, true),
  ('Need a ride to a medical appointment next Tuesday morning, can pay for gas.', 'Old Town', 'paid'::post_kind, 'open'::post_status, true),
  ('Anyone free to help set up a new laptop for an elderly neighbor?', 'Westfield', 'free'::post_kind, 'open'::post_status, true)
) as seed(body, rough_area, kind, status, is_seed)
where not exists (select 1 from public.posts where is_seed = true);

-- Backfill categories on the seed posts above — matched by body text since
-- it's the only stable natural key here. Runs every time this file is
-- re-run (not just on first insert) so it also catches seed rows that
-- already existed in the database before this category column was used.
update public.posts set category = 'moving' where is_seed = true and body like 'John needs a hand moving a couch%';
update public.posts set category = 'talk' where is_seed = true and body like 'Maria would like someone to talk to%';
update public.posts set category = 'yard' where is_seed = true and body like 'Looking for someone to help trim%';
update public.posts set category = 'ride' where is_seed = true and body like 'Need a ride to a medical appointment%';
update public.posts set category = 'repair' where is_seed = true and body like 'Anyone free to help set up a new laptop%';

-- A few more varied example posts — the feed card redesign needs realistic
-- variety (a borrow, a giveaway, a photo post) to judge against, not five
-- similar-shaped requests. Guarded per-row (unlike the block above, which
-- only ever fires once for the whole set) so these insert even on a
-- database that already has the original five.
insert into public.posts (body, rough_area, kind, status, is_seed, category)
select 'Could I borrow a ladder for the weekend? I will return it clean and in one piece by Monday.', 'Fairview', 'free'::post_kind, 'open'::post_status, true, 'repair'
where not exists (select 1 from public.posts where body like 'Could I borrow a ladder%');

insert into public.posts (body, rough_area, kind, status, is_seed, category)
select 'Giving away a kids bike, barely used — first come, first served.', 'Elmwood', 'free'::post_kind, 'open'::post_status, true, 'other'
where not exists (select 1 from public.posts where body like 'Giving away a kids bike%');

insert into public.posts (body, rough_area, kind, status, is_seed, category, image_url)
select 'Extra tomatoes and zucchini from my garden — more than I can use, come grab some before they go bad.', 'Riverside', 'free'::post_kind, 'open'::post_status, true, 'yard', '/seed-garden-photo.svg'
where not exists (select 1 from public.posts where body like 'Extra tomatoes and zucchini%');

-- Enable realtime for chat (safe no-op if already added)
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- AI MODERATION QUEUE — owner-only, never-auto-act.
-- An AI scan reads PUBLIC POST TEXT ONLY (never the private chat), tags it
-- (offensive / spam / none), and — when flagged — pre-writes a warning
-- message. Nothing sends and nothing deletes on its own; the owner presses
-- Send or Skip on each item, or deletes the post themselves.
-- ============================================================================

-- Flags gained an AI-origin shape: source distinguishes a human report from
-- an AI scan hit; draft_message is the AI-authored warning waiting for the
-- owner to send or skip; resolution records what the owner actually did.
alter table public.flags add column if not exists source text not null default 'user';
do $$ begin
  alter table public.flags add constraint flags_source_check check (source in ('user', 'ai'));
exception when duplicate_object then null; end $$;

alter table public.flags add column if not exists draft_message text;
alter table public.flags add column if not exists resolution text;

-- drop-then-add (not the duplicate_object guard used elsewhere): a re-run
-- must be able to WIDEN this constraint's allowed values (see 'duplicate'
-- below), and a guard that only catches "already exists" would leave an
-- older, narrower constraint in place on an existing database.
alter table public.flags drop constraint if exists flags_resolution_check;
alter table public.flags add constraint flags_resolution_check
  check (resolution in ('warned', 'skipped', 'post_deleted', 'duplicate'));

-- AI-sourced flags have no human flagger.
alter table public.flags alter column flagger_id drop not null;

-- Posts track whether the moderation scan has already looked at them, so a
-- clean post isn't re-scanned forever and a flagged one isn't scanned twice.
alter table public.posts add column if not exists ai_scanned boolean not null default false;

-- ---- moderation queue de-duplication ---------------------------------------
-- Before this, re-scanning could leave more than one open AI flag on the
-- same post, and the queue showed it more than once no matter how it was
-- queried. A partial unique index makes that impossible at the source.
--
-- One-time cleanup first: collapse any duplicate pending AI flags already
-- sitting in the table down to the single most recent per post — kept as
-- history, marked resolution='duplicate', not deleted — so the index below
-- can actually be created on a database that already has duplicates in it.
with ranked as (
  select id, target_id,
         row_number() over (partition by target_id order by created_at desc) as rn
  from public.flags
  where source = 'ai' and resolution is null
)
update public.flags f
set resolution = 'duplicate', reviewed = true
from ranked r
where f.id = r.id and r.rn > 1;

drop index if exists flags_one_pending_ai_flag_per_post;
create unique index flags_one_pending_ai_flag_per_post
  on public.flags (target_id)
  where source = 'ai' and resolution is null;

-- Create (or safely re-create) the feed view now that ai_scanned exists.
-- drop-then-create instead of CREATE OR REPLACE VIEW: Postgres only allows
-- REPLACE to append trailing columns, not insert/reorder/rename any —
-- dropping first makes this file re-runnable no matter how the column list
-- changes in the future. Nothing else in the schema depends on this view.
drop view if exists public.posts_feed;
create view public.posts_feed as
  select id, body, rough_area, kind, status, is_seed, category, ai_scanned, image_url, created_at
  from public.posts
  where status = 'open';

grant select on public.posts_feed to authenticated;

-- admin_messages: the owner's direct line to any user. One-directional
-- (owner -> user), separate from the private peer-to-peer chat in `messages`
-- so it never touches the web/scoring engine or the never-read-chat rule.
create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  related_flag_id uuid references public.flags(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists admin_messages_recipient_idx on public.admin_messages (recipient_id, created_at desc);

-- Lets a recipient clear a resolved warning from their own "Messages from
-- the app owner" list without deleting the row — the admin's record (and
-- the admin's own thread view) still shows everything that was ever sent.
alter table public.admin_messages add column if not exists dismissed_at timestamptz;

alter table public.admin_messages enable row level security;

-- One helper, reused by every admin-only policy below. security definer so
-- checking "am I admin" never itself gets tangled in the RLS it's guarding.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- ---- posts: admin can read and delete any post (moderation) --------------
drop policy if exists posts_select_admin_all on public.posts;
create policy posts_select_admin_all on public.posts
  for select using (public.is_admin());

drop policy if exists posts_delete_admin_only on public.posts;
create policy posts_delete_admin_only on public.posts
  for delete using (public.is_admin());

-- ---- users: admin can read any profile (to message/warn a user) ----------
drop policy if exists users_select_admin_all on public.users;
create policy users_select_admin_all on public.users
  for select using (public.is_admin());

-- ---- flags: replace the inline admin checks with the shared helper -------
drop policy if exists flags_select_admin_only on public.flags;
create policy flags_select_admin_only on public.flags
  for select using (public.is_admin());

drop policy if exists flags_update_admin_only on public.flags;
create policy flags_update_admin_only on public.flags
  for update using (public.is_admin());

-- ---- admin_messages --------------------------------------------------------
drop policy if exists admin_messages_select_pair on public.admin_messages;
create policy admin_messages_select_pair on public.admin_messages
  for select using (recipient_id = auth.uid() or public.is_admin());

drop policy if exists admin_messages_insert_admin_only on public.admin_messages;
create policy admin_messages_insert_admin_only on public.admin_messages
  for insert with check (admin_id = auth.uid() and public.is_admin());

-- Recipient can mark their own messages read, and now dismiss (hide from
-- their own list, see dismissed_at above) — nothing else is app-exposed for
-- update. The row policy alone only gates WHICH ROW a recipient can touch —
-- without a column-level grant they could still PATCH body/admin_id/
-- related_flag_id on a warning sent to them. Column privileges are the
-- actual restriction; RLS just decides which row that restricted UPDATE is
-- allowed to hit.
drop policy if exists admin_messages_update_recipient on public.admin_messages;
create policy admin_messages_update_recipient on public.admin_messages
  for update using (recipient_id = auth.uid());

revoke update on public.admin_messages from authenticated;
grant update (read_at, dismissed_at) on public.admin_messages to authenticated;

-- ---- moderation-result RPCs -----------------------------------------------
-- Callable by the post's own author (the scan-on-post-creation path) or an
-- admin (manual backfill scan). Bypasses the normal "only your own post"
-- read via security definer, but only ever acts on the one target_post_id
-- passed in — it can't be used to touch anyone else's post.
create or replace function public.mark_post_ai_clean(target_post_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_post public.posts;
begin
  select * into v_post from public.posts where id = target_post_id;
  if v_post is null then
    raise exception 'post not found';
  end if;
  if not (public.is_admin() or v_post.author_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.posts set ai_scanned = true where id = target_post_id;
end;
$$;

grant execute on function public.mark_post_ai_clean(uuid) to authenticated;

create or replace function public.record_ai_moderation(
  target_post_id uuid,
  result_category text,
  result_draft_message text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_post public.posts;
begin
  select * into v_post from public.posts where id = target_post_id;
  if v_post is null then
    raise exception 'post not found';
  end if;
  if not (public.is_admin() or v_post.author_id = auth.uid()) then
    raise exception 'not authorized to record moderation for this post';
  end if;
  if result_category not in ('offensive', 'spam') then
    raise exception 'invalid category';
  end if;

  update public.posts set ai_scanned = true where id = target_post_id;

  -- ON CONFLICT targets the partial unique index above: a post can only
  -- ever have one *pending* AI flag, so a re-scan refreshes it in place
  -- instead of adding a sibling the queue would show twice.
  insert into public.flags (flagger_id, target_type, target_id, ai_category, source, draft_message, reviewed)
  values (null, 'post', target_post_id, result_category, 'ai', result_draft_message, false)
  on conflict (target_id) where (source = 'ai' and resolution is null)
  do update set
    ai_category = excluded.ai_category,
    draft_message = excluded.draft_message,
    reviewed = false,
    created_at = now();
end;
$$;

grant execute on function public.record_ai_moderation(uuid, text, text) to authenticated;

-- ---- post topic categorization (repair/ride/yard/moving/talk/other) -------
-- Separate concern from moderation above (offensive/spam vs. what kind of
-- need this is) — see BUILD_SPEC.md AI HELPERS job 1. Same security-definer
-- + author-or-admin pattern as mark_post_ai_clean, and posts_update_own no
-- longer grants column-level UPDATE on category directly (see the posts
-- column-grant restriction above), so this RPC is the only write path.
alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check
  check (category is null or category in ('repair', 'ride', 'yard', 'moving', 'talk', 'other'));

create or replace function public.record_post_category(target_post_id uuid, result_category text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_post public.posts;
begin
  select * into v_post from public.posts where id = target_post_id;
  if v_post is null then
    raise exception 'post not found';
  end if;
  if not (public.is_admin() or v_post.author_id = auth.uid()) then
    raise exception 'not authorized to categorize this post';
  end if;
  if result_category not in ('repair', 'ride', 'yard', 'moving', 'talk', 'other') then
    raise exception 'invalid category';
  end if;

  update public.posts set category = result_category where id = target_post_id;
end;
$$;

grant execute on function public.record_post_category(uuid, text) to authenticated;

-- Owner sends the (possibly edited) warning: writes the admin_message and
-- resolves the flag in one step so the two can't drift apart.
--
-- Repeated rescans of the same post (record_ai_moderation) each open a new
-- pending flag once the previous one is resolved — the "one pending AI flag
-- per post" index only dedupes while resolution is still null. Without a
-- check here, warning each new flag stacked another near-identical
-- admin_message on the same recipient (7 of them, in practice), which reads
-- as harassment rather than help. If the recipient still has an earlier
-- warning for this same post sitting undismissed (dismissed_at is null —
-- see admin_messages above), refresh that one in place instead of stacking
-- a new one; only insert fresh when there's nothing live to update.
create or replace function public.send_moderation_warning(target_flag_id uuid, message_body text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_flag public.flags;
  v_post public.posts;
  v_existing_id uuid;
begin
  if not public.is_admin() then
    raise exception 'owner only';
  end if;

  select * into v_flag from public.flags where id = target_flag_id for update;
  if v_flag is null then
    raise exception 'flag not found';
  end if;
  if v_flag.target_type <> 'post' then
    raise exception 'not a post flag';
  end if;

  select * into v_post from public.posts where id = v_flag.target_id;
  if v_post is null or v_post.author_id is null then
    raise exception 'post or post author not found';
  end if;

  select am.id into v_existing_id
  from public.admin_messages am
  join public.flags f on f.id = am.related_flag_id
  where am.recipient_id = v_post.author_id
    and am.dismissed_at is null
    and f.target_type = 'post'
    and f.target_id = v_post.id
  order by am.created_at desc
  limit 1;

  if v_existing_id is not null then
    update public.admin_messages
    set body = message_body,
        related_flag_id = target_flag_id,
        created_at = now(),
        read_at = null
    where id = v_existing_id;
  else
    insert into public.admin_messages (admin_id, recipient_id, body, related_flag_id)
    values (auth.uid(), v_post.author_id, message_body, target_flag_id);
  end if;

  update public.flags set resolution = 'warned', reviewed = true where id = target_flag_id;
end;
$$;

grant execute on function public.send_moderation_warning(uuid, text) to authenticated;

create or replace function public.skip_moderation_flag(target_flag_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'owner only';
  end if;
  update public.flags set resolution = 'skipped', reviewed = true where id = target_flag_id;
end;
$$;

-- ============================================================================
-- HELP & SUPPORT — AI-assisted chat (public data only, never the private
-- 1-on-1 chat in `messages`) + an owner-only queue. A user's own support
-- thread lives here; so does any reply they send to an owner warning
-- (admin_messages) — related_admin_message_id links the two instead of
-- building a second reply channel. Nothing here auto-acts on a user; the
-- AI only classifies and drafts, same as the moderation queue.
-- ============================================================================
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  body text not null,
  ai_category text check (ai_category is null or ai_category in ('question', 'bug', 'suggestion', 'complaint')),
  related_admin_message_id uuid references public.admin_messages(id) on delete set null,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user_idx on public.support_messages (user_id, created_at);

alter table public.support_messages enable row level security;

-- A user reads their own whole thread (their messages + the assistant's).
drop policy if exists support_messages_select_own on public.support_messages;
create policy support_messages_select_own on public.support_messages
  for select using (user_id = auth.uid());

drop policy if exists support_messages_select_admin_all on public.support_messages;
create policy support_messages_select_admin_all on public.support_messages
  for select using (public.is_admin());

-- Only ever inserts their OWN messages as sender='user' — the assistant's
-- replies go through record_support_assistant_reply below instead, so a
-- client can never write a fake 'assistant' row.
drop policy if exists support_messages_insert_own on public.support_messages;
create policy support_messages_insert_own on public.support_messages
  for insert with check (user_id = auth.uid() and sender = 'user');

-- Owner can mark a thread reviewed once they've looked at it.
drop policy if exists support_messages_update_admin_review on public.support_messages;
create policy support_messages_update_admin_review on public.support_messages
  for update using (public.is_admin());

-- Security definer so the assistant's own reply can be written under the
-- same request that just inserted the user's message, without a broader
-- insert policy that would let a client post as 'assistant' directly.
-- Returns the inserted row so the caller can append it client-side without
-- a full reload — same reasoning as sendMessage() returning its row for the
-- peer chat.
create or replace function public.record_support_assistant_reply(
  target_user_id uuid,
  assistant_body text
)
returns public.support_messages
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.support_messages;
begin
  if target_user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  insert into public.support_messages (user_id, sender, body)
  values (target_user_id, 'assistant', assistant_body)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.record_support_assistant_reply(uuid, text) to authenticated;

grant execute on function public.skip_moderation_flag(uuid) to authenticated;
