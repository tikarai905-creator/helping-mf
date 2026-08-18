-- ONE-TIME CLEANUP — run this once in the Supabase SQL editor before Friday.
-- Do NOT fold this into schema.sql: schema.sql is meant to be safely
-- re-runnable forever, and this is a destructive one-off wipe of every post
-- created during development/testing (Loop test posts, profanity test
-- posts, "hi guys i need help to lift my leg up", etc.) so the feed starts
-- clean for a first-time real user.
--
-- What it does:
--   1. Deletes every row in posts. This CASCADES to replies, connections,
--      and messages tied to those posts (their foreign keys are all
--      ON DELETE CASCADE) — so all the test chat history and connections
--      go with them.
--   2. Cleans up any flags left pointing at a post that no longer exists
--      (flags.target_id has no FK, since it's polymorphic across post/user,
--      so those don't cascade automatically).
--   3. Re-inserts the 5 labeled "example" posts fresh, so the feed isn't
--      blank on first load — same content as the seed block in schema.sql.
--
-- What it does NOT do: touch any user accounts. Test accounts (Tika,
-- AppleDaddy, appleMF, LoopPosterC, LoopHelperD, etc.) are left alone —
-- only asked to delete posts, not people. Everyone's three-numbers stats
-- naturally reset to neutral since they're computed live from connections,
-- which just got cleared.
--
-- Safe to run more than once, but running it again after real posts exist
-- will delete those too — this is a one-time reset, not a maintenance task.

delete from public.flags
where target_type = 'post'
  and target_id not in (select id from public.posts);

delete from public.posts;

insert into public.posts (body, rough_area, kind, status, is_seed)
values
  ('John needs a hand moving a couch up two flights of stairs this weekend.', 'Downtown', 'free', 'open', true),
  ('Maria would like someone to talk to over coffee — just company, no agenda.', 'Riverside', 'free', 'open', true),
  ('Looking for someone to help trim an overgrown hedge in exchange for fresh vegetables.', 'Maple Heights', 'trade', 'open', true),
  ('Need a ride to a medical appointment next Tuesday morning, can pay for gas.', 'Old Town', 'paid', 'open', true),
  ('Anyone free to help set up a new laptop for an elderly neighbor?', 'Westfield', 'free', 'open', true);
