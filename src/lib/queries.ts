import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SEED_RETIRE_THRESHOLD } from "@/lib/config";
import type {
  AdminMessageRow,
  ConnectionRow,
  FeedPostRow,
  FlagRow,
  MessageRow,
  PostKind,
  PostRow,
  PostStatus,
  PublicStats,
  PublicUserRow,
  ReplyRow,
  SupportCategory,
  SupportMessageRow,
  UserRow,
} from "@/lib/database.types";

export async function getCurrentUser(): Promise<UserRow | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as UserRow) ?? null;
}

// posts_feed is a view with no author_id column at all — RLS on the base
// posts table backs this up (you can only ever select your own row there),
// so anonymity holds even against a client hitting the API directly.
export async function getFeedPosts(roughArea: string | null, showAllAreas: boolean) {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  let query = supabase
    .from("posts_feed")
    .select("*")
    .order("created_at", { ascending: false });

  if (!showAllAreas && roughArea) {
    query = query.ilike("rough_area", roughArea);
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []) as FeedPostRow[];
  const realCount = posts.filter((p) => !p.is_seed).length;

  if (realCount >= SEED_RETIRE_THRESHOLD) {
    return posts.filter((p) => !p.is_seed);
  }
  return posts;
}

export async function getMyPosts(userId: string): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PostRow[];
}

export async function getPost(postId: string): Promise<FeedPostRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts_feed")
    .select("*")
    .eq("id", postId)
    .single();
  if (!error) return data as FeedPostRow;

  // posts_feed only shows open posts, so a closed post 404s here even for
  // its own owner. Fall back to the base table — RLS only returns a row if
  // the caller is the author (any status) or an admin.
  const { data: ownPost, error: ownError } = await supabase
    .from("posts")
    .select("id, body, rough_area, kind, status, is_seed, category, ai_scanned, image_url, created_at")
    .eq("id", postId)
    .single();
  if (ownError) return null;
  return ownPost as FeedPostRow;
}

export async function isMyPost(postId: string, userId: string): Promise<boolean> {
  // Can't infer ownership from "a row came back" anymore — posts_select_involved
  // (schema.sql) also lets a replier/helper read this row so a closed post
  // isn't a dead end for them, so a non-owner can get a row back here too.
  // Check author_id explicitly.
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
  return data?.author_id === userId;
}

export async function getMyReply(postId: string, userId: string): Promise<ReplyRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("replies")
    .select("*")
    .eq("post_id", postId)
    .eq("replier_id", userId)
    .maybeSingle();
  return (data as ReplyRow) ?? null;
}

export interface ReplyWithReplier extends ReplyRow {
  replier: PublicUserRow;
  stats: PublicStats;
}

// Fetched in two steps because users_public is a view (safe columns only —
// no email/age), and PostgREST's `table!fk_constraint(...)` embedding syntax
// only works against base tables with a real FK constraint to key off of.
export async function getRepliesForPost(postId: string): Promise<ReplyWithReplier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("replies")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as ReplyRow[];
  const replierIds = [...new Set(rows.map((r) => r.replier_id))];
  const { data: repliers } =
    replierIds.length > 0
      ? await supabase.from("users_public").select("*").in("id", replierIds)
      : { data: [] as PublicUserRow[] };
  const replierMap = new Map(((repliers ?? []) as PublicUserRow[]).map((u) => [u.id, u]));

  const withStats = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      replier: replierMap.get(r.replier_id)!,
      stats: await getPublicStats(r.replier_id),
    }))
  );
  return withStats;
}

export async function getPublicStats(userId: string): Promise<PublicStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_public_stats", { target_user_id: userId })
    .single();
  if (error || !data) {
    return { helped_count: 0, score: 50, got_helped_count: 0 };
  }
  return data as PublicStats;
}

export interface ConnectionWithPeer extends ConnectionRow {
  peer: PublicUserRow;
  role: "helper" | "receiver";
}

