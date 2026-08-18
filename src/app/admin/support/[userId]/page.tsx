import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSupportMessagesForUser, getUserById } from "@/lib/queries";
import { markSupportThreadReviewed } from "@/app/actions";
import SupportCategoryBadge from "@/components/SupportCategoryBadge";

export default async function AdminSupportThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  if (!admin.is_admin) {
    return <div className="mx-auto max-w-md text-center text-sm text-muted">Owner only.</div>;
  }

  const target = await getUserById(userId);
  if (!target) notFound();

  const messages = await getSupportMessagesForUser(userId);

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/admin/support" className="mb-3 inline-block text-sm text-muted hover:underline">
        ‹ Back to Support
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{target.display_name}</h1>
        <form action={markSupportThreadReviewed.bind(null, userId)}>
          <button type="submit" className="text-xs font-medium text-coral hover:underline">
            Mark reviewed
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-muted">{target.email}</p>

      <div className="mt-4 flex flex-col gap-3">
        {messages.length === 0 && <p className="text-sm text-muted">No messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-start" : "items-end"}`}>
            <div
              className={`max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm ${
                m.sender === "user" ? "border border-border bg-surface text-ink" : "bg-ink/5 text-ink"
              }`}
            >
              {m.body}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 px-1">
              <span className="text-[11px] text-muted">
                {m.sender === "user" ? target.display_name : "Assistant"} ·{" "}
                {new Date(m.created_at).toLocaleString()}
              </span>
              {m.ai_category && <SupportCategoryBadge category={m.ai_category} />}
              {m.related_admin_message_id && (
                <span className="text-[11px] text-muted">· reply to a warning</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link
        href={`/admin/messages/${userId}`}
        className="mt-6 inline-block rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-hover"
      >
        Message this user
      </Link>
    </div>
  );
}
