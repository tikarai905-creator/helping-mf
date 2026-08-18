"use client";

import { useState, useTransition } from "react";
import { deletePostAdmin, sendModerationWarning, skipModerationFlag } from "@/app/actions";
import type { ModerationQueueItem } from "@/lib/queries";

const CATEGORY_LABELS: Record<string, string> = {
  offensive: "Offensive",
  spam: "Spam",
};

export default function ModerationItem({
  item,
  onDismiss,
}: {
  item: ModerationQueueItem;
  onDismiss: (id: string) => void;
}) {
  const [draft, setDraft] = useState(item.draft_message ?? "");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"sent" | "skipped" | "deleted" | null>(null);

  if (done) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted shadow-soft">
        <span>
          {done === "sent" && "Warning sent."}
          {done === "skipped" && "Skipped — no message sent."}
          {done === "deleted" && "Post deleted."}
        </span>
        <button onClick={() => onDismiss(item.id)} className="shrink-0 underline">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-surface p-4 shadow-soft dark:border-amber-800">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          AI: {CATEGORY_LABELS[item.ai_category ?? ""] ?? item.ai_category}
        </span>
        <span className="text-xs text-muted">
          {new Date(item.created_at).toLocaleString()}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink">{item.post.body}</p>
      <p className="mt-1 text-xs text-muted">
        {item.post.rough_area} · by {item.authorName ?? "unknown user"}
      </p>

      <div className="mt-3">
        <label className="text-xs font-medium text-muted">
          Draft warning to the poster — edit before sending, or skip
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-cream p-2 text-sm text-ink"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={pending || !draft.trim()}
          onClick={() =>
            startTransition(async () => {
              await sendModerationWarning(item.id, draft);
              setDone("sent");
            })
          }
          className="rounded-full bg-coral px-3 py-1.5 text-sm text-white hover:bg-coral-hover disabled:opacity-50"
        >
          Send warning
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await skipModerationFlag(item.id);
              setDone("skipped");
            })
          }
          className="rounded-full border border-border px-3 py-1.5 text-sm text-ink disabled:opacity-50"
        >
          Skip
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Delete this post? This also removes any replies, connections, and chat tied to it. This cannot be undone."
              )
            ) {
              return;
            }
            startTransition(async () => {
              await deletePostAdmin(item.post.id);
              setDone("deleted");
            });
          }}
          className="rounded-full border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
        >
          Delete post
        </button>
      </div>
    </div>
  );
}
