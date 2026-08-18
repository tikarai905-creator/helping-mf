"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        That&apos;s on us, not you. Try again, or head back to the feed.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-full border border-border px-5 py-2.5 text-sm text-ink hover:border-coral/40"
        >
          Try again
        </button>
        <Link
          href="/feed"
          className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-hover"
        >
          Back to feed
        </Link>
      </div>
    </div>
  );
}
