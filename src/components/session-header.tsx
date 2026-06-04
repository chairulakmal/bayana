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
          A single opacity on this container uniformly dims all chrome — text,
          chips, and interactive pills — so focus stays on the card below. */}
      <div
        className="mt-2 flex items-center text-[13px]"
        style={{ color: "var(--ink-faint)", opacity: 0.65 }}
      >
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
    <Link
      href={href}
      className="rounded-full"
      style={{
        fontSize: "10px",
        padding: "2px 8px",
        color: "var(--ink-faint)",
        border: "1px solid var(--line)",
      }}
    >
      {children}
    </Link>
  );
}

/** A ghost-style pill button for use in SessionHeader slots (e.g. Undo).
 *  Sized to the same height as the level chip (10px text, 2px/8px padding) so the
 *  row stays vertically balanced. Outlined with --line; no fill or lip so it stays
 *  quiet during recall. Disabled state fades to 25% opacity. */
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
      className="rounded-full disabled:opacity-25"
      style={{
        fontSize: "10px",
        padding: "2px 8px",
        color: "var(--ink-faint)",
        border: "1px solid var(--line)",
      }}
    >
      {children}
    </button>
  );
}
