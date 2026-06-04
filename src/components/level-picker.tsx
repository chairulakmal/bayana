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

// N1 at top (hardest / the goal), N5 at bottom (easiest / the start).
const LEVELS = ["N1", "N2", "N3", "N4", "N5"] as const;

const LEVEL_LABEL: Record<string, string> = {
  N1: "匠 · the artisan",
  N2: "流暢へ · the expert",
  N3: "上達 · the journeyman",
  N4: "頑張れ · the practitioner",
  N5: "はじめよう · the apprentice",
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
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
            style={{
              background: active ? "var(--surface)" : "var(--surface-cream)",
              borderTop: i > 0 ? "1px solid var(--line)" : undefined,
              cursor: active ? "default" : "pointer",
              opacity: pending && !active ? 0.4 : 1,
            }}
          >
            {/* Level chip — brand colour at full opacity regardless of active state */}
            <span
              className={`chip chip-${lvl.toLowerCase()}`}
              style={{
                fontSize: "12px",
                padding: "3px 10px",
                flexShrink: 0,
                opacity: active ? 1 : 0.55,
              }}
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
              {LEVEL_LABEL[lvl]}
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
