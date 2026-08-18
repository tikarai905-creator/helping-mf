"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { moderatePostBody } from "@/lib/deepseek/moderation";
import { categorizePostBody } from "@/lib/deepseek/categorize";
import { classifySupportMessage, getSupportAssistantReply } from "@/lib/deepseek/support";
import { getUnscannedOpenPosts } from "@/lib/queries";
import {
  MAX_AREA_LENGTH,
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_POST_BODY_LENGTH,
  MAX_SUPPORT_MESSAGE_LENGTH,
} from "@/lib/config";
import type { ConfirmStatus, FlagTargetType, MessageRow, PostKind, SupportMessageRow } from "@/lib/database.types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const roughArea = String(formData.get("rough_area") ?? "").trim();
  const age = Number(formData.get("age"));
  const agreed = formData.get("agree") === "on";

  if (!email || !password || !displayName || !roughArea || !age) {
    fail("/signup", "Please fill in every field.");
  }
  if (!agreed) {
    fail("/signup", "You must confirm you're 18+ and accept the terms.");
  }
  if (age < 18) {
    fail("/signup", "You must be 18+ to use this app.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        rough_area: roughArea,
        age,
      },
    },
  });

  if (error) fail("/signup", error.message);

  // First screen a brand-new user sees — the feed page shows a one-glance
  // "how this works" banner when this param is present.
  redirect("/feed?welcome=1");
}

export async function logIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) fail("/login", error.message);

  redirect("/feed");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// POSTS
// ---------------------------------------------------------------------------

export async function createPost(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  const roughArea = String(formData.get("rough_area") ?? "").trim();
  const kind = String(formData.get("kind") ?? "free") as PostKind;

  if (!body || !roughArea) {
    fail("/feed/new", "Please describe the need and an area.");
  }
  if (body.length > MAX_POST_BODY_LENGTH) {
    fail("/feed/new", `Please keep it under ${MAX_POST_BODY_LENGTH} characters.`);
  }
  if (roughArea.length > MAX_AREA_LENGTH) {
    fail("/feed/new", `Area name is too long — keep it under ${MAX_AREA_LENGTH} characters.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: user!.id, body, rough_area: roughArea, kind })
    .select("id")
    .single();

  if (error) fail("/feed/new", error.message);

  await scanPostForModeration(supabase, data!.id, body);
  await categorizePost(supabase, data!.id, body);

  revalidatePath("/feed");
  redirect(`/post/${data!.id}`);
}

// Best-effort AI scan of a public post's text (never the private chat) —
// see BUILD_SPEC.md AI HELPERS. Never blocks or fails the post action.
async function scanPostForModeration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  body: string
) {
  try {
    const result = await moderatePostBody(body);
    if (!result) return;

    if (result.category === "none") {
      await supabase.rpc("mark_post_ai_clean", { target_post_id: postId });
    } else {
      await supabase.rpc("record_ai_moderation", {
        target_post_id: postId,
        result_category: result.category,
        result_draft_message: result.draft_message,
      });
    }
  } catch {
    // Moderation is additive — a failure here should never affect posting.
  }
}

// Separate best-effort AI pass — topic tagging (repair/ride/yard/moving/talk/
// other), not moderation. Same public-text-only, never-blocks-posting rules.
async function categorizePost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  body: string
) {
  try {
    const category = await categorizePostBody(body);
    if (!category) return;
    await supabase.rpc("record_post_category", { target_post_id: postId, result_category: category });
  } catch {
    // Categorization is additive — a failure here should never affect posting.
  }
}

export async function closePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("posts").update({ status: "closed" }).eq("id", postId).eq("author_id", user.id);

  revalidatePath(`/post/${postId}`);
  revalidatePath("/feed");
}

// Lets a poster manage their own post from their profile instead of hunting
// the feed for it. Column grant is posts_update_own (body, status, kind,
// rough_area) — the .eq("author_id", ...) below is belt-and-suspenders on
// top of that RLS check, not the only thing enforcing ownership.
export async function updatePost(postId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  const roughArea = String(formData.get("rough_area") ?? "").trim();
  const kind = String(formData.get("kind") ?? "free") as PostKind;

  if (!body || !roughArea) {
    fail(`/post/${postId}/edit`, "Please describe the need and an area.");
  }
  if (body.length > MAX_POST_BODY_LENGTH) {
    fail(`/post/${postId}/edit`, `Please keep it under ${MAX_POST_BODY_LENGTH} characters.`);
  }
  if (roughArea.length > MAX_AREA_LENGTH) {
    fail(`/post/${postId}/edit`, `Area name is too long — keep it under ${MAX_AREA_LENGTH} characters.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("posts")
    .update({ body, rough_area: roughArea, kind })
    .eq("id", postId)
    .eq("author_id", user.id);
  if (error) fail(`/post/${postId}/edit`, error.message);

  revalidatePath(`/post/${postId}`);
  revalidatePath("/feed");
  revalidatePath("/profile");
  redirect(`/post/${postId}`);
}

// Same cascade as deletePostAdmin below (replies/connections/messages tied
// to this post go with it) — the client shows the same warning before
// calling this. Owner-only via posts_delete_own RLS + the author_id check.
export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", user.id);
  if (error) throw error;

  revalidatePath("/feed");
  revalidatePath("/profile");
}

// ---------------------------------------------------------------------------
// REPLIES (raise a hand) + ACCEPT / DECLINE
// ---------------------------------------------------------------------------

export async function raiseHand(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("replies")
    .insert({ post_id: postId, replier_id: user!.id });

  if (error) fail(`/post/${postId}`, error.message);

  revalidatePath(`/post/${postId}`);
}

export async function acceptReply(replyId: string, postId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_reply", { target_reply_id: replyId });
  if (error) fail(`/post/${postId}`, error.message);

  revalidatePath(`/post/${postId}`);
  revalidatePath("/profile");
}

export async function declineReply(replyId: string, postId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_reply", { target_reply_id: replyId });
  if (error) fail(`/post/${postId}`, error.message);

  revalidatePath(`/post/${postId}`);
}

// ---------------------------------------------------------------------------
// CONFIRM
// ---------------------------------------------------------------------------

export async function confirmConnection(connectionId: string, result: ConfirmStatus) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_connection", {
    target_connection_id: connectionId,
    result,
  });
  if (error) fail(`/chat/${connectionId}`, error.message);

  revalidatePath(`/chat/${connectionId}`);
  revalidatePath("/profile");
}

