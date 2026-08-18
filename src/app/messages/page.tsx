import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getMyConnections } from "@/lib/queries";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const connections = await getMyConnections(user.id);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-ink">Messages</h1>
      <p className="mt-1 text-sm text-muted">
        Every chat you have open — from posts you helped with or got help on.
      </p>

      <div className="mt-6 flex flex-col gap-2.5">
        {connections.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted shadow-soft">
            No conversations yet. Once you help someone or get accepted, your chats show up here.
          </div>
        )}
        {connections.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-soft transition hover:border-coral/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral/15 text-sm font-semibold text-coral">
              {c.peer.display_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{c.peer.display_name}</p>
              <p className="truncate text-xs text-muted">
                {c.role === "helper" ? "You helped" : "Helped you"} · {c.peer.rough_area}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted">{c.confirmed_status ?? "open"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
