"use client";

// Browse/search client component (SPEC §13 Phase 2 light polish).
//
// Fetches the active level's word list once from GET /api/browse?level=, which the browser
// caches (Cache-Control: private, max-age=3600). All filtering runs in memory — no server
// round-trips per keystroke. The render cap (RENDER_CAP) stops React from mounting thousands
// of DOM nodes; the search box narrows results quickly enough that users rarely hit it.
//
// Tapping a word row lazy-fetches that word's cached example sentence (GET /api/words/:id/
// sentence). One row is open at a time (accordion) to keep the UI predictable.

import { useEffect, useRef, useState } from "react";

type Word = { id: string; expression: string; reading: string; meaning: string };
type Sentence = { japanese: string; reading: string; english: string };

const RENDER_CAP = 50;

export function BrowseClient({ level }: { level: string }) {
  const [words, setWords] = useState<Word[] | null>(null); // null = loading
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // Cache sentences in memory so re-opening a row skips the fetch.
  const sentenceCache = useRef<Map<string, Sentence | "missing">>(new Map());
  const [sentences, setSentences] = useState<Map<string, Sentence | "missing">>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  const visible = filtered.slice(0, RENDER_CAP);
  const overflow = filtered.length - visible.length;

  async function toggle(word: Word) {
    // Collapse if already open.
    if (openId === word.id) {
      setOpenId(null);
      return;
    }
    setOpenId(word.id);
    // Already fetched — nothing to do.
    if (sentenceCache.current.has(word.id)) return;

    setLoadingId(word.id);
    try {
      const res = await fetch(`/api/words/${encodeURIComponent(word.id)}/sentence`);
      const value: Sentence | "missing" = res.ok ? await res.json() : "missing";
      sentenceCache.current.set(word.id, value);
      // Trigger re-render by copying the map (Maps are mutable; React won't see the change
      // otherwise without a new reference).
      setSentences(new Map(sentenceCache.current));
    } catch {
      sentenceCache.current.set(word.id, "missing");
      setSentences(new Map(sentenceCache.current));
    } finally {
      setLoadingId(null);
    }
  }

  // --- render states ---

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
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpenId(null); }}
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
            onClick={() => { setQuery(""); setOpenId(null); inputRef.current?.focus(); }}
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
          : `${words.length.toLocaleString()} words in ${level}`}
        {overflow > 0 && ` — showing first ${RENDER_CAP}, keep typing to narrow`}
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
                  <span className="jp text-[13px]" style={{ color: "var(--mag-600)", flexShrink: 0 }}>
                    {word.reading}
                  </span>
                  <span
                    className="flex-1 truncate text-[13px]"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {word.meaning}
                  </span>
                  <span
                    className="flex-shrink-0 text-[11px]"
                    style={{ color: "var(--ink-faint)", transition: "transform 0.15s" }}
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
                        <p className="jp text-[15px] leading-relaxed" style={{ color: "var(--ink)" }}>
                          {sentence.japanese}
                        </p>
                        <p className="jp mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>
                          {sentence.reading}
                        </p>
                        <p className="mt-2 text-[13px] italic" style={{ color: "var(--ink-soft)" }}>
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
    </div>
  );
}
