// The shape a Flashcard session renders, and the one place it is built.
//
// Why this module exists: `getStudyQueue` (lib/review.ts) returns Prisma rows, so every due
// card arrived carrying its full FSRS internals — `stability`, `difficulty`, `reps`,
// `lapses`, `elapsedDays`, `scheduledDays`, `state`, `lastReview`, `due` — plus the whole
// joined `Word` row, and the client read none of it: `study-session.tsx` flattened each row
// to five fields on arrival and dropped the rest. The scheduling state is the server's
// business, and shipping it to a browser that cannot act on it is payload with no consumer.
//
// It lives here rather than in either caller because there are now two: the `/study` page
// renders the first session server-side, and `GET /api/cards/queue` still serves the
// imperative refetch ("Check for more", the retry). One definition means the two cannot
// disagree about the shape, which is the failure mode that made a shared module worth the
// indirection.

import { getStudyQueue } from "@/lib/review";
import type { Level } from "@/generated/prisma/client";

/** One card exactly as the session renders it. No scheduling internals by design. */
export type StudyCard = {
  wordId: string;
  expression: string;
  reading: string;
  meaning: string;
  /** The first cached example sentence, or null for a word with none seeded yet. */
  sentence: { japanese: string; reading: string; english: string } | null;
};

/** One session's worth of cards, plus the count the "N more waiting" hint needs. */
export type StudySessionPayload = {
  cards: StudyCard[];
  /** Due count from the queue build, taken **before** the session cap was applied. */
  totalDue: number;
};

/**
 * The minimum a word must structurally satisfy to be flattened. Declared here rather than
 * imported from the generated client so this module does not care whether it is handed a
 * `Word` with sentences joined, or anything else with the same five fields.
 */
type WordWithSentences = {
  id: string;
  expression: string;
  reading: string;
  meaning: string;
  sentences: { japanese: string; reading: string; english: string }[];
};

/** Flatten one word into a card, keeping only its first sentence (the query takes 1). */
function toStudyCard(word: WordWithSentences): StudyCard {
  const s = word.sentences[0];
  return {
    wordId: word.id,
    expression: word.expression,
    reading: word.reading,
    meaning: word.meaning,
    sentence: s ? { japanese: s.japanese, reading: s.reading, english: s.english } : null,
  };
}

/**
 * Build one session's cards for a user: due cards first, then new words filling the
 * remaining slots. The ordering is the point of the concatenation rather than an accident —
 * reviews are the commitment a session is for, and new words are what is added once the
 * commitment is met (§8.1).
 *
 * @param userId whose queue to build; every query inside is scoped to it.
 * @param opts `level` scopes the new words only (due cards come back regardless of level so
 *   nothing already in progress is stranded); `sessionLimit` caps the total, default 20.
 * @returns the flattened cards plus the pre-cap `totalDue`.
 */
export async function buildSession(
  userId: string,
  opts: { level?: Level; sessionLimit?: number } = {},
): Promise<StudySessionPayload> {
  const { due, newWords, totalDue } = await getStudyQueue(userId, opts);
  return {
    cards: [...due.map((d) => toStudyCard(d.word)), ...newWords.map(toStudyCard)],
    totalDue,
  };
}
