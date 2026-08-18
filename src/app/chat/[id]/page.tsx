import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StatFace from "@/components/StatFace";
import ConfirmBar from "@/components/ConfirmBar";
import ChatWindow from "@/components/ChatWindow";
import FlagButton from "@/components/FlagButton";
import {
  getConnection,
  getCurrentUser,
  getMessages,
  getPeerForConnection,
  getPublicStats,
} from "@/lib/queries";
import type { ConfirmStatus } from "@/lib/database.types";

// The confirm step used to just print "Confirmed: good" in tiny gray text —
// a silent change instead of a clear done state. This spells out what
// happened and what it means, worded differently for whichever side of the
// connection is reading it.
function confirmHeadline(status: ConfirmStatus, isReceiver: boolean): string {
  if (status === "good") return isReceiver ? "Done — thanks, this counted!" : "Confirmed good — thanks for helping!";
  if (status === "didnt_happen") return "Marked as didn't happen.";
  return "Confirmed as bad.";
}

function confirmBlockClass(status: ConfirmStatus): string {
  if (status === "good") return "border-teal/25 bg-teal/5";
  if (status === "bad") return "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950";
  return "border-border bg-surface";
}

function confirmDetail(status: ConfirmStatus, isReceiver: boolean, peerName: string): string {
  if (status === "good") {
    return isReceiver
      ? `This counts toward ${peerName}'s helped total.`
      : `${peerName} confirmed this went well.`;
  }
  if (status === "didnt_happen") {
    return isReceiver
      ? "Noted — no impact on either of your numbers."
      : `${peerName} marked this as not having happened.`;
  }
  return isReceiver
    ? "Thanks for letting us know — the app owner can review this if needed."
    : `${peerName} confirmed this as bad. If you think that's wrong, you can report it below.`;
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const connection = await getConnection(id);
  if (!connection) notFound();
  if (connection.helper_id !== user.id && connection.receiver_id !== user.id) notFound();

  const peer = await getPeerForConnection(connection, user.id);
  if (!peer) notFound();

  const [messages, peerStats] = await Promise.all([getMessages(id), getPublicStats(peer.id)]);

  const isReceiver = connection.receiver_id === user.id;

  return (
    <div className="flex h-[calc(100dvh-155px)] flex-col">
      <Link
        href={`/post/${connection.post_id}`}
        className="mb-2 inline-block w-fit text-sm text-muted hover:underline"
      >
        ‹ Back to post
      </Link>

      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-coral/15 text-sm font-semibold text-coral">
            {peer.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-ink">{peer.display_name}</p>
            <p className="text-xs text-muted">{peer.rough_area}</p>
          </div>
        </div>
        <StatFace stats={peerStats} compact />
      </div>

      {isReceiver && connection.confirmed_status === null && (
        <div className="mb-4 mt-3">
          <ConfirmBar connectionId={connection.id} />
        </div>
      )}

      {connection.confirmed_status && (
        <div
          className={`mb-4 mt-3 rounded-2xl border p-4 text-sm shadow-soft ${confirmBlockClass(connection.confirmed_status)}`}
        >
          <p className="font-semibold text-ink">{confirmHeadline(connection.confirmed_status, isReceiver)}</p>
          <p className="mt-1 text-muted">
            {confirmDetail(connection.confirmed_status, isReceiver, peer.display_name)}
          </p>
        </div>
      )}

      <ChatWindow connectionId={connection.id} currentUserId={user.id} initialMessages={messages} />

      <div className="border-t border-border pt-3">
        <FlagButton
          targetType="user"
          targetId={peer.id}
          returnPath={`/chat/${connection.id}`}
          label="Report this person"
        />
      </div>
    </div>
  );
}
