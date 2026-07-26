// Shared placeholder for the browse word list, rendered by two different waits that a user
// experiences as one.
//
// Tapping "Browse" queues two loads back to back: the server render (auth + active level),
// covered by `app/browse/loading.tsx`, and then the client fetch of the level's whole word
// list, covered by `BrowseClient`'s own `words === null` branch. The second is by far the
// longer of the two — it is thousands of rows over the network — so a rich skeleton for the
// short wait followed by a bare "Loading words…" for the long one would make the page appear
// to get *less* finished as it loads.
//
// Rendering the same component in both places removes the seam entirely: the placeholder
// paints once and simply stays until the real rows replace it.
//
// A Server Component with no state, so importing it into the client-side `BrowseClient`
// costs only its markup in the bundle.

/** Number of placeholder rows. Chosen to fill a phone viewport without overshooting it —
 *  a skeleton longer than the screen implies content below the fold that may not exist. */
const ROWS = 8;

export function WordListSkeleton() {
  return (
    <div aria-hidden>
      {/* Search field: same height as the real input (py-3 + 15px text). */}
      <div className="skel h-[46px] w-full rounded-[var(--r-md)]" />

      {/* Result count line. */}
      <div className="skel mt-3 h-[12px] w-24" />

      {/* The list keeps its real border and shadow rather than being one big grey block, so
          the card's edges are already in their final position when the rows arrive. */}
      <div
        className="mt-3 overflow-hidden rounded-[var(--r-lg)]"
        style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
      >
        {Array.from({ length: ROWS }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderTop: i > 0 ? "1px solid var(--line)" : undefined,
              background: "var(--surface)",
            }}
          >
            {/* Expression, reading, meaning — the three columns of a real row, at roughly
                their real widths so the eye already knows where to look. */}
            <div className="skel h-[24px] w-14 shrink-0" />
            <div className="skel h-[13px] w-12 shrink-0" />
            <div className="skel h-[13px] flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
