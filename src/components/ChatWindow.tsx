"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/app/actions";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/lib/config";
import type { MessageRow } from "@/lib/database.types";

// Explicit locale, not the runtime default — the server process and the
// browser can disagree on locale (seen live: Node rendered "12:43 a.m.",
// the browser rendered "12:43 AM"), which is a hydration mismatch since
// this same function runs during SSR and again on the client.
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function ChatWindow({
  connectionId,
  currentUserId,
  initialMessages,
}: {
  connectionId: string;
  currentUserId: string;
  initialMessages: MessageRow[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // The Realtime websocket only attaches the user's JWT once the
      // client's session is hydrated. Subscribing before this resolves
      // connects as anonymous — RLS then silently drops every event for
      // this subscriber (no error, it just never arrives).
      await supabase.auth.getSession();
      if (cancelled) return;

      channel = supabase
        .channel(`messages:${connectionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `connection_id=eq.${connectionId}`,
          },
          (payload) => {
            setMessages((prev) => {
              const incoming = payload.new as MessageRow;
              if (prev.some((m) => m.id === incoming.id)) return prev;
              return [...prev, incoming];
            });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [connectionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setSendError(null);
    startTransition(async () => {
      try {
        const sent = await sendMessage(connectionId, body);
        if (sent) {
          // Show it immediately rather than waiting on the realtime round
          // trip. If the same row also arrives over the subscription above,
          // the id-based dedup there is a no-op.
          setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
        }
      } catch {
        // Give the message back instead of silently swallowing it — an
        // unhandled rejection here would clear the draft with no feedback
        // and the user wouldn't know whether it sent.
        setDraft(body);
        setSendError("Couldn't send that — check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            Say hello — this chat is private, nobody else can read it.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === currentUserId;
          // Tight spacing within a run of messages from the same person,
          // more air when the sender changes — reads as grouped turns
          // instead of one undifferentiated stack.
          const sameSenderAsPrev = i > 0 && messages[i - 1].sender_id === m.sender_id;
          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? "items-end" : "items-start"} ${sameSenderAsPrev ? "mt-1" : "mt-3"}`}
            >
              <div
                className={`max-w-[75%] break-words rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-coral text-white" : "border border-border bg-surface text-ink"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-0.5 px-1 text-[11px] text-muted">{formatTime(m.created_at)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <p className="pt-2 text-xs text-red-600 dark:text-red-400">{sendError}</p>}

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
            if (sendError) setSendError(null);
          }}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          placeholder="Type a message"
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
