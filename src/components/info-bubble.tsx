"use client";

// A small "ⓘ" affordance that toggles a short explanatory popover. Mobile-first: it works
// on tap (not hover), and dismisses on outside-click or Escape. Used to explain the
// "ten words a day" pacing on the landing page and the home hub without cluttering the UI.
//
// Positioning: the popover is centred under the trigger and width-clamped to the viewport
// (w = min(16rem, 100vw − 2rem)), which keeps it on-screen at the 375px baseline wherever
// the trigger sits — no per-placement tuning needed.

import { useEffect, useRef, useState, type ReactNode } from "react";

export function InfoBubble({
  label = "More info",
  children,
}: {
  /** Accessible name for the trigger button (what the popover is about). */
  label?: string;
  /** Popover content. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Dismiss on click outside the widget or on Escape — standard popover ergonomics.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none"
        style={{ border: "1px solid var(--line)", color: "var(--ink-faint)", background: "var(--surface)" }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-full left-1/2 z-20 mt-2 -translate-x-1/2 rounded-[var(--r-md)] p-3 text-left text-[12px] leading-relaxed"
          style={{
            width: "min(16rem, calc(100vw - 2rem))",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
            color: "var(--ink-soft)",
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
