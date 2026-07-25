"use client";

// Inline level selector for the home hub (SPEC §8.5). Renders the five JLPT levels as
// a vertical grouped list (N1 → N5, hardest first). Tapping a row persists it via the
// `setActiveLevel` server action and refreshes so /study and /quiz pick up the change.
//
// Pattern: "radio list inside a card" — the iOS/Android settings convention.
// Active row: white surface (pops against the cream background of the siblings).
// Inactive rows: cream, dimmed text — present but recessive.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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

export function LevelPicker({ current }: { current: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function pick(level: string) {
    if (level === current || pending) return;
    startTransition(async () => {
      await setActiveLevel(level as Level);
      router.refresh();
    });
  }

  return (
    <div
      className="overflow-hidden rounded-[var(--r-lg)]"
      style={{ border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
      aria-busy={pending}
    >
      {LEVELS.map((lvl, i) => {
        const active = lvl === current;
        return (
          <button
            key={lvl}
            type="button"
            onClick={() => pick(lvl)}
            disabled={pending}
            aria-pressed={active}
            // py-3.5 (not py-2.5): with the 22px chip this makes each row about 50px tall,
            // clearing the 44px minimum touch target BRAND.md sets for thumb-reachable
            // controls. The tighter padding put every row under that floor.
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            style={{
              background: active ? "var(--surface)" : "var(--surface-cream)",
              borderTop: i > 0 ? "1px solid var(--line)" : undefined,
              cursor: active ? "default" : "pointer",
              opacity: pending && !active ? 0.4 : 1,
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