// ---------------------------------------------------------------------------
// CHAT
// ---------------------------------------------------------------------------

export async function sendMessage(connectionId: string, body: string): Promise<MessageRow | null> {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new Error(`Message is too long — keep it under ${MAX_CHAT_MESSAGE_LENGTH} characters.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Returns the inserted row so the sender can show their own message
  // immediately, with the same id/timestamp realtime would otherwise
  // deliver — no need to wait on the websocket round trip for your own send.
  const { data, error } = await supabase
    .from("messages")
    .insert({ connection_id: connectionId, sender_id: user!.id, body: trimmed })
    .select()
    .single();

  if (error) throw error;

  revalidatePath(`/chat/${connectionId}`);
  return data as MessageRow;
}

// ---------------------------------------------------------------------------
// FLAGS
// ---------------------------------------------------------------------------

export async function fileFlag(
  targetType: FlagTargetType,
  targetId: string,
  reason: string,
  returnPath: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("flags").insert({
    flagger_id: user!.id,
    target_type: targetType,
    target_id: targetId,
    reason: reason.trim() || null,
  });

  revalidatePath(returnPath);
}

export async function markFlagReviewed(flagId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("flags").update({ reviewed: true }).eq("id", flagId);
  if (error) throw error;
  revalidatePath("/admin/flags");
}

// ---------------------------------------------------------------------------
// AI MODERATION QUEUE (owner-only, never auto-sends or auto-deletes)
// ---------------------------------------------------------------------------

export async function scanUnscannedPosts() {
  const supabase = await createClient();
  const posts = await getUnscannedOpenPosts(20);

  for (const post of posts) {
    await scanPostForModeration(supabase, post.id, post.body);
    await categorizePost(supabase, post.id, post.body);
  }

  revalidatePath("/admin/moderation");
}

export async function sendModerationWarning(flagId: string, messageBody: string) {
  const trimmed = messageBody.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_moderation_warning", {
    target_flag_id: flagId,
    message_body: trimmed,
  });
  if (error) throw error;

  revalidatePath("/admin/moderation");
}

export async function skipModerationFlag(flagId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("skip_moderation_flag", { target_flag_id: flagId });
  if (error) throw error;

  revalidatePath("/admin/moderation");
}

export async function deletePostAdmin(postId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;

  revalidatePath("/admin/moderation");
  revalidatePath("/admin/flags");
  revalidatePath("/feed");
}

// ---------------------------------------------------------------------------
// ADMIN DIRECT MESSAGING (owner -> any user, manual, separate from AI warnings)
// ---------------------------------------------------------------------------

export async function sendAdminMessage(recipientId: string, formData: FormData) {
  const trimmed = String(formData.get("body") ?? "").trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("admin_messages")
    .insert({ admin_id: user!.id, recipient_id: recipientId, body: trimmed });
  if (error) throw error;

  revalidatePath(`/admin/messages/${recipientId}`);
}

export async function markAdminMessageRead(messageId: string) {
  const supabase = await createClient();
  await supabase.from("admin_messages").update({ read_at: new Date().toISOString() }).eq("id", messageId);
}

// Hides a warning from the recipient's own "Messages from the app owner"
// list — never deletes it. The admin's record (and their own thread view at
// /admin/messages/[userId]) is untouched by this; getAdminMessagesForRecipient
// still returns it, only the profile page filters dismissed ones out.
export async function dismissAdminMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("admin_messages")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("recipient_id", user.id);
  if (error) throw error;

  revalidatePath("/profile");
}

// ---------------------------------------------------------------------------
// HELP & SUPPORT (public data only — never the private 1-on-1 chat)
// ---------------------------------------------------------------------------

// Classify + reply are independent DeepSeek calls (see lib/deepseek/support.ts)
// run in parallel here. The user's message is inserted directly (RLS: own
// sender='user' row); the assistant's reply goes through a security-definer
// RPC since no insert policy grants sender='assistant' to a plain client.
// Returns both rows so the chat can append them without a full reload.
export async function sendSupportMessage(
  body: string
): Promise<{ userMessage: SupportMessageRow; assistantMessage: SupportMessageRow } | null> {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_SUPPORT_MESSAGE_LENGTH) {
    throw new Error(`Please keep it under ${MAX_SUPPORT_MESSAGE_LENGTH} characters.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [category, replyText] = await Promise.all([
    classifySupportMessage(trimmed),
    getSupportAssistantReply(trimmed),
  ]);

  const { data: userMessage, error: insertError } = await supabase
    .from("support_messages")
    .insert({ user_id: user!.id, sender: "user", body: trimmed, ai_category: category })
    .select()
    .single();
  if (insertError) throw insertError;

  // Never leave the user with silence just because DeepSeek is slow, down,
  // or unconfigured — a plain fallback still tells them what happens next.
  const assistantBody =
    replyText ??
    "Sorry, I couldn't get a response just now — the app owner will see your message and can follow up.";

  const { data: assistantMessage, error: rpcError } = await supabase.rpc("record_support_assistant_reply", {
    target_user_id: user!.id,
    assistant_body: assistantBody,
  });
  if (rpcError) throw rpcError;

  revalidatePath("/help");
  return {
    userMessage: userMessage as SupportMessageRow,
    assistantMessage: assistantMessage as SupportMessageRow,
  };
}

// Owner-only — clears the unreviewed count for one user's thread.
export async function markSupportThreadReviewed(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("support_messages")
    .update({ reviewed: true })
    .eq("user_id", userId)
    .eq("sender", "user")
    .eq("reviewed", false);
  if (error) throw error;

  revalidatePath(`/admin/support/${userId}`);
  revalidatePath("/admin/support");
}

// A wrongly-warned user's only way to respond — routes into the same owner
// queue as the Help chat (support_messages) rather than a second reply
// channel, tagged with which warning it's answering. No automatic AI reply
// here: a moderation dispute goes to the human owner, not a chatbot — the
// owner can respond through the existing admin messaging tool once they've
// looked at it.
export async function replyToAdminMessage(adminMessageId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: original } = await supabase
    .from("admin_messages")
    .select("id, recipient_id")
    .eq("id", adminMessageId)
    .maybeSingle();
  if (!original || original.recipient_id !== user.id) {
    throw new Error("That message isn't yours to reply to.");
  }

  const category = await classifySupportMessage(trimmed);

  const { error } = await supabase.from("support_messages").insert({
    user_id: user.id,
    sender: "user",
    body: trimmed,
    ai_category: category,
    related_admin_message_id: adminMessageId,
  });
  if (error) throw error;

  revalidatePath("/profile");
}
