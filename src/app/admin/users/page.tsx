import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllUsers, getCurrentUser } from "@/lib/queries";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) {
    return (
      <div className="mx-auto max-w-md text-center text-sm text-muted">
        Owner only.
      </div>
    );
  }

  const users = await getAllUsers();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-ink">Message a user</h1>
      <p className="mt-1 text-sm text-muted">
        Send anyone a direct message from you, the app owner. Separate from the private
        peer-to-peer chat.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {users.map((u) => (
          <Link
            key={u.id}
            href={`/admin/messages/${u.id}`}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-soft"
          >
            <span className="text-ink">
              {u.display_name}{" "}
              <span className="text-xs text-muted">{u.email}</span>
            </span>
            <span className="text-xs text-muted">{u.rough_area}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
