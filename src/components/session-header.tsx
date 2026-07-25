// Shared progress header for Flashcard mode and Quiz mode sessions.
//
// Renders a progress bar + a three-slot info row: a left slot (caller-supplied),
// a centred level chip using the brand chip-n{x} palette, and an optional right
// slot. The three-column flex layout (flex-1 / auto / flex-1 justify-end) keeps
// the chip truly centred regardless of the widths of the surrounding slots.
//
// SessionHeaderLink and SessionHeaderButton are the canonical interactive elements
// for the slots — intentionally subdued (ink-faint, no bold, underline-only) so
// chrome doesn't compete with the card content during recall.

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  /** 0–100: controls the filled width of the progress bar. */
  progress: number;
  /** JLPT level string, e.g. "N3" — selects the chip-n{x} colour class. */
  level: string;
  /** Left slot — typically "Home · N left" (Flashcard) or "X / total" (Quiz). */
  left: ReactNode;
  /** Right slot — typically an Undo button (Flashcard) or a Home link (Quiz). */
  right?: ReactNode;
};

/** Progress header shared by Flashcard mode (/study) and Quiz mode (/quiz). */
export function SessionHeader({ progress, level, left, right }: Props) {
  return (
    <header className="mx-auto w-full max-w-md px-4 pt-4">
      {/* Progress bar */}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--cream-100)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--magenta), var(--mag-500))",
          }}
        />
      </div>

      {/* Info row: left slot | centred chip | right slot.
          No container opacity. It used to carry `opacity: 0.65`, which stacked on top of
          --ink-faint and dropped the row to roughly 2:1 against --paper, including the
          only exit and the only undo in a session. Recessiveness now comes from size and
          colour choice alone, both of which stay above the AA floor. */}
      <div className="mt-2 flex items-center text-[13px]" style={{ color: "var(--ink-faint)" }}>
        <span className="flex-1">{left}</span>
        {/* Level chip — centred; small scale so it reads as context, not navigation */}
        <span
          className={`chip chip-${level.toLowerCase()}`}
          style={{ fontSize: "10px", padding: "2px 8px" }}
        >
          {level}
        </span>
        <span className="flex flex-1 justify-end">{right}</span>
      </div>
    </header>
  );
}

/* Shared pill styling for the two interactive slots. --ink-soft (7:1), a step stronger
 * than the row's ambient --ink-faint: these are controls, and a control should not be
 * quieter than the text beside it. 12px rather than the old 10px, which was below the
 * readable floor for a control label. `.tap-44` lifts the ~26px painted pill to a 44px
 * hit target without making the header taller (see globals.css). */
const PILL_CLASS = "tap-44 rounded-full";
const PILL_STYLE = {
  fontSize: "12px",
  padding: "4px 10px",
  color: "var(--ink-soft)",
  border: "1px solid var(--line)",
} as const;

/** A ghost pill link for use in SessionHeader slots — identical appearance to
 *  SessionHeaderButton so Home and Undo read as the same visual weight. */
export function SessionHeaderLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={PILL_CLASS} style={PILL_STYLE}>
      {children}
    </Link>
  );
}

/** A ghost-style pill button for use in SessionHeader slots (e.g. Undo).
 *  Matches SessionHeaderLink exactly so the row reads as one family. Outlined with
 *  --line; no fill or lip so it stays quiet during recall. Disabled fades to 40%,
 *  enough to read as unavailable, not so far that it vanishes. */
export function SessionHeaderButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${PILL_CLASS} disabled:opacity-40`}
      style={PILL_STYLE}
    >
      {children}
    </button>
  );
}
