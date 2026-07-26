import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel, getNewCardsPerDay, hasOnboarded } from "@/lib/profile";
import { getHomeSnapshot, pickNextAction, type HomeSnapshot } from "@/lib/home";
import { Parrot } from "@/components/parrot";
import { LevelPicker } from "@/components/level-picker";
import { InfoBubble } from "@/components/info-bubble";
import { UserMenu } from "@/components/user-menu";
import { BottomNav } from "@/components/bottom-nav";

// The home hub (SPEC §8.5): the post-login landing for every user, and the app's default
// page. Three jobs, in priority order:
//
//   1. Answer "what should I do right now?" in one glance (the Today panel) and one tap
//      (the primary CTA, chosen by `pickNextAction`). This is the §2 no-config promise.
//   2. Offer all four study modes, including Grammar, which used to be reachable only
//      from the bottom nav, so the hub silently under-reported what the app can do.
//   3. Let the level be changed inline, without a settings page.
//
// It is a *light* dashboard, not the full one: no streak, no history, no charts. Those
// warrant a richer screen and stay on `/stats` (SPEC §13 Phase 4). Ordering reflects
// frequency: the modes you tap every session sit above the level you change once a month.
//
// Heading structure (SPEC §8.4): the greeting is the `<h1>` and each of the three section
// labels is an `<h2>`. Those labels were `<p>` elements, so the app's *default* page — the
// one a screen-reader user lands on after every sign-in — offered nothing at all to heading
// navigation. They read as headings to a sighted user already; the markup now says so.
export const metadata = { title: "Home" };

