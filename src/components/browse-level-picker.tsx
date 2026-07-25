"use client";

// Compact level switcher for the browse page. Renders the five JLPT levels as a
// horizontal chip row rather than the full vertical list used on the home hub
// (LevelPicker). Selecting a chip:
//   1. Persists the choice to UserProfile.activeLevel via setActiveLevel (global scope —
//      home, study, quiz, stats, and browse all follow the same active level).
//   2. Navigates to /browse without a ?level= param so the server reads the DB value
//      rather than an override. This is important: if the user was at /browse?level=N3
//      and picks N5, router.push('/browse') clears the stale URL param.
//
// Industry rationale: "level" is a scope setting (determines what you study, quiz, and
// browse), not a local filter — the industry standard (Duolingo course, Anki deck,
// Khan Academy grade) is global persistence. See SPEC §16.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveLevel } from "@/app/home/actions";
import type { Level } from "@/generated/prisma/enums";
import { LEVELS, RING_COLOR } from "@/components/level-chip";

export function BrowseLevelPicker({ current }: { current: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function pick(level: string) {
    if (level === current || pending) return;
    startTransition(async () => {
      await setActiveLevel(level as Level);
      // Navigate to /browse without a ?level= param so the server picks up the updated
      // UserProfile.activeLevel from the DB rather than an old URL override.
      router.push("/browse");
    });
  }

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      {LEVELS.map((lvl) => {
        const active = lvl === current;
        return (
          <button
            key={lvl}
            type="button"
            onClick={() => pick(lvl)}
            disabled={pending}
            aria-pressed={active}
            className={`chip chip-${lvl.toLowerCase()} tap-44`}
            style={{
              // Real padding, not the default .chip 5px/12px: at ~54x36px each chip clears
              // 44px horizontally on its own, and `.tap-44` covers the vertical axis. Five
              // of these plus the 8px gaps come to ~302px, inside the 375px baseline.
              padding: "8px 16px",
              // Inactive chips are NOT dimmed. They used to sit at 0.45 opacity, which took
              // the white-on-colour chips (N5, N2) to roughly 2.5:1, unreadable, on the
              // labels of the controls themselves. Selection is carried by the ring below,
              // the same way the onboarding picker does it. `pending` still dims the whole
              // row, but that is a transient loading state, not a resting one.
              opacity: pending ? 0.4 : 1,
              cursor: active ? "default" : "pointer",
              // Selection ring as box-shadow, not outline. `outline: none` on the inactive
              // chips was silently suppressing the browser's focus ring, leaving keyboard
              // users with no focus indicator at all. Keeping outline free for the UA and
              // expressing selection in box-shadow separates the two concerns cleanly. The
              // inner --paper layer reads as a gap between chip and ring; RING_COLOR (not
              // currentColor) keeps the ring visible on the two white-text chips.
              boxShadow: active
                ? `0 0 0 2px var(--paper), 0 0 0 4px ${RING_COLOR[lvl]}`
                : undefined,
              transform: active ? "scale(1.04)" : undefined,
              transition: "opacity .15s, transform .15s",
            }}
          >
            {lvl}
          </button>
        );
      })}
    </div>
  );
}
