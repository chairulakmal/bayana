"use client";

// Moves focus deliberately after a study-mode transition (SPEC §8.4).
//
// The defect this fixes: every mode advances by swapping controls out from under the focused
// element. Rating a flashcard sets `flipped = false`, which unmounts the four rating buttons;
// answering a quiz question replaces the options with a Continue button. The browser's response
// to losing the focused element is to move focus to `<body>`, so a keyboard user re-Tabs from
// the top of the document on every single card, and a screen-reader user is told nothing at all
// about where they now are.
//
// **This file is the mechanism only; each component chooses its own target**, for the same
// reason `use-keyboard-shortcuts.ts` keeps its key map in the call site: the four modes
// genuinely disagree about what the next step is after a transition, and a hook that tried to
// decide would need a mode discriminator and would branch internally.
//
// **The rule the call sites follow, which is the part worth stating once:** focus a *button*
// only when the next step is a single unambiguous one ("Show answer", "Continue"). When the next
// step is a choice among several controls (the four ratings, the four options), focus a
// non-activatable anchor instead, never the first choice. Space and Enter natively activate a
// focused button, so focusing "Again" or option 1 would let a reflexive second Space press
// schedule a card the user had not read or answer a question they had not looked at. That is
// exactly the hazard SPEC §14.18 declined Anki's Space-rates-Good binding to avoid, and it would
// be a poor trade to reintroduce it here while fixing a focus bug.

import { useEffect, useRef, type RefObject } from "react";

/**
 * Focus `ref`'s element whenever `transition` changes, skipping the initial render.
 *
 * @param ref   The element to focus, or **`null` to deliberately leave focus alone** for the
 *              current screen state. That case is not hypothetical: revealing a flashcard fires
 *              a polite `role="status"` announcement of the answer, and moving focus in the same
 *              commit can cut a screen reader off mid-sentence, so the reveal transition opts out
 *              by name rather than by omission. `ref.current` may also be null at any moment,
 *              because the target frequently lives in a branch that is not currently rendered;
 *              that is likewise a no-op and not a failure to paper over.
 * @param transition A value that changes exactly when a transition happens, typically a small
 *              string encoding the screen state (`"3:true"`). Passing a *derived* value rather
 *              than a dependency array keeps the hook's dependency list statically checkable.
 *
 * Skipping the first render is not an optimisation but a correctness requirement: firing on
 * mount would yank focus (and a screen reader's cursor) off the top of a freshly-loaded page
 * into the middle of the session chrome, which is hostile and is not a transition at all.
 */
export function useFocusOnTransition(
  ref: RefObject<HTMLElement | null> | null,
  transition: string | number,
): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // `preventScroll` because every target here is already on screen by layout: the footer
    // controls are pinned and the card anchor is the element the user is looking at. Without it,
    // Safari in particular will scroll the flex column to "reveal" something already visible.
    ref?.current?.focus({ preventScroll: true });
  }, [ref, transition]);
}
