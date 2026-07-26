// Data access for /browse (vocabulary reference view), server-only.
//
// This module exists to split one query into two, and the split is the whole point of the
// file. `/api/browse` used to return the level's word list *and* a per-word `started` flag,
// ordered started-first. That single shape coupled ~2,700 immutable deck rows to a value that
// changes every time the user rates a card, which capped the response's `max-age` at an hour
// and made the payload unshareable between users. Splitting it lets each half be cached on its
// own terms (SPEC §9.3):
//
//   - `getLevelWords` is deck data. It changes only when `decks/*.csv` is re-seeded, so the
//     route that serves it can hold a browser cache for a day.
//   - `getStartedWordIds` is per-user and small (only the words that have a `ReviewState`, a
//     few hundred at most). It is read during the `/browse` render and handed to the client as
//     a prop, so it costs no extra round trip and is never stale.
//
// The client recombines them: a stable partition puts started words first, which is the same
// order the server used to produce (see `getLevelWords` for why the sort stays here).

import { defaultDeps, type Deps } from "@/lib/deps";
import type { Level } from "@/generated/prisma/enums";

/** One row of the vocabulary reference list. No per-user field, by design: see the module
 *  comment. Sentences are deliberately absent and lazy-fetched per row on tap, because
 *  including them would roughly triple a payload that is already ~90 KB gzipped for N1. */
export type BrowseWord = {
  id: string;
  expression: string;
  reading: string;
  meaning: string;
};

/**
 * Every word at one JLPT level, sorted for display. Identical for every user, which is what
 * makes the response cacheable.
 *
 * **The sort stays on the server** even though the client now owns the started-first ordering.
 * Two reasons. `localeCompare(…, "ja")` gives correct kana/kanji collation, which a Postgres
 * `ORDER BY` under the database's own collation does not, so moving the comparison into SQL
 * would silently change the order users see. And doing it here means it runs once per cache
 * miss (about once a day per browser) rather than on every client mount: ~2,700 collation
 * comparisons is only ~10 ms, but it is 10 ms of the main thread during hydration, spent on
 * work whose answer never changes.
 */
export async function getLevelWords(
  level: Level,
  { db }: Deps = defaultDeps,
): Promise<BrowseWord[]> {
  const words = await db.word.findMany({
    where: { level },
    select: { id: true, expression: true, reading: true, meaning: true },
  });
  words.sort((a, b) => a.expression.localeCompare(b.expression, "ja"));
  return words;
}

/**
 * The ids of words at this level that the user has already started reviewing (i.e. have a
 * `ReviewState` row). Drives both the started-first ordering and the small magenta dot on a
 * row, so a learner can see at a glance what is already in their deck.
 *
 * Returned as an array rather than a `Set` because it crosses the server/client boundary as a
 * prop, and a `Set` is not serializable in the RSC payload. The client builds the `Set`.
 */
export async function getStartedWordIds(
  userId: string,
  level: Level,
  { db }: Deps = defaultDeps,
): Promise<string[]> {
  const rows = await db.reviewState.findMany({
    where: { userId, word: { level } },
    select: { wordId: true },
  });
  return rows.map((r) => r.wordId);
}
