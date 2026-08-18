"use client";

import { useState, useTransition } from "react";
import { fileFlag } from "@/app/actions";
import type { FlagTargetType } from "@/lib/database.types";

export default function FlagButton({
  targetType,
  targetId,
  returnPath,
  label = "Report",
}: {
  targetType: FlagTargetType;
  targetId: string;
  returnPath: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <span className="text-xs text-muted">Reported. An owner will review it.</span>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-muted hover:text-red-600 hover:underline">
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-xs shadow-soft">
      <p className="mb-2 text-muted">What&apos;s wrong? Optional, goes only to the app owner.</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-border bg-cream p-2 text-sm text-ink"
      />
      <div className="mt-2 flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await fileFlag(targetType, targetId, reason, returnPath);
              setDone(true);
            })
          }
          className="rounded-full bg-red-600 px-2.5 py-1 text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Submit report"}
        </button>
        <button onClick={() => setOpen(false)} className="text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
