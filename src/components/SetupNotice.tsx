export default function SetupNotice() {
  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm shadow-soft dark:border-amber-800 dark:bg-amber-950">
      <p className="font-medium text-ink">Supabase isn&apos;t connected yet</p>
      <p className="mt-1 text-muted">
        Paste your Project URL and anon key into{" "}
        <code className="rounded bg-ink/10 px-1">.env.local</code> at the project root, then
        restart the dev server. The feed and auth will start working as soon as those are in.
      </p>
    </div>
  );
}
