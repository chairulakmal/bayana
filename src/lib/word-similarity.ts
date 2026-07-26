// The scoring toolkit both question builders use to choose distractors.
//
// **Why this file exists now.** These functions were byte-identical copies in `quiz.ts` and
// `exam.ts`, and both modules said so: "duplicated from quiz.ts to keep both modules
// self-contained. A shared util is the natural next step if a third consumer appears." The
// third consumer has appeared, and it is the test suite. Two copies of `levenshtein` are two
// things that can drift, and a drift here does not fail: it makes one mode's distractors
// quietly easier than the other's, which is exactly the failure mode TODO.md's
// characterization-testing item was written to catch.
//
// Everything here is a pure function of its arguments, with one deliberate exception noted
// on `shuffle`. That matters for the port: this module imports nothing from Next, nothing
// from Prisma, and nothing from the database, so it crosses to any framework unchanged and
// its tests cross with it.
//
// Contents, in order: kanji and kana predicates, set/string similarity, and the two
// randomisation helpers the pickers use to keep repeated rounds from looking identical.

// ---------------------------------------------------------------------------
// Kanji and kana
// ---------------------------------------------------------------------------

/**
 * The distinct kanji (Han characters) in a string; kana and punctuation are ignored, so a
 * kana-only word yields an empty set.
 *
 * The ranges are written out explicitly (CJK Unified Ideographs plus Extension A, both in the
 * BMP) rather than using a `\p{Script=Han}` class, which would require the regex `u` flag.
 * Characters outside the BMP are therefore not matched; no word in the JLPT decks contains
 * one, and the alternative would change the flag semantics of the whole pattern.
 */
export function kanjiOf(expression: string): Set<string> {
  return new Set(expression.match(/[一-鿿㐀-䶿]/g) ?? []);
}

/** True if `ch` is a hiragana character (U+3041–U+3096). */
export function isHiragana(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x3041 && c <= 0x3096;
}

/** True if `ch` is a CJK kanji (BMP Unified + Extension A). Matches `kanjiOf`'s ranges. */
export function isKanji(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf);
}

/**
 * The okurigana — the hiragana suffix following the final kanji in a word.
 *
 *   主に → "に"      食べる → "べる"     聞こえる → "こえる"
 *   学校 → ""        たべる → ""         テレビ → ""
 *
 * Returns "" when there is no trailing hiragana after a kanji: a pure-kanji word has no
 * suffix, and for a pure-kana word the visible hiragana *is* the whole word, so constraining
 * distractors on it would be meaningless.
 *
 * Exam mode uses this to stop the visible okurigana from giving the answer away — see
 * `pickReadingDistractors`.
 */
export function okurigana(expression: string): string {
  // Walk backwards collecting trailing hiragana.
  let i = expression.length - 1;
  while (i >= 0 && isHiragana(expression[i])) i--;
  // i now points at the last non-hiragana character, or -1 if the word is all hiragana.
  if (i < 0) return ""; // pure-kana expression — no meaningful okurigana
  if (!isKanji(expression[i])) return ""; // trailing hiragana not preceded by a kanji
  return expression.slice(i + 1);
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

/**
 * Jaccard overlap of two sets: |A∩B| / |A∪B|, in [0,1].
 *
 * Defined as 0 when either set is empty. That is a choice, not a mathematical necessity
 * (the ratio is 0/0 there), and it is the one the callers need: an empty kanji set means a
 * kana-only word, which shares no kanji with anything and must not score as a perfect match
 * against another kana-only word.
 */
export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Reading similarity in [0,1] = 1 − (edit distance / longer length). Operates on kana. */
export function readingSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

/**
 * Levenshtein edit distance, single-row dynamic programming.
 *
 * O(|a|·|b|) time and O(|b|) space. Readings are a handful of characters, so the naive
 * full-matrix version would also be fine; the single row is kept because this runs once per
 * (target, candidate) pair and a level's pool is ~2,700 words.
 */
export function levenshtein(a: string, b: string): number {
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[n];
}

// ---------------------------------------------------------------------------
// Randomisation
// ---------------------------------------------------------------------------
//
// These live beside the scoring rather than in a module of their own because they are only
// ever used by the distractor pickers and the queue builders, always for the same purpose:
// stopping a deterministic score from producing an identical round every time. Keeping them
// here means "how a question gets assembled" is one import.
//
// They are the only impure functions in this file. That is what makes the builders untestable
// by exact output and is why their tests assert invariants over many runs instead.

/** Fisher–Yates shuffle. Returns a new array; the input is untouched. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `n` random distinct elements of `arr`, in random order. Fewer if `arr` is shorter. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
