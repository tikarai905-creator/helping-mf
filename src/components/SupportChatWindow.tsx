"use client";

import { useState, useTransition } from "react";
import { sendSupportMessage } from "@/app/actions";
import { MAX_SUPPORT_MESSAGE_LENGTH } from "@/lib/config";
import type { SupportMessageRow } from "@/lib/database.types";

// Same locale-pinning fix as ChatWindow.tsx's formatTime — an unpinned
// locale causes a server/client hydration mismatch.
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function SupportChatWindow({ initialMessages }: { initialMessages: SupportMessageRow[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendSupportMessage(body);
        if (result) {
          setMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
        }
      } catch {
        setDraft(body);
        setError("Couldn't send that — check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            Ask anything about how Neighbor works — posting, replying, chats, your account.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender === "user";
          return (
            <div key={m.id} className={`mt-3 flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-coral text-white" : "border border-border bg-surface text-ink"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-0.5 px-1 text-[11px] text-muted">{formatTime(m.created_at)}</span>
            </div>
          );
        })}
        {pending && (
          <div className="mt-3 flex flex-col items-start">
            <div className="max-w-[80%] rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-muted">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && <p className="pt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2 border-t border-border pt-3"
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          maxLength={MAX_SUPPORT_MESSAGE_LENGTH}
          placeholder="Ask a question…"
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-full bg-coral px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
