"use client";

import { useTransition } from "react";
import { scanUnscannedPosts } from "@/app/actions";

export default function ScanNowButton({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition();

  if (!configured) {
    return (
      <p className="text-xs text-muted">
        AI scanning isn&apos;t connected yet — add DEEPSEEK_API_KEY to .env.local.
      </p>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => scanUnscannedPosts())}
      className="rounded-full border border-border px-3 py-1.5 text-sm text-ink disabled:opacity-50"
    >
      {pending ? "Scanning…" : "Scan open posts now"}
    </button>
  );
}
