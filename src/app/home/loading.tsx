import { Parrot } from "@/components/parrot";
import { BottomNav } from "@/components/bottom-nav";

// Loading skeleton for the home hub. Takes precedence over the root `app/loading.tsx`
// because Next.js uses the nearest boundary, and it earns that precedence by holding the
// hub's actual shape: the greeting row, the Today panel, the CTA, the 2x2 mode grid, the
// level picker. When the data arrives the real page settles into these boxes instead of
// replacing a centred spinner, so nothing jumps.
//
// Two rules decide what is a skeleton and what is not:
//
//   • Anything that needs no data is rendered for real — the section labels, the mascot, the
//     bottom nav. Greying out text the server already knows would be a fake delay, and the
//     nav in particular is genuinely usable while the hub loads, so a placeholder there
//     would remove working navigation rather than stand in for it.
//   • Anything data-derived becomes a `.skel` block sized to its real counterpart. The
//     fidelity here is dimensional, not textual: this file deliberately does not restate the
//     mode-tile copy from `page.tsx`, because a second copy of that copy would drift the
//     first time a subtitle changes, and a loading state is the last place anyone would
//     notice the drift.

export default function HomeLoading() {
  return (
    // Same shell as page.tsx, down to min-h-svh and the pb-28 that clears the fixed nav.
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-28">
      {/* ── Greeting + account menu ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* The real bird. Its expression is data-derived (happy vs wow), so it may flip
              once the snapshot lands, but showing the default beats a grey blob where the
              brand's most recognisable element belongs. */}
          <Parrot expr="happy" title="Pī" style={{ width: 48, height: 54 }} />
          <div aria-hidden>
            <div className="skel h-[15px] w-16" />
            <div className="skel mt-2 h-[22px] w-40" />
          </div>
        </div>
        {/* Avatar button: round, and sized to the real control. */}
        <div className="skel h-9 w-9 shrink-0 rounded-full" aria-hidden />
      </div>

      {/* ── Today panel ──────────────────────────────────────────────────── */}
      <section
        className="mt-6 rounded-[var(--r-lg)] p-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        <p
          className="text-[11px] font-semibold"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--f-display)", letterSpacing: ".12em" }}
        >
          TODAY
        </p>

        {/* Three stats: a big number over a small label, matching the real `Stat`. */}
        <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="skel h-[26px] w-9" />
              <div className="skel h-[11px] w-14" />
            </div>
          ))}
        </div>

        {/* Progress bar. The track is already --cream-100 in the real page, so here it is
            simply an unfilled track rather than a skeleton of one — which is exactly what
            "we do not know your progress yet" should look like. */}
        <div className="mt-4" aria-hidden>
          <div className="h-2 rounded-full" style={{ background: "var(--cream-100)" }} />
          <div className="mt-2 flex items-center gap-1.5">
            <div className="skel h-[18px] w-9 rounded-full" />
            <div className="skel h-[12px] w-36" />
          </div>
        </div>
      </section>

      {/* ── Primary CTA ──────────────────────────────────────────────────────
          Height matches .btn-lg (18px padding + 20px line), so the mode grid below does not
          shift downward when the real button replaces this. */}
      <div className="skel mt-5 h-[56px] w-full rounded-[var(--r-md)]" aria-hidden />
      <div className="skel mt-3 h-[13px] w-48 self-center" aria-hidden />

      {/* ── Mode grid ────────────────────────────────────────────────────── */}
      <p
        className="mt-7 text-[11px] font-semibold"
        style={{ color: "var(--ink-faint)", fontFamily: "var(--f-display)", letterSpacing: ".12em" }}
      >
        STUDY MODES
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          // minHeight 104 is the real ModeTile floor — copied so the grid occupies its final
          // height immediately.
          <div key={i} className="skel rounded-[var(--r-lg)]" style={{ minHeight: 104 }} />
        ))}
      </div>

      {/* ── Level ────────────────────────────────────────────────────────── */}
      <p
        className="mt-7 text-[11px] font-semibold"
        style={{ color: "var(--ink-faint)", fontFamily: "var(--f-display)", letterSpacing: ".12em" }}
      >
        LEVEL
      </p>
      <div className="skel mt-2 h-[44px] w-full rounded-[var(--r-md)]" aria-hidden />

      <div className="skel mt-5 h-[13px] w-44 self-center" aria-hidden />

      {/* Real nav, not a placeholder: it needs no data and stays usable while the hub loads. */}
      <BottomNav />

      <span className="sr-only" role="status" aria-live="polite">
        Loading your home screen
      </span>
    </main>
  );
}
