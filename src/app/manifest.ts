// Web App Manifest (SPEC §8.4 / §13 Phase 4 — pulled forward). Next.js serves this
// typed object as /manifest.webmanifest; layout.tsx links to it via `metadata.manifest`.
//
// This is what makes Bayana installable and lets it launch chrome-free from the home
// screen. `display: "fullscreen"` is the goal — Android honours it (status bar hidden,
// true edge-to-edge); iOS Safari ignores it and falls back to "standalone" (chrome-free
// but keeps the status bar). The author is on Android, so the fallback is an accepted
// limitation, not something we engineer around (see SPEC §16, 2026-06-04).
//
// Per the manifest spec, an unsupported `display` value degrades down the chain
// fullscreen → standalone → minimal-ui → browser automatically, so no display_override
// is needed for the fallback.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bayana — JLPT vocab trainer",
    short_name: "Bayana",
    description:
      "Learn JLPT Japanese vocabulary with spaced repetition and AI-written example sentences.",
    // Logged-in entry point; an unauthenticated launch redirects to sign-in (proxy.ts).
    start_url: "/home",
    display: "fullscreen",
    // Mobile-first study app — lock to portrait so an installed launch never rotates
    // the single-card layout into an awkward landscape (BRAND.md platform focus).
    orientation: "portrait",
    background_color: "#fcfaf1", // --paper: the splash background while the app boots
    theme_color: "#fcfaf1", // matches viewport.themeColor in layout.tsx
    categories: ["education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable: lets Android crop Pī into its adaptive icon shape without clipping.
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
