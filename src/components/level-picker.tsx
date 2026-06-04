"use client";

// Inline level selector for the home hub (SPEC §8.5). Renders the five JLPT chips (the
// active one full-colour, the rest dimmed); tapping one persists it via the `setActiveLevel`
// server action and refreshes so `/study` and `/quiz` pick up the new level. This is the
// whole "set your level" UI — no separate settings/dashboard page (that's Phase 4).
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Level } from "@/generated/prisma/enums";
import { setActiveLevel } from "@/app/home/actions";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

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
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
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
              fontSize: 15,
              padding: "7px 16px",
              opacity: active ? 1 : 0.4,
              cursor: active ? "default" : "pointer",
            }}
          >
            {lvl}
          </button>
        );
      })}
    </div>
  );
}
