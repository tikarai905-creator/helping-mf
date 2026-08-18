"use client";

import { useTransition } from "react";
import { deletePost } from "@/app/actions";

export default function DeletePostButton({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            "Delete this post? This also removes any replies, connections, and chat tied to it. This cannot be undone."
          )
        ) {
          return;
        }
        startTransition(() => deletePost(postId));
      }}
      className="text-xs text-muted hover:text-red-600 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
