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

const LEVELS = ["N1", "N2", "N3", "N4", "N5"] as const;

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
            className={`chip chip-${lvl.toLowerCase()}`}
            style={{
              opacity: active ? 1 : pending ? 0.3 : 0.45,
              cursor: active ? "default" : "pointer",
              // Active chip gets a subtle ring to make selection unambiguous.
              outline: active ? "2px solid currentColor" : "none",
              outlineOffset: 2,
            }}
          >
            {lvl}
          </button>
        );
      })}
    </div>
  );
}
