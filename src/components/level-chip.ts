// Shared presentation constants for the JLPT level chips (BRAND.md §7).
//
// This exists for one fact that is easy to get wrong and expensive to get wrong twice:
// two of the five chips use white text, so anything drawn in `currentColor` around them
// is white-on-light and therefore invisible. Both the home/browse pickers and the
// onboarding picker draw a selection ring, so the mapping lives here rather than being
// copy-pasted into each: a duplicated contrast rule is a contrast bug waiting to
// reappear the next time one copy is edited.

/** The five JLPT levels, hardest first: the order every picker presents them in. */
export const LEVELS = ["N1", "N2", "N3", "N4", "N5"] as const;

export type LevelStr = (typeof LEVELS)[number];

/**
 * Colour for a chip's *selection* ring.
 *
 * `.chip-n5` (white on --good) and `.chip-n2` (white on --mag-600) carry white text, so
 * `currentColor` resolves to white and the ring disappears against --paper / --surface-cream.
 * Those two fall back to --ink; the rest read fine in their own text colour.
 *
 * Draw the ring with `box-shadow`, never `outline`, because `outline` belongs to the browser's
 * focus indicator, and claiming it for selection means setting `outline: none` on the
 * unselected chips, which silently removes keyboard focus from them.
 */
export const RING_COLOR: Record<LevelStr, string> = {
  N1: "currentColor",
  N2: "var(--ink)",
  N3: "currentColor",
  N4: "currentColor",
  N5: "var(--ink)",
};
