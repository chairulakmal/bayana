// Shared by grammar-session.tsx (study) and grammar-browse-client.tsx (reference view)
// so a grammar pattern is highlighted the same way in both places (SPEC.md §13,
// "the pattern is bolded in grape so the learner can see exactly where it appears").
//
// A plain "does the sentence contain this exact string" check misses most real
// examples: patterns are written in dictionary/citation form (べき, 上げる, の間に)
// while the sentence has the word conjugated, and many pattern strings also carry
// disambiguation markers (①/②), alternatives (Xか・Y), or a 〜 standing in for
// whatever comes before/between the fixed parts (どんなに〜ても). Auditing all ~220
// seeded points against this simple approach showed ~70 didn't highlight anything —
// see the token pipeline below, which fixed all but ~10 (those turned out to be
// actual data issues in the source deck: corrupted entries or examples that don't
// literally contain the taught form — not something a smarter matcher can fix).

// Grammar reference words that JLPT materials write in kana but real sentences
// often write in kanji (or vice versa). Small, fixed list of common functional
// nouns/adverbs — not meant to be exhaustive, just the ones that showed up in the
// audit above.
const KANA_KANJI_PAIRS: [string, string][] = [
  ["こと", "事"], ["もの", "物"], ["とき", "時"], ["ところ", "所"],
  ["わけ", "訳"], ["はず", "筈"], ["ため", "為"], ["あまり", "余り"],
  ["ほど", "程"], ["うち", "内"], ["もと", "基"], ["なか", "中"],
];

// Drop disambiguation/annotation cruft that isn't part of the actual Japanese text:
// circled numbers distinguishing homonym patterns (べき ①), English glosses in
// parens ("(Casual)"), stray "+"/"＋" markup, and bare English words/labels.
function stripAnnotations(s: string): string {
  return s
    .replace(/[①-⑳]/g, "")
    .replace(/[（(][^（）()]*[A-Za-z][^（）()]*[）)]/g, "")
    .replace(/[+＋]/g, "")
    .replace(/\b[A-Za-z][A-Za-z.[\]]*\b/g, "")
    .trim();
}

// Break a raw pattern/reading string into the individual Japanese fragments worth
// searching for: "・" and whitespace separate alternatives (としたら・とすれば), and
// 〜/～/… (or a placeholder letter like X) mark a gap standing in for whatever else
// the sentence conjugates in between (どんなに〜ても) — each side of the gap is
// searched independently rather than as one literal substring.
function candidateTokens(raw: string): string[] {
  const cleaned = stripAnnotations(raw);
  const tokens: string[] = [];
  for (const alt of cleaned.split(/[・\s]+/).filter(Boolean)) {
    // "(の)姿" means の is optional — try both with and without the parenthesized part.
    const variants = [alt.replace(/[（）()]/g, ""), alt.replace(/[（）()][^（）()]*[（）()]/g, "")];
    for (const variant of variants) {
      tokens.push(...variant.split(/[〜～…XY]/).map((t) => t.trim()).filter(Boolean));
    }
  }
  return [...new Set(tokens)];
}

// Cheap conjugation handling — not a real conjugator, just the handful of
// transformations common enough across the deck to be worth the code:
// dictionary-form verb endings (切る→切), する/した/して, a dropped leading の
// (noun+の+間に vs verb+間に), and a swapped trailing case particle.
function conjugationVariants(tok: string): string[] {
  const out = [tok];
  if (/[るくぐすつぬぶむういない]$/.test(tok) && tok.length >= 2) out.push(tok.slice(0, -1));
  if (tok.endsWith("する") && tok.length >= 3) {
    const stem = tok.slice(0, -2);
    out.push(stem + "した", stem + "して");
  }
  if (tok.startsWith("の") && tok.length >= 3) out.push(tok.slice(1));
  if (tok.length >= 3 && /[にはでをがも]$/.test(tok)) out.push(tok.slice(0, -1));
  return out;
}

function kanaKanjiVariants(tok: string): string[] {
  const out = [tok];
  for (const [kana, kanji] of KANA_KANJI_PAIRS) {
    if (tok.includes(kana)) out.push(tok.replace(kana, kanji));
    if (tok.includes(kanji)) out.push(tok.replace(kanji, kana));
  }
  return out;
}

// A single kana character is too generic to highlight safely (の, さ, み... appear
// constantly for unrelated reasons) — a false match is worse than no match. A
// single kanji is fine: much higher information density, rarely a coincidence.
function isSafeLength(tok: string): boolean {
  return tok.length >= 2 || /[一-鿿]/.test(tok);
}

function buildTokens(pattern: string, reading: string): string[] {
  const raw = [...candidateTokens(pattern), ...candidateTokens(reading)].filter(isSafeLength);
  const expanded = raw.flatMap((t) => conjugationVariants(t).flatMap(kanaKanjiVariants));
  // Longest first: prefer a more specific match over a short fragment of it, and lets
  // the greedy scan below reserve that span before shorter tokens can claim part of it.
  return [...new Set(expanded)].filter(isSafeLength).sort((a, b) => b.length - a.length);
}

function findMatches(sentence: string, tokens: string[]): { start: number; end: number }[] {
  const matches: { start: number; end: number }[] = [];
  for (const tok of tokens) {
    const idx = sentence.indexOf(tok);
    if (idx === -1) continue;
    const end = idx + tok.length;
    const overlaps = matches.some((m) => idx < m.end && end > m.start);
    if (!overlaps) matches.push({ start: idx, end });
  }
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Render `sentence` with every recognizable occurrence of `pattern` (or `reading`,
 * including conjugated/kana-kanji variants — see the pipeline above) wrapped in
 * <strong>. Falls back to the plain sentence if nothing matches.
 */
export function HighlightedSentence({
  sentence,
  pattern,
  reading,
}: {
  sentence: string;
  pattern: string;
  reading: string;
}) {
  const matches = findMatches(sentence, buildTokens(pattern, reading));
  if (matches.length === 0) return <>{sentence}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) parts.push(sentence.slice(cursor, m.start));
    parts.push(
      <strong key={i} style={{ color: "var(--grape)" }}>
        {sentence.slice(m.start, m.end)}
      </strong>,
    );
    cursor = m.end;
  });
  if (cursor < sentence.length) parts.push(sentence.slice(cursor));

  return <>{parts}</>;
}
