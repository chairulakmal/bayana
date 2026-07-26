"use client";

// Browse/search client component (SPEC §13 Phase 2 light polish).
//
// Fetches the active level's word list once from GET /api/browse?level=, which the browser
// caches (Cache-Control: private, max-age=86400, stale-while-revalidate=604800). Repeat
// visits within the cache window cost zero network round-trips.
//
// **Why this one screen still fetches on mount** while the four session screens are handed
// their first payload by the server: the list is the whole level (~2,700 rows, ~90 KB gzipped
// for N1) and has to be, because search filters in memory. In an RSC payload that would be
// re-downloaded every visit; behind a route handler it is cached for a day. See the page's
// header comment and SPEC §14.25.
//
// The per-user half arrives as the `started` prop, server-rendered by `app/browse/page.tsx`.
// That is the split that let the response above earn its long cache lifetime: the fetched list
// is now identical for every user and changes only on a re-seed, so nothing about it expires
// when the learner rates a card.
//
// All filtering runs in memory per keystroke — no server requests.
//
// Results are paginated at PAGE_SIZE per page rather than capped. The editable page-number
// input lets users jump to any page directly. Tapping a word row lazy-fetches its cached
// example sentence (GET /api/words/:id/sentence); one row open at a time (accordion).
//
// Words already in the user's deck sort first and carry a small magenta dot, so the default
// first page shows what they are actively studying.

import { useEffect, useMemo, useRef, useState } from "react";
import { WordListSkeleton } from "@/components/word-list-skeleton";
import type { BrowseWord } from "@/lib/browse";

type Sentence = { japanese: string; reading: string; english: string };

const PAGE_SIZE = 50;

// How long the result count must hold still before it is announced. Long enough that an
// ordinary typing cadence produces one announcement instead of one per letter, short enough
// that a user who stops to listen is not left waiting on it. Filtering itself is NOT
// debounced — the visible list still updates on every keystroke, which is the whole point of
// an in-memory search, and delaying it to fix an announcement would be fixing the wrong thing.
const ANNOUNCE_DELAY_MS = 700;

