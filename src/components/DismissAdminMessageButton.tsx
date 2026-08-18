"use client";

import { useTransition } from "react";
import { dismissAdminMessage } from "@/app/actions";

// Hides the message from view, doesn't delete it — no confirm needed, this
// isn't destructive to the underlying record (the owner still has it).
export default function DismissAdminMessageButton({ messageId }: { messageId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => dismissAdminMessage(messageId))}
      aria-label="Dismiss this message"
      className="shrink-0 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-50"
    >
      ✕
    </button>
  );
}
