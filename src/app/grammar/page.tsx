// /grammar — Grammar hub page.
//
// Shows inline FSRS stats for the user's active level (due now, studied today,
// started/total progress bar, mature count) and a CTA card to start a study session.
// Vocab stats stay on /stats — this page is self-contained for the grammar queue.
// Requires auth (same as /home).

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel, hasOnboarded } from "@/lib/profile";
import { getGrammarStats, getSeededGrammarLevels } from "@/lib/grammar-review";
import { BottomNav } from "@/components/bottom-nav";
import { UserMenu } from "@/components/user-menu";
import { LevelPicker } from "@/components/level-picker";
import { LEVELS } from "@/components/level-chip";
import { Parrot } from "@/components/parrot";

export default async function GrammarPage() {
  const { userId, email, isDemo } = await requireAuth();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");

  const level = await getActiveLevel(userId);
  const grammarLevel = level.toString(); // "N3" etc.

  // Independent reads, so fetch concurrently rather than in sequence (same pattern as the
  // home hub). `seededLevels` powers the level picker's empty-deck markers.
  const [stats, seededLevels] = await Promise.all([
    getGrammarStats(userId, grammarLevel),
    getSeededGrammarLevels(),
  ]);
  const hasCards = stats.dueNow > 0 || stats.started < stats.total;

  // Only N3 grammar is seeded (SPEC §4.1). On any other active level `stats` is all zeros,
  // which the checks below would otherwise report as "All caught up" — telling the user they
  // have finished a deck that does not exist. Distinguish the empty-deck case explicitly.
  const hasDeck = stats.total > 0;

  // The complement of what is seeded, for the picker's markers. Built from LEVELS so the
  // set covers exactly the rows the picker renders.
  const unseededLevels = new Set(LEVELS.filter((lvl) => !seededLevels.has(lvl)));

  // Subtitle for the CTA card — contextual, never just a raw count.
  const ctaSubtitle = !hasDeck
    ? "No grammar deck for this level yet (N3 only)"
    : stats.dueNow > 0
      ? `${stats.dueNow} card${stats.dueNow === 1 ? "" : "s"} due`
      : stats.started < stats.total
        ? "New cards available"
        : "All caught up";

  // Guard against division by zero for the progress bar.
  const progressPct = stats.total > 0 ? Math.round((stats.started / stats.total) * 100) : 0;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Parrot expr="happy" style={{ width: 48, height: 54 }} />
          <div>
            <p lang="ja" className="jp text-[15px]" style={{ color: "var(--ink-soft)" }}>
              文法
            </p>
            <p className="text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
              Grammar · {grammarLevel}
            </p>
          </div>
        </div>
        <UserMenu email={email ?? ""} isDemo={isDemo} />
      </div>

      {/* Stats panel */}
      <section
        className="mt-6 rounded-[var(--r-lg)] p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        {/* Hero row: the two numbers a returning learner cares about most. */}
        <div className="grid grid-cols-2 gap-3">
          <StatCell label="Due now" value={stats.dueNow} highlight={stats.dueNow > 0} />
          <div className="flex flex-col items-center gap-1">
            <span
              className="text-2xl"
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 700,
                color: stats.studiedToday ? "var(--grape)" : "var(--ink-faint)",
              }}
            >
              {stats.studiedToday ? "✓" : "–"}
            </span>
            <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
              studied today
            </span>
          </div>
        </div>

        {/* Progress bar: started/total as a glanceable fill (BRAND §7 track style). */}
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "var(--cream-100)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, var(--magenta), var(--mag-500))",
              }}
            />
          </div>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
            {stats.started}/{stats.total} started · {stats.mature} mature
          </p>
        </div>
      </section>

      {/* CTA — flex-1 + justify-center vertically centres the button in the remaining
          viewport height below the stats panel (same trick as the original page but
          centred rather than bottom-anchored). */}
      <div className="flex flex-1 flex-col justify-center">
        {hasCards ? (
          <Link
            href="/grammar/study"
            className="flex items-center gap-4 rounded-[var(--r-lg)] p-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            <span className="text-4xl" aria-hidden>
              📖
            </span>
            <span>
              <span
                className="block text-xl"
                style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink)" }}
              >
                Grammar Points
              </span>
              <span className="block text-[14px]" style={{ color: "var(--ink-soft)" }}>
                {ctaSubtitle}
              </span>
            </span>
            <span className="ml-auto text-2xl" style={{ color: "var(--mag-500)" }} aria-hidden>
              →
            </span>
          </Link>
        ) : (
          // The inactive card. It carried `opacity-50`, which composited both text colours
          // to roughly half their measured ratio and put this card below AA — the exact
          // failure mode BRAND.md §3 forbids, and the same one the hub's disabled mode tile
          // was built to avoid. It now recedes the same way that tile does: by losing
          // elevation (paper fill, no shadow) with its text stepped down the ink ramp to
          // values that still clear 4.5 : 1. `cursor-not-allowed` is dropped too; there is
          // no control here to report as unavailable.
          <div
            className="flex items-center gap-4 rounded-[var(--r-lg)] p-5"
            style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
          >
            <span className="text-4xl" style={{ filter: "grayscale(1)" }} aria-hidden>
              📖
            </span>
            <span>
              <span
                className="block text-xl"
                style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink-soft)" }}
              >
                Grammar Points
              </span>
              <span className="block text-[14px]" style={{ color: "var(--ink-faint)" }}>
                {ctaSubtitle}
              </span>
            </span>
          </div>
        )}

        <Link
          href="/grammar/browse"
          className="mt-3 flex items-center justify-center gap-2 rounded-[var(--r-lg)] px-5 py-3 text-[14px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--ink-soft)",
          }}
        >
          <span aria-hidden>📚</span>
          Browse all grammar points
        </Link>
      </div>

      {/* ── Level ────────────────────────────────────────────────────────────
          Same control and same position as the home hub: below the actions, because a level
          is set rarely and a mode is chosen every session. It is here because switching
          level from the grammar hub previously meant a round trip through /home, and that
          round trip is now a one-way door — the hub's Grammar tile is disabled on levels
          with no seeded deck (§14.14), so leaving to switch means not coming back.

          Rows for unseeded levels are marked, not disabled: this sets the *global* active
          level, so choosing N5 from here is a legitimate act that re-scopes vocabulary
          study. The marker says the grammar deck is missing, not that the level is. */}
      <p
        className="mt-7 text-[11px] font-semibold"
        style={{
          color: "var(--ink-faint)",
          fontFamily: "var(--f-display)",
          letterSpacing: ".12em",
        }}
      >
        LEVEL
      </p>
      <div className="mt-2">
        <LevelPicker
          current={grammarLevel}
          emptyNote={{ levels: unseededLevels, label: "no deck yet" }}
        />
      </div>

      <BottomNav />
    </main>
  );
}

function StatCell({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-2xl"
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 700,
          color: highlight ? "var(--grape)" : "var(--ink)",
        }}
      >
        {value}
      </span>
      <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
        {label}
      </span>
    </div>
  );
}
