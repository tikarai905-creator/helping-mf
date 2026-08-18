import Link from "next/link";
import { notFound } from "next/navigation";
import KindBadge from "@/components/KindBadge";
import CategoryBadge from "@/components/CategoryBadge";
import HelperCard from "@/components/HelperCard";
import FlagButton from "@/components/FlagButton";
import { raiseHand, closePost } from "@/app/actions";
import {
  getConnectionByReplyId,
  getConnectionsForPost,
  getCurrentUser,
  getMyReply,
  getPost,
  getRepliesForPost,
  isMyPost,
} from "@/lib/queries";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const post = await getPost(id);
  if (!post) notFound();

  const owner = user ? await isMyPost(id, user.id) : false;

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/feed" className="mb-3 inline-block text-sm text-muted hover:underline">
        ‹ Back to feed
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        {post.category && <CategoryBadge category={post.category} />}
        <KindBadge kind={post.kind} />
        {post.is_seed && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-muted">
            example — not a real person
          </span>
        )}
        {post.status === "closed" && (
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-muted">closed</span>
        )}
      </div>

      <p className="mt-3 break-words text-lg leading-snug text-ink">{post.body}</p>

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          className="mt-3 aspect-[4/3] w-full rounded-2xl border border-border object-cover"
        />
      )}

      <p className="mt-2 text-sm text-muted">{post.rough_area}</p>

      {owner ? (
        <OwnerView postId={post.id} isSeed={post.is_seed} isOpen={post.status === "open"} />
      ) : (
        <VisitorView postId={post.id} isSeed={post.is_seed} isOpen={post.status === "open"} loggedIn={!!user} />
      )}

      {user && !post.is_seed && (
        <div className="mt-8 border-t border-border pt-4">
          <FlagButton
            targetType="post"
            targetId={post.id}
            returnPath={`/post/${post.id}`}
            label="Report this post"
          />
        </div>
      )}
    </div>
  );
}

async function OwnerView({
  postId,
  isSeed,
  isOpen,
}: {
  postId: string;
  isSeed: boolean;
  isOpen: boolean;
}) {
  const [replies, connections] = await Promise.all([
    getRepliesForPost(postId),
    getConnectionsForPost(postId),
  ]);
  const pending = replies.filter((r) => r.status === "pending");
  const decided = replies.filter((r) => r.status !== "pending");
  const connectionByReplyId = new Map(connections.map((c) => [c.reply_id, c]));

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">
          {pending.length > 0 ? `${pending.length} hand${pending.length > 1 ? "s" : ""} raised` : "Your post"}
        </h2>
        {isOpen && !isSeed && (
          <form action={closePost.bind(null, postId)}>
            <button type="submit" className="text-sm text-muted underline hover:text-coral">
              Close post
            </button>
          </form>
        )}
      </div>

      {isSeed && (
        <p className="mt-2 text-sm text-muted">
          This is an example post — it retires automatically once the board has real activity.
        </p>
      )}

      {!isSeed && !isOpen && (
        <p className="mt-2 text-sm text-muted">
          This post is closed — no one new can raise their hand. Anyone you already accepted is
          still in your connections below.
        </p>
      )}

      {!isSeed && isOpen && pending.length === 0 && decided.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          Your post is live — anyone nearby can see it on the feed now. Their card will show up
          right here the moment someone raises a hand.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {pending.map((r) => (
          <HelperCard key={r.id} reply={r} postId={postId} />
        ))}
        {decided.map((r) => {
          const connection = r.status === "accepted" ? connectionByReplyId.get(r.id) : undefined;
          return (
            <div key={r.id}>
              <HelperCard reply={r} postId={postId} />
              {r.status === "accepted" && connection && (
                <p className="mt-1 text-sm text-muted">
                  Chat opened — you can talk with {r.replier.display_name} now.{" "}
                  <Link href={`/chat/${connection.id}`} className="font-medium text-coral hover:underline">
                    Open the chat
                  </Link>
                  .
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function VisitorView({
  postId,
  isSeed,
  isOpen,
  loggedIn,
}: {
  postId: string;
  isSeed: boolean;
  isOpen: boolean;
  loggedIn: boolean;
}) {
  if (isSeed) {
    return (
      <p className="mt-6 rounded-2xl border border-border bg-surface p-3 text-sm text-muted shadow-soft">
        This is an example post to show how the board works — there&apos;s no real person behind
        it to help.
      </p>
    );
  }

  if (!loggedIn) {
    return (
      <p className="mt-6 text-sm text-ink">
        <a href="/login" className="font-medium text-coral hover:underline">
          Log in
        </a>{" "}
        to raise your hand on this.
      </p>
    );
  }

  const myReply = await getMyReply(postId, (await getCurrentUser())!.id);

  if (myReply) {
    if (myReply.status === "pending") {
      return (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-3 text-sm shadow-soft">
          <p className="font-medium text-ink">You raised your hand.</p>
          <p className="mt-1 text-muted">
            The poster can see your name and profile now — they&apos;ll decide who to let in. If
            they accept, a private chat opens right here and you&apos;ll see their name too.
            There&apos;s no notification for this yet, so check back on this page to see if
            they&apos;ve responded.
          </p>
        </div>
      );
    }

    if (myReply.status === "accepted") {
      const connection = await getConnectionByReplyId(myReply.id);
      return (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-3 text-sm shadow-soft">
          <p className="font-medium text-ink">You&apos;re in — the poster accepted you.</p>
          <p className="mt-1 text-muted">
            A private chat just opened between you two.{" "}
            {connection ? (
              <Link href={`/chat/${connection.id}`} className="font-medium text-coral hover:underline">
                Open the chat
              </Link>
            ) : (
              "Find it from your profile."
            )}
          </p>
        </div>
      );
    }

    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-3 text-sm shadow-soft">
        <p className="font-medium text-ink">The poster passed this time.</p>
        <p className="mt-1 text-muted">
          No hard feelings — plenty of other posts to help with.{" "}
          <Link href="/feed" className="font-medium text-coral hover:underline">
            Browse the feed
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <p className="mt-6 text-sm text-muted">
        This post is closed — the poster isn&apos;t taking new hands right now.
      </p>
    );
  }

  return (
    <form action={raiseHand.bind(null, postId)} className="mt-6">
      <button
        type="submit"
        className="rounded-full bg-coral px-4 py-2 text-white hover:bg-coral-hover"
      >
        Raise your hand
      </button>
      <p className="mt-2 text-xs text-muted">
        This shows the poster your name and profile — only them, and only if you raise your hand.
      </p>
    </form>
  );
}
