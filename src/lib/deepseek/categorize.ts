import "server-only";
import { z } from "zod";
import { isDeepSeekConfigured } from "@/lib/deepseek/config";

// Separate from moderation.ts on purpose — BUILD_SPEC.md's AI HELPERS lists
// "categorize posts" and "sort the flag pile" as two distinct jobs. This is
// job 1: read a public post's body (never the private chat) and tag it with
// a topic so the feed can be filtered. Same public-data-only rule applies.

const CATEGORIES = ["repair", "ride", "yard", "moving", "talk", "other"] as const;

const CategorizeResultSchema = z.object({
  category: z.enum(CATEGORIES),
});

const SYSTEM_PROMPT = `You are a topic classifier for Neighbor, a community help board. You are shown the text of ONE public post — never any private message.

Tag it with exactly one topic:
- "repair": fixing or setting up something (a device, furniture, a home repair, tech help).
- "ride": transportation — a ride somewhere, help with a vehicle.
- "yard": outdoor/garden work — yard, hedge, lawn, snow.
- "moving": moving or carrying things — furniture, boxes, a move.
- "talk": companionship — someone to talk to, company, emotional support.
- "other": anything that doesn't clearly fit the above.

Respond with ONLY a single JSON object, no other text, in exactly this shape:
{"category": "repair" | "ride" | "yard" | "moving" | "talk" | "other"}`;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// Same reasoning as moderation.ts's timeout: this must never be allowed to
// hang post creation. An uncategorized post is a fine fallback outcome.
const CATEGORIZE_TIMEOUT_MS = 8000;

export async function categorizePostBody(body: string): Promise<(typeof CATEGORIES)[number] | null> {
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
      signal: AbortSignal.timeout(CATEGORIZE_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    return CategorizeResultSchema.parse(JSON.parse(content)).category;
  } catch {
    // Best-effort: never block or fail post creation over categorization.
    return null;
  }
}
