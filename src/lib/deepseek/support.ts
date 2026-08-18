import "server-only";
import { z } from "zod";
import { isDeepSeekConfigured } from "@/lib/deepseek/config";
import { SUPPORT_AI_APP_DESCRIPTION } from "@/lib/config";

// Two separate jobs, same one-job-per-classifier discipline as
// moderation.ts / categorize.ts: sorting a message for the owner's queue
// and answering the user are independent calls with independent prompts,
// run in parallel by the caller (sendSupportMessage in actions.ts). Both
// read ONLY the text of one support message — never the private 1-on-1
// chat between matched users.

const SUPPORT_CATEGORIES = ["question", "bug", "suggestion", "complaint"] as const;
export type SupportCategoryResult = (typeof SUPPORT_CATEGORIES)[number];

const CategoryResultSchema = z.object({ category: z.enum(SUPPORT_CATEGORIES) });
const ReplyResultSchema = z.object({ reply: z.string() });

const CATEGORY_SYSTEM_PROMPT = `You are sorting a message a user sent to Neighbor's Help & Support. Tag it with exactly one category:
- "question": asking how something works.
- "bug": something broken or not behaving as expected.
- "suggestion": an idea to improve the app.
- "complaint": unhappy about something that happened — this includes a reply to a warning from the app owner.

Respond with ONLY a single JSON object, no other text, in exactly this shape:
{"category": "question" | "bug" | "suggestion" | "complaint"}`;

// SUPPORT_AI_APP_DESCRIPTION (lib/config.ts) is the one editable place for
// what this assistant knows and how it should behave — it's injected here,
// not duplicated.
const REPLY_SYSTEM_PROMPT = `You are the Help & Support assistant for Neighbor. A user sent you ONE message — never any private chat. Here is what you know about the app:

${SUPPORT_AI_APP_DESCRIPTION}

Answer in 2-4 short, plain sentences. No markdown, no bullet points, no links.

Respond with ONLY a single JSON object, no other text, in exactly this shape:
{"reply": "your answer"}`;

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// Same reasoning as moderation.ts's timeout: a slow or unreachable DeepSeek
// must never hang the request. The caller (sendSupportMessage) falls back
// to a plain "the owner will see this" reply rather than leaving the user
// with silence — see actions.ts.
const SUPPORT_TIMEOUT_MS = 8000;

async function callDeepSeek(systemPrompt: string, userBody: string): Promise<string | null> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userBody },
      ],
    }),
    signal: AbortSignal.timeout(SUPPORT_TIMEOUT_MS),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

export async function classifySupportMessage(body: string): Promise<SupportCategoryResult | null> {
  if (!isDeepSeekConfigured()) return null;

  try {
    const content = await callDeepSeek(CATEGORY_SYSTEM_PROMPT, body);
    if (!content) return null;
    return CategoryResultSchema.parse(JSON.parse(content)).category;
  } catch {
    return null;
  }
}

export async function getSupportAssistantReply(body: string): Promise<string | null> {
  if (!isDeepSeekConfigured()) return null;

  try {
    const content = await callDeepSeek(REPLY_SYSTEM_PROMPT, body);
    if (!content) return null;
    return ReplyResultSchema.parse(JSON.parse(content)).reply;
  } catch {
    return null;
  }
}
