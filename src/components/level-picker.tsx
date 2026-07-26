"use client";

// Inline level selector, mounted on the home hub (SPEC §8.5) and the grammar hub. Renders
// the five JLPT levels as a vertical grouped list (N1 → N5, hardest first). Tapping a row moves
// the check mark immediately (`useOptimistic`) and persists it via the `setActiveLevel` server
// action, whose `revalidatePath` calls are what make every level-scoped page pick up the change.
//
// The level it sets is global, not per-page: switching from the grammar hub also re-scopes
// vocabulary study. That is why `emptyNote` annotates rows rather than disabling them.
//
// Pattern: "radio list inside a card" — the iOS/Android settings convention.
// Active row: white surface (pops against the cream background of the siblings).
// Inactive rows: cream, dimmed text — present but recessive.

import { useOptimistic, useTransition } from "react";
import type { Level } from "@/generated/prisma/enums";
import { setActiveLevel } from "@/app/home/actions";
// N1 at top (hardest / the goal), N5 at bottom (easiest / the start): the shared order.
import { LEVELS } from "@/components/level-chip";

// Split rather than one "匠 · the artisan" string: the row renders in --f-display, and
// Fredoka has no CJK glyphs, so a combined label put every Japanese name in the system
// font while the English half stayed on-brand. The two halves need different faces
// (BRAND.md §4), which a single string cannot express.
const LEVEL_LABEL: Record<string, { ja: string; en: string }> = {
  N1: { ja: "匠", en: "the artisan" },
  N2: { ja: "流暢へ", en: "the expert" },
  N3: { ja: "上達", en: "the journeyman" },
  N4: { ja: "頑張れ", en: "the practitioner" },
  N5: { ja: "はじめよう", en: "the apprentice" },
};

export function LevelPicker({
  current,
  emptyNote,
}: {
  current: string;
  /**
   * Marks rows that have nothing behind them *on the page hosting the picker* — grammar
   * levels with no seeded deck, today. Annotated, never disabled: this control sets the
   * global `activeLevel` that vocabulary study also reads, so a level with no grammar deck
   * is still a perfectly valid thing to switch to from the grammar hub.
   *
   * The marker text is supplied by the caller rather than baked in, so the picker stays
   * domain-agnostic: /home mounts it with no note at all.
   */
  emptyNote?: { levels: ReadonlySet<string>; label: string };
}) {
  const [pending, startTransition] = useTransition();
  // **This is what `useOptimistic` is for**, and the distinction matters because the flashcard
  // loop deliberately does *not* use it (see `study-session.tsx`'s note on `index`). The hook
  // reconciles an optimistic value against server-owned state and drops it when the transition
  // settles, so it needs a base value the server actually replaces. `current` is exactly that:
  // it is a prop rendered by the RSC from `UserProfile.activeLevel`, and `revalidatePath` inside
  // the action re-renders this page with the new one. There is something to reconcile against,
  // so the check mark can move now and be confirmed (or reverted, if the write fails) later.
  const [optimisticLevel, setOptimisticLevel] = useOptimistic(current);

  function pick(level: string) {
    if (level === optimisticLevel) return;
    startTransition(async () => {
      // Must be called inside the transition: outside one, React has no scope in which to hold
      // the optimistic value, and it would be discarded on the next render.
      setOptimisticLevel(level);
      await setActiveLevel(level as Level);
      // No `router.refresh()`. `setActiveLevel` calls `revalidatePath` on all five level-scoped
      // paths, and a Server Function's response carries the re-rendered payload for the route
      // being viewed in the same round trip ("Updates the UI immediately (if viewing the
      // affected path)", Next.js `revalidatePath` docs, verified against 16.2.7). The refresh
      // was therefore a *second* request for a render we had already been handed.
    });
  }

  return (
    <div
      className="overflow-hidden rounded-[var(--r-lg)]"
      style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
      aria-busy={pending}
    >
      {LEVELS.map((lvl, i) => {
        const active = lvl === optimisticLevel;
        const isEmpty = emptyNote?.levels.has(lvl) ?? false;
        return (
          <button
            key={lvl}
            type="button"
            onClick={() => pick(lvl)}
            // Not `disabled={pending}`, for the reason globals.css spells out for `.opt`:
            // browsers blur a control the instant it is disabled, so disabling the row the user
            // just tapped dropped focus to <body> on every level switch. Nothing needs to
            // replace it, because React dispatches Server Functions sequentially, so a second tap
            // mid-flight simply queues behind the first and the last one wins, and the check
            // mark has already moved to wherever the user last tapped.
            aria-pressed={active}
            // py-3.5 (not py-2.5): with the 22px chip this makes each row about 50px tall,
            // clearing the 44px minimum touch target BRAND.md sets for thumb-reachable
            // controls. The tighter padding put every row under that floor.
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            // No `opacity` while a switch is in flight. Dimming every inactive row to 0.4 was
            // the old stand-in for feedback, and it was both a contrast regression (BRAND.md §3
            // forbids exactly this composite) and a lie about how long the write takes: the
            // optimistic check mark below is the feedback now, and it lands on the next frame.
            style={{
              background: active ? "var(--surface)" : "var(--surface-cream)",
              borderTop: i > 0 ? "1px solid var(--line)" : undefined,
              cursor: active ? "default" : "pointer",
            }}
          >
            {/* Level chip, always at full opacity. Inactive rows used to dim theirs to
                0.55, which composited the white-on-colour chips (N5, N2) down to ~3.2:1;
                the chip *is* the row's label, so that was the one element that could not
                afford to fade. The row already reads as inactive from its cream fill and
                --ink-soft label, so the opacity was redundant as well as harmful. */}
            <span
              className={`chip chip-${lvl.toLowerCase()}`}
              style={{ fontSize: "12px", padding: "3px 10px", flexShrink: 0 }}
            >
              {lvl}
            </span>

            {/* Difficulty name */}
            <span
              className="flex-1 text-[13px]"
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 600,
                color: active ? "var(--ink)" : "var(--ink-soft)",
              }}
            >
              <span lang="ja" className="jp">
                {LEVEL_LABEL[lvl].ja}
              </span>{" "}
              · {LEVEL_LABEL[lvl].en}
            </span>

            {/* Empty-deck marker. Sits before the check column so it never displaces it, and
                is real text rather than a dimmed row: the row still does something, it just
                does nothing *here*. --ink-faint clears AA, so this needs no opacity. */}
            {isEmpty && (
              <span
                className="flex-shrink-0 text-[11px]"
                style={{ color: "var(--ink-faint)" }}
              >
                {emptyNote?.label}
              </span>
            )}

            {/* Active indicator — green check, right-aligned */}
            <span
              aria-hidden
              style={{
                fontSize: "13px",
                color: "var(--good)",
                opacity: active ? 1 : 0,
                // keep space reserved so the row width doesn't shift on selection
                width: "1em",
                textAlign: "center",
              }}
            >
              ✓
            </span>
          </button>
        );
      })}
    </div>
  );
}
