import Link from "next/link";
import { logIn } from "@/app/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-ink">Log in</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={logIn} className="mt-6 flex flex-col gap-4">
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
            className="rounded-lg border border-border bg-surface px-3 py-2 text-ink"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-coral px-4 py-2 text-white hover:bg-coral-hover"
        >
          Log in
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
