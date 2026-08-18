-- ONE-OFF — run manually in the Supabase SQL editor if you want.
-- Bundle A added post categorization (repair/ride/yard/moving/talk/other),
-- wired into new posts and into the admin "Scan now" rescan button. Seed
-- posts got their categories backfilled directly in schema.sql. Real posts
-- created before this bundle are likely already ai_scanned = true from the
-- moderation pass, which means the admin moderation queue's "Scan now"
-- button won't pick them up — that button only looks at unscanned posts.
--
-- This resets ai_scanned to false on real (non-seed) posts that still have
-- no category, so the next "Scan now" click categorizes them (and harmlessly
-- re-runs moderation too — same call, same cost as any other rescan).
-- Safe to re-run; only touches rows still missing a category.

update public.posts
set ai_scanned = false
where is_seed = false
  and category is null;
