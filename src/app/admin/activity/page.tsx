import { redirect } from "next/navigation";
import { getAllPostsForAdmin, getCurrentUser } from "@/lib/queries";
import { KIND_LABELS } from "@/lib/config";
import KindBadge from "@/components/KindBadge";
import StatusBadge from "@/components/StatusBadge";
import type { PostKind, PostStatus } from "@/lib/database.types";

function timestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; area?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) {
    return (
      <div className="mx-auto max-w-md text-center text-sm text-muted">
        Owner only.
      </div>
    );
  }

  const { kind, status, area } = await searchParams;
  const kindFilter = (kind ?? "all") as PostKind | "all";
  const statusFilter = (status ?? "all") as PostStatus | "all";
  const areaFilter = area ?? "";

  const posts = await getAllPostsForAdmin({
    kind: kindFilter,
    status: statusFilter,
    area: areaFilter,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-ink">Activity</h1>
      <p className="mt-1 text-sm text-muted">
        Every post on the board, newest first — your window into the whole app.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Kind
          <select
            name="kind"
            defaultValue={kindFilter}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-ink"
          >
            <option value="all">All</option>
            <option value="free">{KIND_LABELS.free}</option>
            <option value="trade">{KIND_LABELS.trade}</option>
            <option value="paid">{KIND_LABELS.paid}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Status
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-ink"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Area
          <input
            name="area"
            defaultValue={areaFilter}
            placeholder="e.g. Riverside"
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-ink"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-coral px-4 py-1.5 text-white hover:bg-coral-hover"
        >
          Filter
        </button>
        {(kindFilter !== "all" || statusFilter !== "all" || areaFilter) && (
          <a href="/admin/activity" className="text-xs underline text-muted">
            Clear
          </a>
        )}
      </form>

      <p className="mt-4 text-xs text-muted">
        {posts.length} post{posts.length === 1 ? "" : "s"}
      </p>

      <div className="mt-2 flex flex-col divide-y divide-border">
        {posts.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            No posts match these filters.
          </p>
        )}
        {posts.map((p) => (
          <div key={p.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <KindBadge kind={p.kind} />
              <StatusBadge status={p.status} />
              {p.is_seed && (
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-muted">
                  example
                </span>
              )}
              {p.moderationLabel && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.moderationLabel === "clean" || p.moderationLabel === "not scanned"
                      ? "bg-ink/5 text-muted"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {p.moderationLabel}
                </span>
              )}
              <span className="ml-auto shrink-0 text-xs text-muted">
                {timestamp(p.created_at)}
              </span>
            </div>

            <p className="mt-1.5 text-sm leading-snug text-ink">{p.body}</p>

            <p className="mt-1 text-xs text-muted">
              {p.rough_area} · {p.authorName ?? "no author (example post)"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
