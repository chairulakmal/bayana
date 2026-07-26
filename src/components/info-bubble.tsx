"use client";

// A small "ⓘ" affordance that toggles a short explanatory popover. Mobile-first: it works
// on tap (not hover), and dismisses on outside-click or Escape. Used to explain the
// "ten words a day" pacing on the landing page and the home hub without cluttering the UI.
//
// Positioning: the popover is centred under the trigger and width-clamped to the viewport
// (w = min(16rem, 100vw − 2rem)), which keeps it on-screen at the 375px baseline wherever
// the trigger sits — no per-placement tuning needed.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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
  // "up" when there isn't enough room below the trigger to show the popover.
  const [direction, setDirection] = useState<"down" | "up">("down");
  const ref = useRef<HTMLSpanElement>(null);
  // Stable, SSR-safe id linking the trigger to the panel it reveals (same as UserMenu).
  const panelId = useId();

  // Dismiss on click outside the widget or on Escape — standard popover ergonomics.
  // Unlike UserMenu (SPEC §14.15) there is nothing to restore focus to on Escape: the panel
  // holds prose with no controls, so focus never left the trigger in the first place. If a
  // caller ever passes an interactive child, that stops being true and this needs the same
  // `triggerRef.current?.focus()` UserMenu carries.
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
        // `aria-expanded` alone announced "expanded" and left the user with nothing to find.
        // This is the same disclosure contract as UserMenu (SPEC §14.15): the trigger owns
        // expanded + controls, the panel is ordinary content. Emitted only while the panel is
        // mounted, since pointing at an absent id is a dangling reference.
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            // Popover is ~160px tall at minimum; flip up if less than that below the trigger.
            setDirection(window.innerHeight - rect.bottom < 160 ? "up" : "down");
          }
          setOpen((o) => !o);
        }}
        // tap-44-box, not tap-44: the painted circle is 16×16, so the vertical-only default
        // would still leave a 16px-wide target. That utility's warning is about two of these
        // sitting side by side and stealing each other's taps; here both call sites put static
        // prose either side of the trigger (the hub's pace line, the landing hero paragraph),
        // and prose has no hit area to lose. The circle stays 16px: BRAND.md §7 allows a
        // smaller painted box, never a smaller target.
        className="tap-44-box inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none"
        style={{ border: "1px solid var(--line)", color: "var(--ink-faint)", background: "var(--surface)" }}
      >
        i
      </button>
      {open && (
        <span
          id={panelId}
          // No `role="tooltip"`. In ARIA a tooltip is a hover/focus-triggered description
          // pointed at by `aria-describedby`; this panel is tap-toggled and pointed at by
          // `aria-controls`, so the role described a widget this is not. Same class of defect as
          // the fake ARIA menu in §14.15: it announced a tooltip a screen reader then had no
          // reliable way to reach. As plain content it is read in DOM order right
          // after the trigger that revealed it.
          className="absolute left-1/2 z-50 -translate-x-1/2 rounded-[var(--r-md)] p-3 text-left text-[12px] leading-relaxed"
          style={{
            ...(direction === "down" ? { top: "100%", marginTop: "0.5rem" } : { bottom: "100%", marginBottom: "0.5rem" }),
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
