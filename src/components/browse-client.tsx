"use client";

// Browse/search client component (SPEC §13 Phase 2 light polish).
//
// Fetches the active level's word list once from GET /api/browse?level=, which the browser
// caches (Cache-Control: private, max-age=3600, stale-while-revalidate=86400). Repeat
// visits within the cache window cost zero network round-trips.
//
// All filtering runs in memory per keystroke — no server requests.
//
// Results are paginated at PAGE_SIZE per page rather than capped. The editable page-number
// input lets users jump to any page directly. Tapping a word row lazy-fetches its cached
// example sentence (GET /api/words/:id/sentence); one row open at a time (accordion).
//
// Words with an existing ReviewState (started: true from the API) are sorted first by the
// server and shown with a small magenta dot so the user can see at a glance which words
// they're actively studying.

import { useEffect, useRef, useState } from "react";
import { WordListSkeleton } from "@/components/word-list-skeleton";

type Word = {
  id: string;
  expression: string;
  reading: string;
  meaning: string;
  started: boolean;
};
type Sentence = { japanese: string; reading: string; english: string };

const PAGE_SIZE = 50;

export function BrowseClient({ level }: { level: string }) {
  const [words, setWords] = useState<Word[] | null>(null); // null = loading
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // pageInput is a string so the number input can show partial/empty text while typing.
  const [pageInput, setPageInput] = useState("1");
  const [openId, setOpenId] = useState<string | null>(null);
  // Sentence cache: avoid re-fetching a word the user already opened this session.
  const sentenceCache = useRef<Map<string, Sentence | "missing">>(new Map());
  const [sentences, setSentences] = useState<Map<string, Sentence | "missing">>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchWords() {
      try {
        const res = await fetch(`/api/browse?level=${encodeURIComponent(level)}`);
        if (!res.ok) throw new Error(`browse ${res.status}`);
        const data: { words: Word[] } = await res.json();
        if (!cancelled) setWords(data.words);
      } catch {
        if (!cancelled) setError("Couldn't load the word list.");
      }
    }
    void fetchWords();
    return () => { cancelled = true; };
  }, [level]);

  // Filter: query matches expression, reading, or meaning (case-insensitive substring).
  const q = query.trim().toLowerCase();
  const filtered = words
    ? q
      ? words.filter(
          (w) =>
            w.expression.toLowerCase().includes(q) ||
            w.reading.toLowerCase().includes(q) ||
            w.meaning.toLowerCase().includes(q),
        )
      : words
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp safePage so it stays valid when search results shrink (e.g. user was on page 5
  // then typed more and filtered down to 1 page).
  const safePage = Math.min(currentPage, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function goToPage(n: number) {
    const clamped = Math.min(Math.max(1, n), totalPages);
    setCurrentPage(clamped);
    setPageInput(String(clamped));
    setOpenId(null); // close any open sentence when turning a page
  }

  function commitPage() {
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) {
      goToPage(n);
    } else {
      // Restore the last valid page if the user cleared the input or typed non-numeric.
      setPageInput(String(safePage));
    }
  }

  async function toggle(word: Word) {
    if (openId === word.id) { setOpenId(null); return; }
    setOpenId(word.id);
    if (sentenceCache.current.has(word.id)) return;

    setLoadingId(word.id);
    try {
      const res = await fetch(`/api/words/${encodeURIComponent(word.id)}/sentence`);
      const value: Sentence | "missing" = res.ok ? await res.json() : "missing";
      sentenceCache.current.set(word.id, value);
      // Copy the Map so React sees a new reference and re-renders.
      setSentences(new Map(sentenceCache.current));
    } catch {
      sentenceCache.current.set(word.id, "missing");
      setSentences(new Map(sentenceCache.current));
    } finally {
      setLoadingId(null);
    }
  }

  // --- loading / error states ---

  if (error) {
    return (
      <p className="mt-10 text-center text-[14px]" style={{ color: "var(--bad)" }}>
        {error}
      </p>
    );
  }

  // The long wait: the whole level's word list over the network. Renders the same skeleton
  // `app/browse/loading.tsx` used for the server render that just finished, so the two waits
  // read as one continuous load rather than the page regressing from a laid-out placeholder
  // to a line of centred text.
  if (words === null) {
    return (
      <>
        <WordListSkeleton />
        <span className="sr-only" role="status" aria-live="polite">
          Loading words
        </span>
      </>
    );
  }

  return (
    <div>
      {/* Search input */}
      <div className="relative">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCurrentPage(1);
            setPageInput("1");
            setOpenId(null);
          }}
          placeholder="Search kanji, reading, or meaning…"
          // A placeholder is not an accessible name: it is not exposed by every screen
          // reader, and it disappears the moment the field has content, so a user who tabs
          // back to a filled field would hear only its value.
          aria-label="Search words"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          // pr-12 reserves the 44px the clear button occupies. Unconditional, even though the
          // button only renders when there is a query: making the padding conditional would
          // reflow the text under the caret at the exact moment the user starts typing.
          className="focus-ring w-full rounded-[var(--r-md)] py-3 pl-4 pr-12 text-[15px] outline-none"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setCurrentPage(1);
              setPageInput("1");
              setOpenId(null);
              searchRef.current?.focus();
            }}
            // 44x44 flex box centring the glyph, which stays 18px. The input is ~46px tall
            // (py-3 + 15px text), so a 44px button fits inside it without changing the
            // field's height; right-1 keeps it clear of the rounded border.
            className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[18px] leading-none"
            style={{ color: "var(--ink-faint)" }}
          >
            ×
          </button>
        )}
      </div>

      {/* Result count. `role="status"` (implicitly aria-live="polite" + atomic) makes the
          count audible: filtering happens per keystroke with no other feedback, so a screen
          reader user typing a query had no way to know whether anything matched. Matching
          the precedent in `quiz-session.tsx`, the live node is part of the normal render
          rather than mounted when the number first changes — a live region created at the
          moment it has something to say is frequently not announced at all. */}
      <p role="status" className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        {q
          ? `${filtered.length.toLocaleString()} match${filtered.length !== 1 ? "es" : ""}`
          : `${words.length.toLocaleString()} words`}
        {totalPages > 1 && ` · page ${safePage} of ${totalPages}`}
      </p>

      {/* Word list */}
      <div
        className="mt-3 overflow-hidden rounded-[var(--r-lg)]"
        style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
      >
        {visible.length === 0 ? (
          <p
            className="px-4 py-8 text-center text-[14px]"
            style={{ color: "var(--ink-faint)" }}
          >
            No words match &ldquo;{query}&rdquo;
          </p>
        ) : (
          visible.map((word, i) => {
            const isOpen = openId === word.id;
            const sentence = sentences.get(word.id);
            const isLoading = loadingId === word.id;

            return (
              <div
                key={word.id}
                style={{
                  borderTop: i > 0 ? "1px solid var(--line)" : undefined,
                  background: isOpen ? "var(--surface-cream)" : "var(--surface)",
                }}
              >
                {/* Word row — tap to expand */}
                <button
                  type="button"
                  onClick={() => void toggle(word)}
                  // The vocab half of the accordion; the grammar lesson toggles already
                  // carry theirs. Without it the row announces as a plain button and its
                  // open/closed state is conveyed only by the ▲/▼ glyph, which is
                  // aria-hidden precisely because it reads as noise.
                  aria-expanded={isOpen}
                  className="flex w-full items-baseline gap-3 px-4 py-3 text-left"
                >
                  <span
                    lang="ja" className="jp flex-shrink-0 text-[22px]"
                    style={{ fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}
                  >
                    {word.expression}
                  </span>
                  <span
                    lang="ja" className="jp flex-shrink-0 text-[13px]"
                    style={{ color: "var(--mag-600)" }}
                  >
                    {word.reading}
                  </span>
                  <span
                    className="flex-1 truncate text-[13px]"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {word.meaning}
                  </span>
                  {/* Small dot = this word is in the user's review deck (started). Placed
                      before the chevron so it doesn't shift the layout when absent. */}
                  <span
                    className="flex-shrink-0 self-center rounded-full"
                    // `role="img"` is what makes the label count. `aria-label` on a bare
                    // <span> has no implicit role to attach to, so most screen readers
                    // discard it and the "in your deck" signal was silently sighted-only.
                    // Only when started: an unlabelled role="img" would announce an empty
                    // image on every other row.
                    role={word.started ? "img" : undefined}
                    aria-label={word.started ? "In your deck" : undefined}
                    style={{
                      width: 6,
                      height: 6,
                      background: word.started ? "var(--mag-500)" : "transparent",
                    }}
                  />
                  <span
                    className="flex-shrink-0 text-[11px]"
                    style={{ color: "var(--ink-faint)" }}
                    aria-hidden
                  >
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {/* Sentence — shown when row is open */}
                {isOpen && (
                  <div
                    className="px-4 pb-4"
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    {isLoading ? (
                      <p className="pt-3 text-[13px]" style={{ color: "var(--ink-faint)" }}>
                        Loading…
                      </p>
                    ) : sentence && sentence !== "missing" ? (
                      <div
                        className="mt-3 rounded-[var(--r-md)] p-3"
                        style={{ background: "var(--surface)" }}
                      >
                        <p
                          lang="ja" className="jp text-[15px] leading-relaxed"
                          style={{ color: "var(--ink)" }}
                        >
                          {sentence.japanese}
                        </p>
                        <p
                          lang="ja" className="jp mt-1 text-[12px]"
                          style={{ color: "var(--ink-faint)" }}
                        >
                          {sentence.reading}
                        </p>
                        <p
                          className="mt-2 text-[13px] italic"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          {sentence.english}
                        </p>
                      </div>
                    ) : (
                      <p className="pt-3 text-[13px]" style={{ color: "var(--ink-faint)" }}>
                        No example sentence yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination bar — only shown when there is more than one page. */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {/* Real padding rather than `.tap-44`, because these were bare text: the utility
              only grows the vertical axis, and a "← Prev" run is about 40px wide. The
              negative margin is on the OUTER side only, so the label stays visually flush
              with the list edge above while the target reaches into the page gutter — the
              inner padding simply eats into the row's gap, where nothing else sits. */}
          <button
            type="button"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage <= 1}
            className="-ml-3 flex min-h-[44px] items-center px-3 text-[13px] font-semibold"
            style={{
              color: safePage <= 1 ? "var(--ink-faint)" : "var(--ink-soft)",
              cursor: safePage <= 1 ? "default" : "pointer",
            }}
          >
            ← Prev
          </button>

          {/* Editable page number input. The input type="number" gives a numeric keyboard
              on mobile. HTML min/max constrain the native spinner; JS clamping on blur/Enter
              handles typed values outside the range. The width is sized to the max page
              number so it doesn't jump around as the user navigates. */}
          <div
            className="flex items-center gap-1.5 text-[13px]"
            style={{ color: "var(--ink-soft)" }}
          >
            <span>Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPage}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitPage();
                  e.currentTarget.blur();
                }
              }}
              className="focus-ring rounded text-center text-[13px] outline-none"
              style={{
                // Width: enough for the max page number plus a little padding. The `min`
                // pair is the hit-target floor: at two or three characters the computed
                // width lands around 30px, so without it this is a 30x18 tap target sitting
                // between two controls that now clear 44px.
                width: `${Math.max(2, String(totalPages).length) + 2}ch`,
                minWidth: 44,
                minHeight: 44,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                padding: "8px 6px",
              }}
            />
            <span>of {totalPages}</span>
          </div>

          <button
            type="button"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="-mr-3 flex min-h-[44px] items-center px-3 text-[13px] font-semibold"
            style={{
              color: safePage >= totalPages ? "var(--ink-faint)" : "var(--ink-soft)",
              cursor: safePage >= totalPages ? "default" : "pointer",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
