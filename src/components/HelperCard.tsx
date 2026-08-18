import StatFace from "@/components/StatFace";
import FlagButton from "@/components/FlagButton";
import { acceptReply, declineReply } from "@/app/actions";
import type { ReplyWithReplier } from "@/lib/queries";

export default function HelperCard({
  reply,
  postId,
}: {
  reply: ReplyWithReplier;
  postId: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-coral/15 text-sm font-semibold text-coral">
            {reply.replier.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-ink">{reply.replier.display_name}</p>
            <p className="text-xs text-muted">{reply.replier.rough_area}</p>
          </div>
        </div>
        <StatFace stats={reply.stats} compact />
      </div>

      {reply.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <form action={acceptReply.bind(null, reply.id, postId)}>
            <button
              type="submit"
              className="rounded-full bg-coral px-3 py-1.5 text-sm text-white hover:bg-coral-hover"
            >
              Accept
            </button>
          </form>
          <form action={declineReply.bind(null, reply.id, postId)}>
            <button
              type="submit"
              className="rounded-full border border-border px-3 py-1.5 text-sm text-ink hover:border-coral/40"
            >
              Decline
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-muted">
          {reply.status === "accepted" ? "Accepted" : "Declined"}
        </p>
      )}

      <div className="mt-3">
        <FlagButton
          targetType="user"
          targetId={reply.replier.id}
          returnPath={`/post/${postId}`}
          label="Report this person"
        />
      </div>
    </div>
  );
}
