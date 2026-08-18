// App-wide tunables that aren't the score formula (that lives in
// supabase/schema.sql -> get_public_stats, right next to the data it reads).

export const APP_NAME = "Neighbor";

export const KIND_LABELS: Record<string, string> = {
  free: "Free",
  trade: "Trade",
  paid: "Paid",
};

export const KIND_DESCRIPTIONS: Record<string, string> = {
  free: "no exchange expected",
  trade: "swap for something",
  paid: "willing to pay",
};

// AI-assigned topic tag (see lib/deepseek/categorize.ts) — a label only, for
// scanning/filtering the feed. Order here is the order filter chips render in.
export const CATEGORY_LABELS: Record<string, string> = {
  repair: "Repair",
  ride: "Ride",
  yard: "Yard",
  moving: "Moving",
  talk: "Talk",
  other: "Other",
};

// Once this many real (non-seed) open posts exist, seed/example posts stop
// showing in the feed. Set to a low number so the room feels less empty
// fast, without seeds lingering once the board has a pulse.
export const SEED_RETIRE_THRESHOLD = 6;

// Input guards — enforced server-side in actions.ts (the real boundary) and
// mirrored as maxLength on the client inputs so typing just stops rather
// than silently getting rejected later.
export const MAX_POST_BODY_LENGTH = 2000;
export const MAX_AREA_LENGTH = 100;
export const MAX_CHAT_MESSAGE_LENGTH = 2000;
export const MAX_SUPPORT_MESSAGE_LENGTH = 2000;

// AI-assigned label on a Help & Support message (see lib/deepseek/support.ts)
// — for the owner's queue only, never shown to the user who sent it.
export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  question: "Question",
  bug: "Bug",
  suggestion: "Suggestion",
  complaint: "Complaint",
};

// The ONLY place describing the app to the Help & Support assistant
// (lib/deepseek/support.ts) — edit this to change what it knows and how it
// behaves. Injected directly into its system prompt, so keep it accurate
// and keep the ground rules (never legal/medical advice, never promise
// safety, never say verified/safe/trusted) in it.
export const SUPPORT_AI_APP_DESCRIPTION = `Neighbor is a community help board. People post needs anonymously; others raise a hand; the poster picks who gets in; then names reveal and they chat. 18+, we don't vet people, use your own judgment. Be warm, plain, and kind. Never give legal/medical advice, never promise safety, never say verified/safe/trusted, never say anything insulting or harmful. If you can't help, tell them the owner will see their message.`;

// "Facilitate, never vouch." Shown at signup and linked from the footer.
export const TERMS_TEXT = `You must be 18+ to use this app.

We connect people. We don't vet them, verify their identity, or guarantee
anything about who you meet. There is no background check, ID verification,
or safety screening of any kind.

Use your own judgment. Meeting up, helping, or being helped is entirely at
your own risk and your own responsibility.

Report anyone or anything that concerns you — reports go to a human, not an
automatic system, and nothing is auto-banned or auto-hidden.`;
