"use client";

import { useTransition } from "react";
import { confirmConnection } from "@/app/actions";
import type { ConfirmStatus } from "@/lib/database.types";

const OPTIONS: { value: ConfirmStatus; label: string; className: string }[] = [
  { value: "good", label: "Good", className: "bg-teal hover:bg-teal-hover text-white" },
  {
    value: "didnt_happen",
    label: "Didn't happen",
    className: "border border-border text-ink hover:border-coral/40",
  },
  { value: "bad", label: "Bad", className: "bg-red-600 hover:bg-red-700 text-white" },
];

export default function ConfirmBar({ connectionId }: { connectionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-coral/25 bg-coral/5 p-4 shadow-soft">
      <p className="text-sm font-semibold text-ink">How did this go?</p>
      <p className="mt-1 text-xs text-muted">
        You&apos;re confirming as the person who received help. This is what grows their score.
      </p>
      <div className="mt-3 flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={pending}
            onClick={() => startTransition(() => confirmConnection(connectionId, opt.value))}
            className={`rounded-full px-3 py-1.5 text-sm disabled:opacity-50 ${opt.className}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
