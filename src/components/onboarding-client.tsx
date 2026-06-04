"use client";

// OnboardingClient — the interactive part of the first-run onboarding screen.
//
// State machine: no level selected → level selected (chips highlight, button enables)
// → submitting (pending, everything dims) → redirect to /quiz (server action).
//
// One deliberate choice: N5 → N1 order (easiest first). New users skew to lower levels
// and shouldn't have to scroll past N1/N2 to reach their level.

import { useState, useTransition } from "react";
import { Parrot } from "@/components/parrot";
import { completeOnboarding } from "@/app/onboarding/actions";
import type { Level } from "@/generated/prisma/enums";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

const LEVEL_LABEL: Record<string, string> = {
  N5: "Absolute beginner",
  N4: "Elementary",
  N3: "Intermediate",
  N2: "Upper-intermediate",
  N1: "Advanced",
};

export function OnboardingClient() {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!selected || pending) return;
    startTransition(async () => {
      await completeOnboarding(selected as Level);
    });
  }

  return (
    <div className="flex w-full flex-col items-center text-center">
      <Parrot expr="happy" style={{ width: 64, height: 72 }} />

      <h1
        className="mt-6 text-2xl"
        style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
      >
        What level are you studying?
      </h1>
      <p className="mt-2 text-[14px]" style={{ color: "var(--ink-soft)" }}>
        You can change this any time on the home screen.
      </p>

      {/* Level chips — N5 first (easiest) so beginners don't scroll */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {LEVELS.map((lvl) => {
          const active = lvl === selected;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelected(lvl)}
              disabled={pending}
              aria-pressed={active}
              className={`chip chip-${lvl.toLowerCase()}`}
              style={{
                padding: "9px 22px",
                fontSize: 16,
                opacity: pending ? 0.4 : 1,
                outline: active ? "2px solid currentColor" : "none",
                outlineOffset: 3,
                cursor: active ? "default" : "pointer",
                transition: "opacity .15s",
              }}
            >
              {lvl}
            </button>
          );
        })}
      </div>

      {/* Hint text fades in once a level is chosen */}
      <p
        className="mt-3 text-[13px]"
        style={{
          color: "var(--ink-faint)",
          minHeight: "1.4em", // reserves space so the button doesn't hop
          opacity: selected ? 1 : 0,
          transition: "opacity .2s",
        }}
      >
        {selected ? LEVEL_LABEL[selected] : ""}
      </p>

      <button
        type="button"
        onClick={submit}
        disabled={!selected || pending}
        className="btn btn-primary mt-8 w-full"
        style={{ opacity: !selected || pending ? 0.45 : 1, transition: "opacity .15s" }}
      >
        {pending ? "Starting…" : "Let's go →"}
      </button>
    </div>
  );
}
