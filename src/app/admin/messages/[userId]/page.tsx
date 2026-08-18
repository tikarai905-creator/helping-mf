import { notFound, redirect } from "next/navigation";
import { getAdminMessagesForRecipient, getCurrentUser, getUserById } from "@/lib/queries";
import { sendAdminMessage } from "@/app/actions";

export default async function AdminMessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const admin = await getCurrentUser();
  if (!admin) redirect("/login");
  if (!admin.is_admin) {
    return (
      <div className="mx-auto max-w-md text-center text-sm text-muted">
        Owner only.
      </div>
    );
  }

  const target = await getUserById(userId);
  if (!target) notFound();

  const messages = await getAdminMessagesForRecipient(userId);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-ink">Message {target.display_name}</h1>
      <p className="mt-1 text-sm text-muted">{target.email}</p>

      <div className="mt-6 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-sm text-muted">No messages sent yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg bg-ink/5 p-3 text-sm">
            <p className="text-ink">{m.body}</p>
            <p className="mt-1 text-xs text-muted">
              {new Date(m.created_at).toLocaleString()}
              {m.read_at ? " · read" : " · unread"}
              {m.related_flag_id ? " · from a moderation flag" : ""}
              {m.dismissed_at ? " · dismissed by user" : ""}
            </p>
          </div>
        ))}
      </div>

      <form action={sendAdminMessage.bind(null, userId)} className="mt-6 flex flex-col gap-2">
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Write a message..."
          className="rounded-lg border border-border bg-surface p-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="self-start rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-hover"
        >
          Send
        </button>
      </form>
    </div>
  );
}