export function BrowseClient({
  level,
  started,
}: {
  level: string;
  /** Ids of words at this level with a `ReviewState`, from the server render. An array rather
   *  than a `Set` because a `Set` does not survive RSC serialization; converted below. */
  started: string[];
}) {
  const [words, setWords] = useState<BrowseWord[] | null>(null); // null = loading
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // pageInput is a string so the number input can show partial/empty text while typing.
  const [pageInput, setPageInput] = useState("1");
  const [openId, setOpenId] = useState<string | null>(null);
  // Sentence cache: avoid re-fetching a word the user already opened this session. One piece of
  // state, not a ref plus a hand-copied mirror of it: functional updates give the fresh copy
  // React needs to re-render without a second source of truth to keep in sync.
  const [sentences, setSentences] = useState<Map<string, Sentence | "missing">>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Top of the results list, so turning a page can put row 1 back under the user's thumb.
  const listRef = useRef<HTMLDivElement>(null);
  // Request token for the per-row sentence fetch, mirroring `study-session.tsx`. Taps are
  // independent requests with no effect to clean up, so a `cancelled` flag cannot serve here:
  // see `toggle` for the race it closes.
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchWords() {
      try {
        const res = await fetch(`/api/browse?level=${encodeURIComponent(level)}`);
        if (!res.ok) throw new Error(`browse ${res.status}`);
        const data: { words: BrowseWord[] } = await res.json();
        if (!cancelled) setWords(data.words);
      } catch {
        if (!cancelled) setError("Couldn't load the word list.");
      }
    }
    void fetchWords();
    return () => { cancelled = true; };
  }, [level]);

  const startedIds = useMemo(() => new Set(started), [started]);

  // Recombine the two halves. The fetched list arrives sorted by expression under Japanese
  // collation (`lib/browse.ts`), so a *stable* partition is all that is needed to lift started
  // words to the front while both groups stay alphabetical, which is the exact order the server
  // used to produce, at O(n) with no comparisons. Memoized because it walks the level and neither
  // input changes while the user types.
  const ordered = useMemo(() => {
    if (!words) return null;
    const inDeck: BrowseWord[] = [];
    const rest: BrowseWord[] = [];
    for (const w of words) (startedIds.has(w.id) ? inDeck : rest).push(w);
    return [...inDeck, ...rest];
  }, [words, startedIds]);

  // Filter: query matches expression, reading, or meaning (case-insensitive substring).
  const q = query.trim().toLowerCase();
  const filtered = ordered
    ? q
      ? ordered.filter(
          (w) =>
            w.expression.toLowerCase().includes(q) ||
            w.reading.toLowerCase().includes(q) ||
            w.meaning.toLowerCase().includes(q),
        )
      : ordered
    : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp safePage so it stays valid when search results shrink (e.g. user was on page 5
  // then typed more and filtered down to 1 page).
  const safePage = Math.min(currentPage, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // The result count as one string, rendered visibly and (after a pause) announced. Empty
  // while the list is still loading, so the live region below stays silent until there is a
  // real count — the loading branch has its own "Loading words" region for that wait.
  const countLabel =
    words === null
      ? ""
      : (q
          ? `${filtered.length.toLocaleString()} match${filtered.length !== 1 ? "es" : ""}`
          : `${words.length.toLocaleString()} words`) +
        (totalPages > 1 ? ` · page ${safePage} of ${totalPages}` : "");

  // Debounce the *announcement*, not the filtering. The count used to sit directly in a
  // `role="status"` element, so typing "benkyou" queued seven announcements and a screen
  // reader spent the whole word reading interim totals over the user's own typing. Holding
  // the announced value until the count settles turns that into one useful sentence.
  //
  // The effect depends on the label *string*, not on `query`, so a keystroke that does not
  // change the result count (a second space, a character that matches nothing new) never
  // restarts the timer and never re-announces an identical value.
  const [announcedCount, setAnnouncedCount] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncedCount(countLabel), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [countLabel]);

  function goToPage(n: number) {
    const clamped = Math.min(Math.max(1, n), totalPages);
    setCurrentPage(clamped);
    setPageInput(String(clamped));
    setOpenId(null); // close any open sentence when turning a page

    // Return to the top of the list. Without this, tapping "Next" — which sits *below* 50
    // rows — left the viewport at the bottom of the new page, so at the 375px baseline the
    // user landed on rows 45-50 of a page they had not read a word of.
    //
    // `scrollIntoView` on the list rather than `window.scrollTo(0, 0)`: scrolling to the
    // document top would also scroll the heading and search field back into view, costing a
    // swipe before the first result. Aligning the list's top edge to the viewport top puts
    // row 1 exactly where the eye already is.
    //
    // Instant, not smooth. A 50-row jump animated is motion the user did not ask for, and
    // honouring `prefers-reduced-motion` here would mean branching on a media query for a
    // scroll that reads better instant either way.
    listRef.current?.scrollIntoView({ block: "start" });
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

  async function toggle(word: BrowseWord) {
    if (openId === word.id) { setOpenId(null); return; }
    setOpenId(word.id);
    if (sentences.has(word.id)) return;

    // Take a token for this request. Tapping row A then row B quickly used to leave B with no
    // spinner: A's `finally` ran while B was still in flight and cleared the shared `loadingId`
    // out from under it. Only the most recent request is allowed to clear it now. The *result*
    // is still stored either way, since a sentence fetched for a row the user has since closed is
    // worth keeping, and only the spinner was ever ambiguous.
    const requestId = ++requestIdRef.current;
    setLoadingId(word.id);
    try {
      const res = await fetch(`/api/words/${encodeURIComponent(word.id)}/sentence`);
      const value: Sentence | "missing" = res.ok ? await res.json() : "missing";
      // Functional update: copy the previous Map so React sees a new reference, without reading
      // a possibly-stale `sentences` from this closure.
      setSentences((prev) => new Map(prev).set(word.id, value));
    } catch {
      setSentences((prev) => new Map(prev).set(word.id, "missing"));
    } finally {
      if (requestIdRef.current === requestId) setLoadingId(null);
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

      {/* Result count, split into what is *seen* and what is *said*.
          The visible line updates on every keystroke, as it must: it is the only feedback a
          sighted user gets that the filter is working. It is no longer the live region
          itself, because a live region that changes seven times while you type a word
          announces seven times.
          The announcement lives in the sr-only node below, on a debounced copy of the same
          string. Matching the precedent in `quiz-session.tsx`, that node is part of the
          normal render rather than mounted when the number first changes — a live region
          created at the moment it has something to say is frequently not announced at all. */}
      <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        {countLabel}
      </p>
      <span className="sr-only" role="status">
        {announcedCount}
      </span>

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
            const isStarted = startedIds.has(word.id);

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
                    role={isStarted ? "img" : undefined}
                    aria-label={isStarted ? "In your deck" : undefined}
                    style={{
                      width: 6,
                      height: 6,
                      background: isStarted ? "var(--mag-500)" : "transparent",
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
