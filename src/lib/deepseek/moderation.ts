import "server-only";
import { z } from "zod";
import { isDeepSeekConfigured } from "@/lib/deepseek/config";

// This is the ONLY place the moderation AI is called, and it is only ever
// given a public post's body text — never the private 1-on-1 chat. See
// BUILD_SPEC.md's AI HELPERS section: AI sorts, the owner decides.

const ModerationResultSchema = z.object({
  category: z.enum(["offensive", "spam", "none"]),
  draft_message: z.string().nullable(),
});

export type ModerationResult = z.infer<typeof ModerationResultSchema>;

const SYSTEM_PROMPT = `You are a content moderation classifier for Neighbor, a community help board. You are shown the text of ONE public post — never any private message.

Classify the post into exactly one category:
- "offensive": slurs, harassment, hate speech, threats, or explicit sexual content.
- "spam": advertising, scams, or repeated promotional content that isn't a genuine community post.
- "none": an ordinary, acceptable post — even if blunt, informal, or about a sensitive topic like needing money, being lonely, or a personal hardship. Sensitive topics are NOT offensive by themselves.

Be conservative. Only flag clear, unambiguous cases. When in doubt, choose "none".

If the category is "offensive" or "spam", write draft_message: a short, calm, specific note addressed directly to the poster (2-4 sentences). Name what's wrong in plain terms, ask them to edit or remove the post, and give them 2 days to do so. Do not threaten, moralize, or lecture. If the category is "none", draft_message must be null.

Respond with ONLY a single JSON object, no other text, in exactly this shape:
{"category": "offensive" | "spam" | "none", "draft_message": string or null}`;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// Posting is awaited on this call finishing (see scanPostForModeration in
// actions.ts), so it must never be allowed to hang — a slow or unreachable
// DeepSeek is a worse outcome than an unmoderated post. Past this, the post
// goes through unscanned and stays eligible for a later rescan (ai_scanned
// is only set true on an actual response).
const MODERATION_TIMEOUT_MS = 8000;

export async function moderatePostBody(body: string): Promise<ModerationResult | null> {
  if (!isDeepSeekConfigured()) return null;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: body },
        ],
      }),
      signal: AbortSignal.timeout(MODERATION_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    return ModerationResultSchema.parse(JSON.parse(content));
  } catch {
    // Best-effort: a moderation-scan failure or timeout should never block
    // posting — the post goes through unmoderated instead of freezing.
    return null;
  }
}
