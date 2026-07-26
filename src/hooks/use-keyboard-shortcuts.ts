"use client";

// Document-level keyboard shortcuts for the four study modes (SPEC §8.4).
//
// This file is the *mechanism* only. The key map itself, meaning which key does what, stays in
// each session component, because the four modes genuinely disagree about the shape of a
// turn: Flashcard and Grammar are reveal-then-rate, Quiz and Exam are pick-then-continue.
// A hook that tried to express both would take a mode discriminator and branch internally,
// which is the same conditional moved somewhere harder to read. What is worth sharing is
// the fiddly part: the four guards below, each of which is a bug if you forget it.
//
// Why a document listener rather than onKeyDown on the card: the controls a shortcut
// targets are frequently unmounted at the moment the key is pressed (rating a card
// unmounts the rating row, answering a question disables the option), so there is often no
// focused element to receive the event. Listening on the document is what makes the
// shortcut independent of where focus happens to have landed.

import { useEffect, useRef } from "react";

/**
 * A key name → handler map.
 *
 * Keys are lowercased `KeyboardEvent.key` values, with the space bar spelled `"space"`
 * rather than `" "` so call sites read as prose. A handler of `undefined` means "this key
 * is inert right now", which lets a component express a mode change (`flipped ? … :
 * undefined`) as data rather than by swapping map objects.
 */
export type ShortcutMap = Record<string, (() => void) | undefined>;

/** `" "` is the real `KeyboardEvent.key` for the space bar; every other key is used as-is. */
function normalizeKey(key: string): string {
  return key === " " ? "space" : key.toLowerCase();
}

/** Anything that swallows typing: a shortcut must never eat a character the user meant. */
function isTextEntry(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
  );
}

/**
 * Elements the browser already activates on Space/Enter. We must defer to that native
 * activation rather than handling the key ourselves, or a focused control fires twice.
 */
function isNativelyActivatable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "BUTTON" || tag === "SUMMARY" || (tag === "A" && el.hasAttribute("href"));
}

/**
 * Binds a key map to the document for as long as `enabled` is true.
 *
 * @param map      Key name → handler. Rebuilt every render; see the ref dance below.
 * @param enabled  Whether the shortcuts are live. Callers pass the "is the interactive
 *                 screen actually showing" condition here, so keys go quiet on loading,
 *                 error and summary screens, which are ordinary button layouts where a
 *                 global Space handler would be a surprise rather than a shortcut.
 */
export function useKeyboardShortcuts(map: ShortcutMap, enabled = true): void {
  // The map is a fresh object on every render (its handlers close over current state), so
  // making the effect below depend on it would tear the listener down and re-attach it on
  // every keystroke and every state change. Parking the latest map in a ref instead lets
  // the listener stay mounted while still calling today's handlers, and keeps the effect's
  // dependency list down to `enabled`. This is the standard "latest ref" pattern.
  const mapRef = useRef(map);
  useEffect(() => {
    mapRef.current = map;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      // 1. Modified chords belong to the browser and the OS. Ctrl/Cmd+1 switches tabs and
      //    Alt+Enter opens properties; shadowing those is worse than having no shortcut.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

      // 2. Auto-repeat from a held-down key would rate a whole session in one press.
      if (event.repeat) return;

      // 3. Never intercept typing. No session screen has a text field today, but the hook
      //    is generic and /browse is one obvious future caller.
      if (isTextEntry(event.target)) return;

      const key = normalizeKey(event.key);

      // 4. Space and Enter already activate a focused button. Letting this handler also
      //    run would double-fire: Tab to "Show answer", press Enter, and the card would
      //    flip and immediately flip again. Digits are never natively handled, so they
      //    pass through even while a button holds focus, which is what makes "1" work
      //    right after a mouse click has left focus sitting on some other control.
      if ((key === "space" || key === "enter") && isNativelyActivatable(event.target)) return;

      const handler = mapRef.current[key];
      if (!handler) return;

      // Space scrolls the page by default. Only prevent it once we know we handled the
      // key, so an unmapped key keeps its normal browser behaviour.
      event.preventDefault();
      handler();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
