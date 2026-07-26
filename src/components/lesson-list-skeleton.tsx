// Placeholder for the /grammar/browse lesson accordion, shown while the server builds it.
//
// The grammar counterpart of `WordListSkeleton`, and a separate component rather than a reuse of
// it because the two lists have genuinely different silhouettes: /browse is one bordered card of
// flush rows, this is a stack of separate lesson cards with gaps between them. A placeholder
// whose shape does not match what replaces it reflows the page at the exact moment the content
// lands, which is the one thing a skeleton exists to prevent.
//
// Unlike the vocab page there is only one wait here to cover, the page's `<Suspense>` boundary,
// because `/grammar/browse` server-renders its lessons and its client component has no loading
// state of its own.

/** Collapsed lesson cards. Six roughly fills a phone viewport at ~62px per card plus gaps,
 *  without implying content below the fold that may not exist. */
const CARDS = 6;

export function LessonListSkeleton() {
  return (
    <div aria-hidden>
      {/* Search field: same height as the real input (py-3 + 15px text). */}
      <div className="skel h-[46px] w-full rounded-[var(--r-md)]" />

      {/* Result count line. */}
      <div className="skel mt-3 h-[12px] w-40" />

      {/* Lesson headers. Each card keeps its real border, radius and shadow so its edges are
          already in their final position when the real accordion arrives; only the chip, title
          and studied count inside are pending. */}
      <div className="mt-3 flex flex-col gap-3">
        {Array.from({ length: CARDS }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[var(--r-lg)] px-4 py-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            {/* L-chip, lesson title, studied count: the three columns of a real header. */}
            <div className="skel h-[20px] w-8 shrink-0 rounded-full" />
            <div className="skel h-[14px] flex-1" />
            <div className="skel h-[12px] w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
