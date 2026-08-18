"use client";

import { useState, useTransition } from "react";
import { replyToAdminMessage } from "@/app/actions";

export default function AdminMessageReply({ adminMessageId }: { adminMessageId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return <p className="mt-2 text-xs text-muted">Reply sent — the app owner will see it.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-coral hover:underline">
        Reply
      </button>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Write a reply..."
        className="w-full rounded-lg border border-border bg-cream p-2 text-sm text-ink"
      />
      <div className="mt-1.5 flex gap-3">
        <button
          disabled={pending || !body.trim()}
          onClick={() =>
            startTransition(async () => {
              await replyToAdminMessage(adminMessageId, body);
              setDone(true);
            })
          }
          className="rounded-full bg-coral px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send reply"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