export async function getMyConnections(userId: string): Promise<ConnectionWithPeer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .or(`helper_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ConnectionRow[];
  const peerIds = [
    ...new Set(rows.map((row) => (row.helper_id === userId ? row.receiver_id : row.helper_id))),
  ];
  const { data: peers } =
    peerIds.length > 0
      ? await supabase.from("users_public").select("*").in("id", peerIds)
      : { data: [] as PublicUserRow[] };
  const peerMap = new Map(((peers ?? []) as PublicUserRow[]).map((u) => [u.id, u]));

  return rows.map((row) => {
    const isHelper = row.helper_id === userId;
    const peerId = isHelper ? row.receiver_id : row.helper_id;
    return {
      ...row,
      peer: peerMap.get(peerId)!,
      role: isHelper ? "helper" : "receiver",
    } as ConnectionWithPeer;
  });
}

// All connections tied to one post — used on the poster's own post page to
// link straight to the chat for each accepted reply, instead of making them
// go hunt for it on their profile.
export async function getConnectionsForPost(postId: string): Promise<ConnectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("connections").select("*").eq("post_id", postId);
  if (error) throw error;
  return (data ?? []) as ConnectionRow[];
}

// The connection created when THIS reply was accepted — used on the
// replier's side ("you're in!") to link straight to the chat.
export async function getConnectionByReplyId(replyId: string): Promise<ConnectionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("connections").select("*").eq("reply_id", replyId).maybeSingle();
  return (data as ConnectionRow) ?? null;
}

export async function getConnection(connectionId: string): Promise<ConnectionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .single();
  return (data as ConnectionRow) ?? null;
}

export async function getPeerForConnection(
  connection: ConnectionRow,
  userId: string
): Promise<PublicUserRow | null> {
  const peerId = connection.helper_id === userId ? connection.receiver_id : connection.helper_id;
  const supabase = await createClient();
  const { data } = await supabase.from("users_public").select("*").eq("id", peerId).single();
  return (data as PublicUserRow) ?? null;
}

export async function getMessages(connectionId: string): Promise<MessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

// User-filed reports only — the AI moderation queue has its own query below.
export async function getFlags(): Promise<(FlagRow & { flagger: UserRow })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flags")
    .select("*, flagger:users!flags_flagger_id_fkey(*)")
    .eq("source", "user")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (FlagRow & { flagger: UserRow })[];
}

// ---------------------------------------------------------------------------
// AI MODERATION QUEUE + ADMIN MESSAGING
// ---------------------------------------------------------------------------

export interface ModerationQueueItem extends FlagRow {
  post: PostRow;
  authorName: string | null;
}

export async function getModerationQueue(): Promise<ModerationQueueItem[]> {
  const supabase = await createClient();
  const { data: flags, error } = await supabase
    .from("flags")
    .select("*")
    .eq("source", "ai")
    .is("resolution", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const flagRows = (flags ?? []) as FlagRow[];
  if (flagRows.length === 0) return [];

  const postIds = [...new Set(flagRows.map((f) => f.target_id))];
  const { data: posts } = await supabase.from("posts").select("*").in("id", postIds);
  const postMap = new Map(((posts ?? []) as PostRow[]).map((p) => [p.id, p]));

  const authorIds = [...postMap.values()]
    .map((p) => p.author_id)
    .filter((id): id is string => !!id);
  const { data: users } =
    authorIds.length > 0
      ? await supabase.from("users").select("*").in("id", [...new Set(authorIds)])
      : { data: [] as UserRow[] };
  const userMap = new Map(((users ?? []) as UserRow[]).map((u) => [u.id, u]));

  const items: ModerationQueueItem[] = [];
  for (const f of flagRows) {
    const post = postMap.get(f.target_id);
    if (!post) continue;
    items.push({
      ...f,
      post,
      authorName: post.author_id ? (userMap.get(post.author_id)?.display_name ?? null) : null,
    });
  }
  return items;
}

export async function getUnscannedOpenPosts(limit = 20): Promise<PostRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "open")
    .eq("is_seed", false)
    .eq("ai_scanned", false)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PostRow[];
}

export async function getAllUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*").order("display_name");
  if (error) throw error;
  return (data ?? []) as UserRow[];
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  return (data as UserRow) ?? null;
}

// ---------------------------------------------------------------------------
// ADMIN ACTIVITY LOG — every post on the app, not just flagged ones. The
// owner's window into the whole board. Admin-only (posts_select_admin_all +
// users_select_admin_all RLS policies).
// ---------------------------------------------------------------------------

export interface AdminPostRow extends PostRow {
  authorName: string | null;
  moderationLabel: string | null;
}

export interface AdminPostFilters {
  kind?: PostKind | "all";
  status?: PostStatus | "all";
  area?: string;
}

export async function getAllPostsForAdmin(filters: AdminPostFilters = {}): Promise<AdminPostRow[]> {
  const supabase = await createClient();

  let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
  if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.area?.trim()) query = query.ilike("rough_area", `%${filters.area.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;
  const posts = (data ?? []) as PostRow[];
  if (posts.length === 0) return [];

  const authorIds = [...new Set(posts.map((p) => p.author_id).filter((id): id is string => !!id))];
  const { data: users } =
    authorIds.length > 0
      ? await supabase.from("users").select("id, display_name").in("id", authorIds)
      : { data: [] as { id: string; display_name: string }[] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));

  const postIds = posts.map((p) => p.id);
  const { data: flags } = await supabase
    .from("flags")
    .select("target_id, ai_category, resolution")
    .eq("source", "ai")
    .in("target_id", postIds)
    .order("created_at", { ascending: false });

  // Most recent AI flag per post — order desc means first-seen wins.
  const flagMap = new Map<string, { ai_category: string | null; resolution: string | null }>();
  for (const f of (flags ?? []) as { target_id: string; ai_category: string | null; resolution: string | null }[]) {
    if (!flagMap.has(f.target_id)) flagMap.set(f.target_id, f);
  }

  return posts.map((p) => {
    const flag = flagMap.get(p.id);
    let moderationLabel: string | null;
    if (p.is_seed) {
      moderationLabel = null;
    } else if (flag) {
      moderationLabel = `${flag.ai_category} (${flag.resolution ?? "pending"})`;
    } else if (p.ai_scanned) {
      moderationLabel = "clean";
    } else {
      moderationLabel = "not scanned";
    }

    return {
      ...p,
      authorName: p.author_id ? (userMap.get(p.author_id) ?? "unknown") : null,
      moderationLabel,
    };
  });
}

