"use client";

// Browse/search client component (SPEC §13 Phase 2 light polish).
//
// Fetches the active level's word list once from GET /api/browse?level=, which the browser
// caches (Cache-Control: private, max-age=3600, stale-while-revalidate=86400). Repeat
// visits within the cache window cost zero network round-trips.
//
// All filtering runs in memory per keystroke — no server requests. Changing the `level`
// prop (via BrowseLevelPicker) causes the parent to remount this component (key=level),
// resetting all state and triggering a fresh fetch for the new level.
//
// Results are paginated at PAGE_SIZE per page rather than capped. The editable page-number
// input lets users jump to any page directly. Tapping a word row lazy-fetches its cached
// example sentence (GET /api/words/:id/sentence); one row open at a time (accordion).
//
// Words with an existing ReviewState (started: true from the API) are sorted first by the
// server and shown with a small magenta dot so the user can see at a glance which words
// they're actively studying.

import { useEffect, useRef, useState } from "react";

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

  if (words === null) {
    return (
      <p className="mt-10 text-center text-[14px]" style={{ color: "var(--ink-faint)" }}>
        Loading words…
      </p>
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
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-[var(--r-md)] px-4 py-3 text-[15px] outline-none"
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
            className="absolute top-1/2 right-3 -translate-y-1/2 text-[18px] leading-none"
            style={{ color: "var(--ink-faint)" }}
          >
            ×
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
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
                  className="flex w-full items-baseline gap-3 px-4 py-3 text-left"
                >
                  <span
                    className="jp flex-shrink-0 text-[22px]"
                    style={{ fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}
                  >
                    {word.expression}
                  </span>
                  <span
                    className="jp flex-shrink-0 text-[13px]"
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
                          className="jp text-[15px] leading-relaxed"
                          style={{ color: "var(--ink)" }}
                        >
                          {sentence.japanese}
                        </p>
                        <p
                          className="jp mt-1 text-[12px]"
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
          <button
            type="button"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage <= 1}
            className="text-[13px] font-semibold"
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
              className="rounded text-center text-[13px] outline-none"
              style={{
                // Width: enough for the max page number plus a little padding.
                width: `${Math.max(2, String(totalPages).length) + 2}ch`,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                padding: "2px 4px",
              }}
            />
            <span>of {totalPages}</span>
          </div>

          <button
            type="button"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="text-[13px] font-semibold"
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
