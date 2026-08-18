import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getSupportThreadSummaries } from "@/lib/queries";
import SupportCategoryBadge from "@/components/SupportCategoryBadge";

export default async function AdminSupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) {
    return <div className="mx-auto max-w-md text-center text-sm text-muted">Owner only.</div>;
  }

  const threads = await getSupportThreadSummaries();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-ink">Support</h1>
      <p className="mt-1 text-sm text-muted">
        Help & Support conversations, newest activity first. AI sorts by category — you decide
        what to do.
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {threads.length === 0 && <p className="text-sm text-muted">No support messages yet.</p>}
        {threads.map((t) => (
          <Link
            key={t.userId}
            href={`/admin/support/${t.userId}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm shadow-soft"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-ink">{t.displayName}</span>
                {t.lastCategory && <SupportCategoryBadge category={t.lastCategory} />}
                {t.unreviewedCount > 0 && (
                  <span className="rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {t.unreviewedCount} new
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">{t.lastMessage}</p>
            </div>
            <span className="shrink-0 text-xs text-muted">{new Date(t.lastAt).toLocaleDateString()}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
