import Link from "next/link";
import { signUp } from "@/app/actions";
import { TERMS_TEXT } from "@/lib/config";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-ink">Sign up</h1>
      <p className="mt-1 text-sm text-muted">One account, one profile, one feed.</p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={signUp} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            name="display_name"
            required
            placeholder="First name or a handle"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Rough area
          <input
            name="rough_area"
            required
            placeholder="Neighborhood, not your address"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
          <span className="text-xs text-muted">
            No live GPS — just a coarse label like &quot;Riverside&quot; or &quot;Downtown&quot;.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Age
          <input
            type="number"
            name="age"
            required
            min={18}
            max={120}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
          <span className="text-xs text-muted">Self-entered, not verified. Informational only.</span>
        </label>

        <div className="rounded-lg border border-border bg-cream p-3 text-xs text-muted">
          <p className="whitespace-pre-line">{TERMS_TEXT}</p>
        </div>

        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" name="agree" required className="mt-0.5" />
          <span>I&apos;m 18 or older and I accept the terms above.</span>
        </label>

        <button
          type="submit"
          className="rounded-full bg-coral px-4 py-2 text-white hover:bg-coral-hover"
        >
          Create account
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
