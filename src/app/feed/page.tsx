import Link from "next/link";
import { getCurrentUser, getFeedPosts } from "@/lib/queries";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CATEGORY_LABELS } from "@/lib/config";
import PostCard from "@/components/PostCard";
import SetupNotice from "@/components/SetupNotice";
import type { PostCategory } from "@/lib/database.types";

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as PostCategory[];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string; welcome?: string; category?: string }>;
}) {
  const { all, welcome, category } = await searchParams;
  const user = await getCurrentUser();
  const showAllAreas = all === "1";
  const activeCategory = CATEGORY_ORDER.includes(category as PostCategory)
    ? (category as PostCategory)
    : null;

  const posts = await getFeedPosts(user?.rough_area ?? null, showAllAreas);
  const visiblePosts = activeCategory ? posts.filter((p) => p.category === activeCategory) : posts;

  function chipHref(cat: PostCategory | null) {
    const params = new URLSearchParams();
    if (showAllAreas) params.set("all", "1");
    if (cat) params.set("category", cat);
    const qs = params.toString();
    return qs ? `/feed?${qs}` : "/feed";
  }

  return (
    <div>
      {!isSupabaseConfigured() && <SetupNotice />}

      {welcome === "1" && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-4 text-sm shadow-soft">
          <p className="font-medium text-ink">Welcome — here&apos;s how this works:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted">
            <li>Post what you need, or browse what neighbors nearby are asking for.</li>
            <li>Raise your hand on something — the poster sees your name and picks who gets in.</li>
            <li>Once accepted, a private chat opens so you can work it out.</li>
          </ol>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            {showAllAreas ? "All areas" : user?.rough_area ?? "Nearby"}
          </h1>
          <p className="text-sm text-muted">
            Need-only. No names here — the poster stays anonymous until they let someone in.
          </p>
        </div>
        <Link
          href={showAllAreas ? `/feed${category ? `?category=${category}` : ""}` : `/feed?${["all=1", category ? `category=${category}` : ""].filter(Boolean).join("&")}`}
          className="whitespace-nowrap text-sm font-medium text-coral hover:underline"
        >
          {showAllAreas ? "Just my area" : "See all areas"}
        </Link>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Link
          href={chipHref(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeCategory === null
              ? "bg-coral text-white"
              : "border border-border bg-surface text-muted hover:text-ink"
          }`}
        >
          All
        </Link>
        {CATEGORY_ORDER.map((cat) => (
          <Link
            key={cat}
            href={chipHref(cat)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeCategory === cat
                ? "bg-coral text-white"
                : "border border-border bg-surface text-muted hover:text-ink"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {visiblePosts.length === 0 && posts.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted shadow-soft">
            No {CATEGORY_LABELS[activeCategory!].toLowerCase()} posts right now.{" "}
            <Link href={chipHref(null)} className="font-medium text-coral hover:underline">
              Clear filter
            </Link>
            .
          </div>
        )}
        {posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted shadow-soft">
            Nothing open here yet.{" "}
            <Link href="/feed/new" className="font-medium text-coral hover:underline">
              Post the first need
            </Link>
            .
          </div>
        )}
        {visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
