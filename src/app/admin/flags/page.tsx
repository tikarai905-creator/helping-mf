import { redirect } from "next/navigation";
import { getCurrentUser, getFlags } from "@/lib/queries";
import { markFlagReviewed } from "@/app/actions";

export default async function AdminFlagsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) {
    return (
      <div className="mx-auto max-w-md text-center text-sm text-muted">
        Owner only.
      </div>
    );
  }

  const flags = await getFlags();

  const flaggerCounts = new Map<string, { name: string; count: number }>();
  for (const f of flags) {
    if (!f.flagger_id) continue;
    const entry = flaggerCounts.get(f.flagger_id) ?? { name: f.flagger.display_name, count: 0 };
    entry.count += 1;
    flaggerCounts.set(f.flagger_id, entry);
  }
  const repeatFlaggers = [...flaggerCounts.values()]
    .filter((e) => e.count >= 3)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold text-ink">Flags</h1>
      <p className="mt-1 text-sm text-muted">
        Owner-only. Nothing here auto-acts — you decide.
      </p>

      {repeatFlaggers.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950">
          <p className="font-medium">Repeat flaggers (worth a second look):</p>
          {repeatFlaggers.map((f) => (
            <p key={f.name}>
              {f.name} — {f.count} reports filed
            </p>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {flags.length === 0 && (
          <p className="text-sm text-muted">No reports filed.</p>
        )}
        {flags.map((f) => (
          <div
            key={f.id}
            className={`rounded-lg border p-3 text-sm ${
              f.reviewed
                ? "border-border opacity-50"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">
                {f.target_type} · {f.target_id.slice(0, 8)}
              </span>
              <span className="text-xs text-muted">
                {new Date(f.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-muted">{f.reason || "No reason given."}</p>
            <p className="mt-1 text-xs text-muted">
              Filed by {f.flagger.display_name}
              {f.ai_category ? ` · AI: ${f.ai_category}` : ""}
            </p>
            {!f.reviewed && (
              <form action={markFlagReviewed.bind(null, f.id)} className="mt-2">
                <button type="submit" className="text-xs underline">
                  Mark reviewed
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
