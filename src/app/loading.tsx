import { Parrot } from "@/components/parrot";

// Root loading fallback. Adding this file wraps the whole app in a Suspense boundary, so
// any route that awaits data on the server shows this instead of a blank viewport while the
// server answers. Every page in Bayana except the marketing homepage awaits at least
// `requireAuth()`, so before this existed, every single navigation painted nothing.
//
// This is the *generic* fallback, and it is deliberately the weaker of the two options in
// the app. The pages worth loading well — the home hub, browse, stats — each ship their own
// `loading.tsx` beside them, which Next.js uses in preference to this one because the
// nearest boundary wins. A layout-shaped skeleton beats a spinner: it resolves into the real
// page rather than being swapped out for something that looks nothing like it. This file's
// job is only to make sure no route is ever left uncovered, including future ones.

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {/* Sleepy Pī: the app is waiting, not working hard at something. */}
      <Parrot expr="sleepy" title="Pī, dozing" style={{ width: 88, height: 98 }} />

      {/* `role="status"` is best-effort here rather than guaranteed. `quiz-session.tsx:179`
          records why: a live region created at the moment its content appears is often not
          announced, and a Suspense fallback is that case by construction — it does not exist
          until the moment it has something to say. It costs nothing and helps on the screen
          readers that do handle late-mounted status nodes, so it stays, but the visible text
          is what most users will rely on. */}
      <p role="status" aria-live="polite" className="text-[15px]" style={{ color: "var(--ink-soft)" }}>
        <span lang="ja" className="jp">
          ちょっと待って
        </span>
        <span className="mt-1 block text-[13px]" style={{ color: "var(--ink-faint)" }}>
          Loading…
        </span>
      </p>
    </main>
  );
}