export default async function HomePage() {
  const { userId, email, isDemo } = await requireAuth();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");

  const level = await getActiveLevel(userId);
  // Independent reads, so fetch concurrently rather than awaiting in sequence. On the app's
  // default landing page the serial version needlessly stacks extra round-trips.
  const [newPerDay, snapshot] = await Promise.all([
    getNewCardsPerDay(userId),
    getHomeSnapshot(userId, level),
  ]);
  const next = pickNextAction(snapshot);

  // Server-only env var (not NEXT_PUBLIC_), so the address appears only in rendered HTML,
  // never in the client bundle or source control.
  const contactEmail = process.env.OWNER_CONTACT_EMAIL;

  const doneToday = snapshot.cardsStudiedToday;

  return (
    // min-h-svh (not dvh): the "small" viewport height is fixed at the bar-visible size, so
    // the layout doesn't hop when Android's gesture/nav bar shows or hides in the installed
    // PWA. dvh recomputes live and would shift things mid-scroll.
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-28">
      {/* ── Greeting + account menu ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Pī reacts to the day: "wow" once you've studied, default "happy" otherwise
              (BRAND.md §2 uses the expression set to acknowledge progress). */}
          <Parrot expr={doneToday > 0 ? "wow" : "happy"} style={{ width: 48, height: 54 }} />
          <div>
            <p lang="ja" className="jp text-[15px]" style={{ color: "var(--ink-soft)" }}>
              おかえり
            </p>
            <h1 className="text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
              {/* Encouraging, never a scold (BRAND.md §1): showing up is the win. */}
              {doneToday > 0 ? "Nice work today" : "Let's study"}
            </h1>
          </div>
        </div>
        <UserMenu email={email ?? ""} isDemo={isDemo} />
      </div>

      {/* ── Demo notice ──────────────────────────────────────────────────────
          Only for demo users. Now a bordered inset card rather than loose grey text:
          demo visitors are often first-time reviewers, and the cookie-bound nature of
          their progress is something they need to actually notice before investing in it.
          Still deliberately calm: informational, not an alarm. */}
      {isDemo && (
        <aside
          className="mt-4 rounded-[var(--r-md)] px-3.5 py-3 text-[12px] leading-relaxed"
          style={{
            background: "var(--surface-cream)",
            border: "1px solid var(--line)",
            color: "var(--ink-soft)",
          }}
        >
          <span aria-hidden>👋 </span>
          <strong style={{ color: "var(--ink)" }}>You&apos;re in the demo.</strong> Everything
          works. Your progress just lives in this browser for 7 days.{" "}
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent("Bayana access request")}`}
              className="font-semibold underline"
              style={{ color: "var(--grape)" }}
            >
              Ask for a real account →
            </a>
          ) : (
            "Sign up to keep it."
          )}
        </aside>
      )}

      {/* ── Today panel ──────────────────────────────────────────────────────
          The at-a-glance answer to "where am I?": three numbers, then the level's progress
          bar. Replaces the old hub's total absence of any status signal. */}
      <section
        className="mt-6 rounded-[var(--r-lg)] p-4"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
        }}
      >
        {/* No level chip in this header. The three stats below are NOT all level-scoped:
            "words due" spans every level, matching getStudyQueue. A chip up here read as
            scoping the whole panel, which would misreport a cross-level backlog as belonging
            to the active level. The chip lives on the progress bar instead, which genuinely
            is level-scoped. */}
        <h2
          className="text-[11px] font-semibold"
          style={{
            color: "var(--ink-faint)",
            fontFamily: "var(--f-display)",
            letterSpacing: ".12em",
          }}
        >
          TODAY
        </h2>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="words due" value={snapshot.vocabDue} highlight={snapshot.vocabDue > 0} />
          <Stat label="grammar due" value={snapshot.grammarDue} highlight={snapshot.grammarDue > 0} />
          <Stat label="studied today" value={doneToday} tone={doneToday > 0 ? "good" : undefined} />
        </div>

        {/* Level progress: started/total for the ACTIVE level, unlike "words due" above. The
            level chip sits here, where the scoping claim is actually true. */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--cream-100)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct(snapshot.vocabStarted, snapshot.vocabTotal)}%`,
                background: "linear-gradient(90deg, var(--magenta), var(--mag-500))",
              }}
            />
          </div>
          <p
            className="mt-2 flex items-center gap-1.5 text-[12px]"
            style={{ color: "var(--ink-faint)" }}
          >
            <span
              className={`chip chip-${level.toLowerCase()}`}
              style={{ fontSize: "10px", padding: "2px 8px" }}
            >
              {level}
            </span>
            {snapshot.vocabStarted.toLocaleString("en-US")} of{" "}
            {snapshot.vocabTotal.toLocaleString("en-US")} words started
          </p>
        </div>
      </section>

      {/* ── Primary CTA ──────────────────────────────────────────────────────
          One tap to the highest-priority work, so the common case never requires triaging
          the mode grid below (SPEC §2). The grid stays, for deliberate choices. */}
      <Link href={next.href} className="btn btn-primary btn-lg mt-5 w-full">
        {next.label} →
      </Link>
      <p className="mt-2 text-center text-[13px]" style={{ color: "var(--ink-faint)" }}>
        {next.detail}
      </p>

      {/* ── Mode grid ────────────────────────────────────────────────────────
          Order follows SPEC §8.5 (Flashcard, Quiz, Exam), with Grammar appended as the
          fourth mode. The old hub listed Exam first, contradicting the spec. A 2x2 grid
          rather than four stacked rows: at the 375px baseline, four full-width rows pushed
          the level picker and pace note off-screen entirely. Each tile is roughly 150x104px,
          comfortably past the 44px touch-target floor (BRAND.md platform focus). */}
      <h2
        className="mt-7 text-[11px] font-semibold"
        style={{
          color: "var(--ink-faint)",
          fontFamily: "var(--f-display)",
          letterSpacing: ".12em",
        }}
      >
        STUDY MODES
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <ModeTile href="/study" emoji="🎴" title="Flashcards" subtitle={flashcardSubtitle(snapshot)} />
        <ModeTile href="/quiz" emoji="⚡" title="Quiz" subtitle="Quick multiple-choice" />
        <ModeTile href="/exam" emoji="📝" title="Exam" subtitle="JLPT-style reading & writing" />
        {/* Disabled on levels with no seeded deck (only N3 is seeded, SPEC §4.1). This
            reverses the earlier "no tile is ever disabled" rule, deliberately and with a
            known cost: this tile is the only UI path to `/grammar`, and `pickNextAction`
            cannot substitute for it because every count in `getGrammarStats` is level-scoped,
            so a non-N3 user's grammarDue is always 0. A user who studied N3 grammar and then
            switched level therefore loses access to it, and their reviews come due unseen
            until they switch back. Accepted by the author against the alternative of a tile
            that looks actionable on four levels where it leads nowhere (SPEC §14.14). */}
        <ModeTile
          href="/grammar"
          emoji="✏️"
          title="Grammar"
          subtitle={grammarSubtitle(snapshot)}
          disabled={snapshot.grammarTotal === 0}
        />
      </div>

      {/* ── Level ────────────────────────────────────────────────────────────
          Below the modes on purpose: the level is set once and revisited rarely, while a
          mode is chosen every session. The old hub had this order inverted, putting the
          rarest action at the top of the page. */}
      <h2
        className="mt-7 text-[11px] font-semibold"
        style={{
          color: "var(--ink-faint)",
          fontFamily: "var(--f-display)",
          letterSpacing: ".12em",
        }}
      >
        LEVEL
      </h2>
      <div className="mt-2">
        <LevelPicker current={level} />
      </div>

      {/* Daily-pace note: the user's actual new-card cap, with the "why ten?" rationale a
          tap away. New words enter via Flashcard mode's queue (Quiz mode is non-scheduling). */}
      <p
        className="mt-5 flex items-center justify-center gap-1.5 text-[13px]"
        style={{ color: "var(--ink-faint)" }}
      >
        <span>🌱 {newPerDay} new words a day</span>
        <InfoBubble label="How the study pace works">
          <strong style={{ color: "var(--ink)" }}>Two bite-sized paces.</strong>
          <br />
          🎴 <strong style={{ color: "var(--ink)" }}>Flashcard</strong> — {newPerDay} new words a
          day. A pace you can keep, so reviews don&apos;t pile up (the #1 reason people quit).
          <br />
          ⚡ <strong style={{ color: "var(--ink)" }}>Quiz</strong> — 10 cards a session. A quick
          round whenever you want momentum.
          <br />
          <span lang="ja" className="jp">毎日ちょっとずつ</span> — a little every day.
        </InfoBubble>
      </p>

      <BottomNav />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Copy helpers, kept as functions so the tile subtitles are always derived from real
// counts. A hardcoded subtitle is how a dashboard starts lying to its user.
// ---------------------------------------------------------------------------

/** Percentage for a progress bar, guarding the divide-by-zero on an un-seeded level. */
function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Flashcard tile subtitle: due count first (the time-sensitive bit), then fallbacks. */
function flashcardSubtitle(s: HomeSnapshot): string {
  if (s.vocabDue > 0) return `${s.vocabDue} due now`;
  if (s.vocabStarted < s.vocabTotal) return "New cards ready";
  return "All caught up";
}

/** Grammar tile subtitle. Says "not seeded yet" honestly rather than showing a fake 0. */
function grammarSubtitle(s: HomeSnapshot): string {
  if (s.grammarTotal === 0) return "N3 only for now";
  if (s.grammarDue > 0) return `${s.grammarDue} due now`;
  if (s.grammarStarted < s.grammarTotal) return "New points ready";
  return "All caught up";
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

/** One number in the Today panel. `highlight` = there's work waiting; `good` = you did it. */
function Stat({
  label,
  value,
  highlight = false,
  tone,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  tone?: "good";
}) {
  const color = tone === "good" ? "var(--good)" : highlight ? "var(--grape)" : "var(--ink-faint)";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-[26px] leading-none"
        style={{ fontFamily: "var(--f-display)", fontWeight: 700, color }}
      >
        {value}
      </span>
      <span className="text-center text-[11px]" style={{ color: "var(--ink-faint)" }}>
        {label}
      </span>
    </div>
  );
}

/**
 * One mode tile in the 2x2 grid (BRAND.md §7 surface).
 *
 * `disabled` renders the tile as inert content rather than a link, for a mode that genuinely
 * has nothing behind it on the active level. Only the Grammar tile uses it, and only where no
 * deck is seeded; the cost of that (the mode becomes unreachable, not merely empty) is
 * recorded at the call site and in SPEC §14.14.
 *
 * The disabled treatment is built from tokens, never `opacity`. BRAND.md §3 forbids
 * compositing a passing contrast pair with alpha, which is precisely how a "greyed out"
 * control ends up below AA. The tile instead recedes by *losing* elevation — paper fill
 * instead of white, no shadow — and its text steps down the ink ramp to values that still
 * clear 4.5 : 1. The emoji is greyscaled rather than faded, which is safe because it is
 * decorative and carries no contrast obligation.
 */
function ModeTile({
  href,
  emoji,
  title,
  subtitle,
  disabled = false,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span
        className="text-[28px] leading-none"
        style={disabled ? { filter: "grayscale(1)" } : undefined}
        aria-hidden
      >
        {emoji}
      </span>
      <span
        className="mt-2 block text-[17px] leading-tight"
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 600,
          color: disabled ? "var(--ink-soft)" : "var(--ink)",
        }}
      >
        {title}
      </span>
      <span
        className="mt-0.5 block text-[12px] leading-snug"
        style={{ color: disabled ? "var(--ink-faint)" : "var(--ink-soft)" }}
      >
        {subtitle}
      </span>
    </>
  );

  if (disabled) {
    return (
      // A plain div, not a <Link> or a disabled <button>. There is no action here to describe,
      // so giving it control semantics only to mark them unavailable would announce a button
      // that never existed; the subtitle already states why the mode is not open.
      <div
        className="rounded-[var(--r-lg)] p-4"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          minHeight: 104,
        }}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-[var(--r-lg)] p-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
        minHeight: 104,
      }}
    >
      {body}
    </Link>
  );
}
