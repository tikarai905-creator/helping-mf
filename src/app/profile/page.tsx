import Link from "next/link";
import { redirect } from "next/navigation";
import StatFace from "@/components/StatFace";
import KindBadge from "@/components/KindBadge";
import StatusBadge from "@/components/StatusBadge";
import TrackRecordWeb from "@/components/TrackRecordWeb";
import DeletePostButton from "@/components/DeletePostButton";
import AdminMessageReply from "@/components/AdminMessageReply";
import DismissAdminMessageButton from "@/components/DismissAdminMessageButton";
import { createClient } from "@/lib/supabase/server";
import { groupByBody } from "@/lib/groupDuplicates";
import {
  getAdminMessagesForRecipient,
  getCurrentUser,
  getMyConnections,
  getMyPosts,
  getPublicStats,
} from "@/lib/queries";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Soft fallback: quietly settle any connection that's sat unconfirmed past
  // the window (see settle_fallback_confirms in schema.sql). Cheap enough to
  // run opportunistically whenever someone opens their profile.
  const supabase = await createClient();
  await supabase.rpc("settle_fallback_confirms");

  const [stats, posts, connections, adminMessages] = await Promise.all([
    getPublicStats(user.id),
    getMyPosts(user.id),
    getMyConnections(user.id),
    getAdminMessagesForRecipient(user.id),
  ]);

  const needsConfirm = connections.filter(
    (c) => c.role === "receiver" && c.confirmed_status === null
  );

  // Posts are already newest-first — collapse repeated test posts (same
  // body text) into one row with a "×N" count instead of listing each.
  const groupedPosts = groupByBody(posts);

  // Dismissed warnings stay in the admin's record (getAdminMessagesForRecipient
  // is also what /admin/messages/[userId] reads, unfiltered) — only this
  // page's own list hides them, so the user's view doesn't stay cluttered.
  const visibleAdminMessages = adminMessages.filter((m) => !m.dismissed_at);

  const unreadIds = visibleAdminMessages.filter((m) => !m.read_at).map((m) => m.id);
  if (unreadIds.length > 0) {
    await supabase
      .from("admin_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-coral/15 text-lg font-semibold text-coral">
          {user.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink">{user.display_name}</h1>
          <p className="text-sm text-muted">{user.rough_area}</p>
        </div>
      </div>

      <div className="mt-4">
        <StatFace stats={stats} />
      </div>

      <section className="mt-6">
        <TrackRecordWeb helpedCount={stats.helped_count} />
      </section>

      {visibleAdminMessages.length > 0 && (
        <section className="mt-6">
          <h2 className="font-medium text-ink">Messages from the app owner</h2>
          <div className="mt-3 flex flex-col gap-2">
            {visibleAdminMessages.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-surface p-3 text-sm shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-ink">{m.body}</p>
                  <DismissAdminMessageButton messageId={m.id} />
                </div>
                <p className="mt-1 text-xs text-muted">{new Date(m.created_at).toLocaleString()}</p>
                <AdminMessageReply adminMessageId={m.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {needsConfirm.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm shadow-soft dark:border-amber-800 dark:bg-amber-950">
          <p className="font-medium text-ink">
            You have {needsConfirm.length} connection{needsConfirm.length > 1 ? "s" : ""} to confirm.
          </p>
          <p className="mt-1 text-muted">
            Let the person know how it went — good, didn&apos;t happen, or bad.
          </p>
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-ink">My posts</h2>
          <Link href="/feed/new" className="text-xs font-medium text-coral hover:underline">
            + New post
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted">
          Only you see this list — the feed keeps you anonymous until you accept someone.
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          {groupedPosts.length === 0 && (
            <p className="text-sm text-muted">You haven&apos;t posted anything yet.</p>
          )}
          {groupedPosts.map(({ item: p, count }) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface p-3 shadow-soft">
              <Link href={`/post/${p.id}`} className="flex items-center gap-3 text-sm">
                <span className="line-clamp-1 flex-1 text-ink">{p.body}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {count > 1 && (
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-muted">×{count}</span>
                  )}
                  <KindBadge kind={p.kind} />
                  <StatusBadge status={p.status} />
                </span>
              </Link>
              <div className="mt-2 flex items-center gap-3 border-t border-border pt-2">
                <Link href={`/post/${p.id}/edit`} className="text-xs text-coral hover:underline">
                  Edit
                </Link>
                <DeletePostButton postId={p.id} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-medium text-ink">My connections</h2>
        <p className="mt-1 text-xs text-muted">
          People you&apos;ve helped or been helped by — tap anyone to message them again.
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          {connections.length === 0 && (
            <p className="text-sm text-muted">No connections yet — accept a reply or get accepted on one.</p>
          )}
          {connections.map((c) => (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-sm shadow-soft"
            >
              <span className="text-ink">
                {c.peer.display_name}{" "}
                <span className="text-xs text-muted">
                  ({c.role === "helper" ? "you helped" : "helped you"})
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted">{c.confirmed_status ?? "open"}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
