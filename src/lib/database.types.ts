export type PostKind = "free" | "trade" | "paid";
export type PostStatus = "open" | "closed";
export type ReplyStatus = "pending" | "accepted" | "declined";
export type ConfirmStatus = "good" | "didnt_happen" | "bad";
export type FlagTargetType = "post" | "user";
export type FlagSource = "user" | "ai";
export type FlagResolution = "warned" | "skipped" | "post_deleted" | "duplicate";
export type ModerationCategory = "offensive" | "spam" | "none";
export type PostCategory = "repair" | "ride" | "yard" | "moving" | "talk" | "other";
export type SupportSender = "user" | "assistant";
export type SupportCategory = "question" | "bug" | "suggestion" | "complaint";

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  profile_photo_url: string | null;
  rough_area: string;
  age: number;
  is_admin: boolean;
  created_at: string;
}

// What a replier or connected peer is allowed to know about you — backed by
// the users_public view, which never selects email or age.
export type PublicUserRow = Pick<UserRow, "id" | "display_name" | "profile_photo_url" | "rough_area">;

export interface PostRow {
  id: string;
  author_id: string | null;
  body: string;
  rough_area: string;
  kind: PostKind;
  status: PostStatus;
  is_seed: boolean;
  category: PostCategory | null;
  ai_scanned: boolean;
  image_url: string | null;
  created_at: string;
}

// What the feed is allowed to know about a post — never author_id.
export type FeedPostRow = Omit<PostRow, "author_id">;

export interface ReplyRow {
  id: string;
  post_id: string;
  replier_id: string;
  status: ReplyStatus;
  created_at: string;
}

export interface ConnectionRow {
  id: string;
  post_id: string;
  reply_id: string | null;
  helper_id: string;
  receiver_id: string;
  first_connected_at: string;
  is_repeat: boolean;
  confirmed_status: ConfirmStatus | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface FlagRow {
  id: string;
  flagger_id: string | null;
  target_type: FlagTargetType;
  target_id: string;
  reason: string | null;
  ai_category: string | null;
  source: FlagSource;
  draft_message: string | null;
  resolution: FlagResolution | null;
  reviewed: boolean;
  created_at: string;
}

export interface AdminMessageRow {
  id: string;
  admin_id: string;
  recipient_id: string;
  body: string;
  related_flag_id: string | null;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

export interface MessageRow {
  id: string;
  connection_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface SupportMessageRow {
  id: string;
  user_id: string;
  sender: SupportSender;
  body: string;
  ai_category: SupportCategory | null;
  related_admin_message_id: string | null;
  reviewed: boolean;
  created_at: string;
}

export interface PublicStats {
  helped_count: number;
  score: number;
  got_helped_count: number;
}
