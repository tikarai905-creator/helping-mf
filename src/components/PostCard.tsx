import Link from "next/link";
import KindBadge from "@/components/KindBadge";
import CategoryBadge from "@/components/CategoryBadge";
import type { FeedPostRow } from "@/lib/database.types";

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// One card skeleton for every post type — text-only, photo, free/trade/paid
// all share this same top-to-bottom reading order: an anonymous "someone
// nearby" header, the need as the one bold element, an optional photo, then
// a quiet divided footer for area/category/kind and the tap affordance.
// Nothing here reveals or implies who the poster is — that's the whole
// point of the icon instead of an initial.
export default function PostCard({ post }: { post: FeedPostRow }) {
  return (
    <Link
      href={`/post/${post.id}`}
      className="block overflow-hidden rounded-3xl border border-border bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-coral/30"
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-coral" aria-hidden="true">
                <path
                  d="M4 11.5 12 4l8 7.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="truncate text-xs font-medium text-muted">Neighbor nearby</span>
          </div>
          <span className="shrink-0 text-xs text-muted">{timeAgo(post.created_at)}</span>
        </div>

        <p className="mt-3 line-clamp-3 break-words text-[17px] font-semibold leading-snug text-ink">
          {post.body}
        </p>
      </div>

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image_url} alt="" className="aspect-[4/3] w-full border-y border-border object-cover" />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-xs text-muted">{post.rough_area}</span>
          {post.category && <CategoryBadge category={post.category} />}
          <KindBadge kind={post.kind} />
          {post.is_seed && (
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-muted">example</span>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium text-coral">Open →</span>
      </div>
    </Link>
  );
}
