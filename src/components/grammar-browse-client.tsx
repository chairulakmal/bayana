"use client";

// Grammar browse client — reference view for /grammar/browse.
//
// Fetches every grammar point for the active level from GET /api/grammar/browse?level=,
// grouped by lesson (browser-cached, same headers as browse-client.tsx). Sentences are
// already in the payload (see the route's doc comment for why), so unlike the vocab
// browse page there's no per-row lazy fetch — expanding a lesson just reveals rows
// already in memory.
//
// Lessons render as a simple accordion (collapsed by default — 22 lessons open at once
// would be an unreasonably long scroll). Typing in the search box flattens that: it
// filters points by pattern/reading/meaning and force-expands any lesson with a match,
// so results are visible without the user having to open sections by hand.

import { useEffect, useRef, useState } from "react";
import { HighlightedSentence } from "@/components/highlighted-sentence";

type GrammarPointRow = {
  id: string;
  position: number;
  pattern: string;
  reading: string;
  meanings: string[];
  exampleJp: string;
  exampleEn: string;
  status: "new" | "started" | "mature";
};
type LessonGroup = { lesson: number; title: string; points: GrammarPointRow[] };

export function GrammarBrowseClient({ level }: { level: string }) {
  const [lessons, setLessons] = useState<LessonGroup[] | null>(null); // null = loading
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openLessons, setOpenLessons] = useState<Set<number>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchLessons() {
      try {
        const res = await fetch(`/api/grammar/browse?level=${encodeURIComponent(level)}`);
        if (!res.ok) throw new Error(`grammar/browse ${res.status}`);
        const data: { lessons: LessonGroup[] } = await res.json();
        if (!cancelled) setLessons(data.lessons);
      } catch {
        if (!cancelled) setError("Couldn't load grammar points.");
      }
    }
    void fetchLessons();
    return () => {
      cancelled = true;
    };
  }, [level]);

  const q = query.trim().toLowerCase();

  function toggle(lesson: number) {
    setOpenLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lesson)) next.delete(lesson);
      else next.add(lesson);
      return next;
    });
  }

  if (error) {
    return (
      <p className="mt-10 text-center text-[14px]" style={{ color: "var(--bad)" }}>
        {error}
      </p>
    );
  }

  if (lessons === null) {
    return (
      <p className="mt-10 text-center text-[14px]" style={{ color: "var(--ink-faint)" }}>
        Loading grammar points…
      </p>
    );
  }

  // Filter points within each lesson when searching; drop lessons with no matches.
  // A lesson whose *title* matches (e.g. "conditional") shows all its points unfiltered —
  // the learner is searching by theme, not a specific pattern, so narrowing to points that
  // happen to also contain the query text would hide most of the lesson they're after.
  const visibleLessons = q
    ? lessons
        .map((group) => ({
          ...group,
          points: group.title.toLowerCase().includes(q)
            ? group.points
            : group.points.filter(
                (p) =>
                  p.pattern.toLowerCase().includes(q) ||
                  p.reading.toLowerCase().includes(q) ||
                  p.meanings.some((m) => m.toLowerCase().includes(q)),
              ),
        }))
        .filter((group) => group.points.length > 0)
    : lessons;

  const totalPoints = lessons.reduce((sum, g) => sum + g.points.length, 0);
  const matchCount = q ? visibleLessons.reduce((sum, g) => sum + g.points.length, 0) : totalPoints;

  return (
    <div>
      {/* Search input */}
      <div className="relative">
        <input
          ref={searchInputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pattern, reading, or meaning…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-[var(--r-md)] px-4 py-3 text-[15px] outline-none"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              searchInputRef.current?.focus();
            }}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-[18px] leading-none"
            style={{ color: "var(--ink-faint)" }}
          >
            ×
          </button>
        )}
      </div>

      <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        {q
          ? `${matchCount.toLocaleString()} match${matchCount !== 1 ? "es" : ""}`
          : `${totalPoints.toLocaleString()} grammar points · ${lessons.length} lessons`}
      </p>

      {/* Lesson accordion */}
      <div className="mt-3 flex flex-col gap-3">
        {visibleLessons.length === 0 ? (
          <p
            className="rounded-[var(--r-lg)] px-4 py-8 text-center text-[14px]"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-faint)" }}
          >
            No grammar points match &ldquo;{query}&rdquo;
          </p>
        ) : (
          visibleLessons.map((group) => {
            const isOpen = q ? true : openLessons.has(group.lesson);
            const studiedCount = group.points.filter((p) => p.status !== "new").length;
            return (
              <div
                key={group.lesson}
                className="overflow-hidden rounded-[var(--r-lg)]"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
              >
                <button
                  type="button"
                  onClick={() => toggle(group.lesson)}
                  disabled={!!q}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} Lesson ${group.lesson}: ${group.title}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  style={q ? { opacity: 0.6, cursor: "default" } : undefined}
                >
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--surface-cream)", color: "var(--mag-600)" }}
                  >
                    L{group.lesson}
                  </span>
                  <span className="flex-1 text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                    {group.title}
                  </span>
                  <span
                    className="flex-shrink-0 text-[12px]"
                    style={{ color: "var(--ink-faint)" }}
                    aria-label={`${studiedCount} of ${group.points.length} studied`}
                  >
                    {studiedCount}/{group.points.length}
                  </span>
                  {!q && (
                    <span className="flex-shrink-0 text-[11px]" style={{ color: "var(--ink-faint)" }} aria-hidden>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--line)" }}>
                    {group.points.map((p, i) => (
                      <div
                        key={p.id}
                        className="px-4 py-3"
                        style={{ borderTop: i > 0 ? "1px solid var(--line)" : undefined }}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="jp text-[18px]" style={{ fontWeight: 700, color: "var(--ink)" }}>
                            {p.pattern}
                          </span>
                          {p.reading !== p.pattern && (
                            <span className="jp text-[12px]" style={{ color: "var(--mag-600)" }}>
                              {p.reading}
                            </span>
                          )}
                          {/* Progress dot: green = mature (scheduledDays >= 21), magenta =
                              started but not yet mature, none = never studied. Lets a learner
                              scan the reference list and see what still needs attention. */}
                          <span
                            className="ml-auto flex-shrink-0 self-center rounded-full"
                            aria-label={
                              p.status === "mature"
                                ? "Mature"
                                : p.status === "started"
                                  ? "Learning"
                                  : undefined
                            }
                            style={{
                              width: 6,
                              height: 6,
                              background:
                                p.status === "mature"
                                  ? "var(--good)"
                                  : p.status === "started"
                                    ? "var(--mag-500)"
                                    : "transparent",
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[13px]" style={{ color: "var(--ink-soft)" }}>
                          {p.meanings.join(", ")}
                        </p>
                        <div
                          className="mt-2 rounded-[var(--r-md)] p-3"
                          style={{ background: "var(--surface-cream)" }}
                        >
                          <p className="jp text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
                            <HighlightedSentence
                              sentence={p.exampleJp}
                              pattern={p.pattern}
                              reading={p.reading}
                            />
                          </p>
                          <p className="mt-1 text-[12px] italic" style={{ color: "var(--ink-soft)" }}>
                            {p.exampleEn}
                          </p>
                        </div>
                      </div>
                    ))}
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
