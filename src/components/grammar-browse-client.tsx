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
          // See browse-client: a placeholder is not an accessible name.
          aria-label="Search grammar points"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          // pr-12 reserves the clear button's 44px unconditionally, so the text does not
          // reflow under the caret the moment a query appears (same as browse-client).
          className="focus-ring w-full rounded-[var(--r-md)] py-3 pl-4 pr-12 text-[15px] outline-none"
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
            // 44x44 target around an 18px glyph; the field is ~46px tall so it fits inside.
            className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[18px] leading-none"
            style={{ color: "var(--ink-faint)" }}
          >
            ×
          </button>
        )}
      </div>

      {/* Live result count, same reasoning as browse-client: filtering is per keystroke and
          this line is the only feedback that a query matched anything. */}
      <p role="status" className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
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
                  // The studied count lives in this name rather than on the <span> that renders
                  // it, and that is the whole fix. An `aria-label` on a button *replaces* its
                  // contents as the accessible name (§14.19), so "L3", the title and "3/12" were
                  // all being discarded: labelling the child span could not have worked, however
                  // the span was marked up. Note this is why the same `role="img"` that rescues
                  // the progress dot below does not apply up here.
                  //
                  // No "Expand"/"Collapse" verb: `aria-expanded` is the state, and duplicating it
                  // in the name meant the label read "Collapse" on a button that search had
                  // disabled. Naming the thing and letting the attribute carry the state is the
                  // disclosure pattern this app already settled on (SPEC §8.4).
                  aria-label={`Lesson ${group.lesson}: ${group.title}, ${studiedCount} of ${group.points.length} studied`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  // `cursor: default` only. This carried `opacity: 0.6` while a search was
                  // active, which is the composite BRAND.md §3 forbids by name: it took the
                  // --ink-faint count from 4.8 : 1 to roughly 2.6 : 1, and dimming a *search
                  // result* is the last place to spend contrast. Nothing replaces it, because
                  // the ▼ chevron below already unmounts while searching, and that absence is
                  // the honest signal that there is nothing here to toggle.
                  style={q ? { cursor: "default" } : undefined}
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
                  {/* Visible form only; the announced form is in the button's aria-label above.
                      No `aria-hidden` needed: children of a named button are not announced. */}
                  <span className="flex-shrink-0 text-[12px]" style={{ color: "var(--ink-faint)" }}>
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
                          <span lang="ja" className="jp text-[18px]" style={{ fontWeight: 700, color: "var(--ink)" }}>
                            {p.pattern}
                          </span>
                          {p.reading !== p.pattern && (
                            <span lang="ja" className="jp text-[12px]" style={{ color: "var(--mag-600)" }}>
                              {p.reading}
                            </span>
                          )}
                          {/* Progress dot: green = mature (scheduledDays >= 21), magenta =
                              started but not yet mature, none = never studied. Lets a learner
                              scan the reference list and see what still needs attention. */}
                          <span
                            className="ml-auto flex-shrink-0 self-center rounded-full"
                            // `role="img"` is what makes the label count: `aria-label` is
                            // prohibited on a bare <span> (role `generic` supports no author
                            // name), so screen readers discarded it and the dot was
                            // sighted-only. Exactly the fix browse-client.tsx:275 applied to
                            // the vocab "in your deck" dot, and it transfers here because this
                            // row is a plain <div>: the label joins the row's text. Role and
                            // label are both conditional, since an unlabelled `role="img"`
                            // would announce an empty image on every unstudied point.
                            role={p.status === "new" ? undefined : "img"}
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
                          <p lang="ja" className="jp text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
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
