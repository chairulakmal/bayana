// AI example-sentence generation (Claude Haiku).
//
// Builds the shared prompt + per-word request, validates the model's JSON output, and
// upserts ExampleSentence rows. Used by the seed/collect scripts (and, later, an
// on-demand route). The system prompt is identical across every request and marked for
// prompt caching, so a batch of thousands pays the system tokens essentially once.

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import type { Level, GenSource } from "@/generated/prisma/enums";

export const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 300;

// Shared, identical-across-requests system prompt (so it caches well). It pins the task,
// the strict JSON schema, per-level difficulty, and how to treat placeholder entries.
const SYSTEM_PROMPT = `You write ONE natural Japanese example sentence for a JLPT vocabulary word.

Rules:
- Use the given word naturally in a single, everyday sentence.
- Match the JLPT level: N5 = very simple, N1 = advanced/idiomatic. Keep vocabulary and
  grammar at or below the target level where possible.
- If the entry contains placeholder markers (〜, ～) or parenthetical notes such as
  "(かさを〜)", use the underlying word naturally and ignore the placeholder markup.
- Output STRICT JSON only — no markdown, no commentary — exactly this shape:
  {"japanese":"<sentence>","reading":"<full hiragana reading of the whole sentence>","english":"<natural English translation>"}
- "reading" is the kana reading of the ENTIRE japanese sentence, not just the word.`;

export type GeneratedSentence = { japanese: string; reading: string; english: string };

export type WordInput = {
  expression: string;
  reading: string;
  meaning: string;
  level: Level;
};

function userText(w: WordInput): string {
  return `Word: ${w.expression}\nReading: ${w.reading}\nMeaning: ${w.meaning}\nJLPT level: ${w.level}`;
}

/** Messages API params for one word — reused for single calls AND batch requests. */
export function messageParams(
  w: WordInput,
): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText(w) }],
  };
}

/** Parse + validate the model's JSON. Returns null on anything malformed or empty, so we
 *  never store junk (SPEC §7.3). */
export function parseAndValidate(text: string): GeneratedSentence | null {
  let raw: unknown;
  try {
    // Be lenient about stray code fences, just in case the model wraps the JSON.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    raw = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const fields = ["japanese", "reading", "english"] as const;
  if (!fields.every((k) => typeof r[k] === "string" && (r[k] as string).trim())) {
    return null;
  }
  return {
    japanese: (r.japanese as string).trim(),
    reading: (r.reading as string).trim(),
    english: (r.english as string).trim(),
  };
}

/** Concatenate the text blocks of a Messages API response. */
export function textFromMessage(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Persist a generated sentence (one row per word at launch — SPEC §7.2).
 *  Replaces any existing rows for the word so re-generation is idempotent. */
export async function upsertSentence(
  wordId: string,
  data: GeneratedSentence,
  source: GenSource,
): Promise<void> {
  await db.$transaction([
    db.exampleSentence.deleteMany({ where: { wordId } }),
    db.exampleSentence.create({ data: { wordId, ...data, model: MODEL, source } }),
  ]);
}

/** One synchronous generation (used by the prompt-test path and any future on-demand route). */
export async function generateOne(
  client: Anthropic,
  w: WordInput,
): Promise<{ data: GeneratedSentence | null; usage: Anthropic.Messages.Usage }> {
  const msg = await client.messages.create(messageParams(w));
  return { data: parseAndValidate(textFromMessage(msg)), usage: msg.usage };
}