export async function getAdminMessagesForRecipient(recipientId: string): Promise<AdminMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_messages")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdminMessageRow[];
}

// ---------------------------------------------------------------------------
// HELP & SUPPORT — a user's own thread (support_messages_select_own RLS) or,
// for an admin, any user's thread (support_messages_select_admin_all). Same
// function serves both /help and /admin/support/[userId] — RLS decides what
// a given caller is actually allowed to see.
// ---------------------------------------------------------------------------
export async function getSupportMessagesForUser(userId: string): Promise<SupportMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportMessageRow[];
}

export interface SupportThreadSummary {
  userId: string;
  displayName: string;
  lastMessage: string;
  lastCategory: SupportCategory | null;
  lastAt: string;
  unreviewedCount: number;
}

// Admin-only view of every support thread, one row per user, newest activity
// first. Fetches the flat table then groups in app code — same style as
// getModerationQueue/getAllPostsForAdmin above.
export async function getSupportThreadSummaries(): Promise<SupportThreadSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as SupportMessageRow[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = await supabase.from("users").select("id, display_name").in("id", userIds);
  const nameMap = new Map(
    ((users ?? []) as { id: string; display_name: string }[]).map((u) => [u.id, u.display_name])
  );

  const byUser = new Map<string, SupportMessageRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  const summaries: SupportThreadSummary[] = [];
  for (const [userId, msgs] of byUser) {
    const last = msgs[msgs.length - 1];
    const lastUserMsg = [...msgs].reverse().find((m) => m.sender === "user");
    summaries.push({
      userId,
      displayName: nameMap.get(userId) ?? "unknown",
      lastMessage: last.body,
      lastCategory: lastUserMsg?.ai_category ?? null,
      lastAt: last.created_at,
      unreviewedCount: msgs.filter((m) => m.sender === "user" && !m.reviewed).length,
    });
  }
  return summaries.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}
