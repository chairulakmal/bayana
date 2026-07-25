"use client";

// OnboardingClient — the interactive part of the first-run onboarding screen.
//
// State machine: no level selected → level selected (chips highlight, button enables)
// → submitting (pending, everything dims) → redirect to /quiz (server action).
//
// Layout: N1 alone on top (hardest/rarest), N4/N5 on the bottom row closest to the
// thumb (most common starting point). Explicit rows keep the pyramid stable across
// all screen widths without relying on flex-wrap behaviour.

import { useState, useTransition } from "react";
import { Parrot } from "@/components/parrot";
import { completeOnboarding } from "@/app/onboarding/actions";
import type { Level } from "@/generated/prisma/enums";
import { RING_COLOR, type LevelStr } from "@/components/level-chip";

// Row order: N1 top → N4/N5 bottom.
const LEVEL_ROWS = [["N1"], ["N2", "N3"], ["N4", "N5"]] as const;

const LEVEL_LABEL: Record<LevelStr, string> = {
  N5: "Absolute beginner",
  N4: "Elementary",
  N3: "Intermediate",
  N2: "Upper-intermediate",
  N1: "Advanced",
};

export function OnboardingClient() {
  const [selected, setSelected] = useState<LevelStr | null>(null);
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

      <div className="mt-8 flex flex-col items-center gap-3">
        {LEVEL_ROWS.map((row) => (
          <div key={row.join()} className="flex gap-3">
            {row.map((lvl) => {
              const active = lvl === selected;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelected(lvl)}
                  disabled={pending}
                  aria-pressed={active}
                  className={`chip chip-${lvl.toLowerCase()} tap-44`}
                  style={{
                    padding: "9px 22px",
                    fontSize: 16,
                    opacity: pending ? 0.4 : 1,
                    // Selection ring as box-shadow rather than outline: `outline: "none"`
                    // on the inactive chips was suppressing the browser's own focus ring,
                    // so keyboard users had no focus indicator here. outline now belongs to
                    // the UA, box-shadow to us. The inner --paper layer is the ring gap
                    // outlineOffset used to provide.
                    boxShadow: active
                      ? `0 0 0 3px var(--paper), 0 0 0 5px ${RING_COLOR[lvl]}`
                      : undefined,
                    transform: active ? "scale(1.06)" : undefined,
                    cursor: active ? "default" : "pointer",
                    transition: "opacity .15s, transform .15s",
                  }}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Hint text fades in once a level is chosen */}
      <p
        className="mt-3 text-[13px]"
        style={{
          color: "var(--ink-faint)",
          minHeight: "1.4em",
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
