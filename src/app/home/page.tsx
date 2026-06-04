import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { getActiveLevel, getNewCardsPerDay, hasOnboarded } from "@/lib/profile";
import { Parrot } from "@/components/parrot";
import { LevelPicker } from "@/components/level-picker";
import { InfoBubble } from "@/components/info-bubble";
import { UserMenu } from "@/components/user-menu";

// The home hub (SPEC §8.5) — the post-login landing for returning users. It's the mode
// picker (Flashcard / Quiz) plus an inline level selector; deliberately NOT a full dashboard
// (stats/streak live there in Phase 4). Login and the public landing both redirect here.
export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const userId = await getCurrentUserId();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");
  const level = await getActiveLevel(userId);
  const newPerDay = await getNewCardsPerDay(userId);

  return (
    // min-h-svh (not dvh): the "small" viewport height is fixed at the bar-visible size,
    // so the centred mode buttons don't hop when Android's gesture/nav bar shows or hides
    // in the installed PWA. dvh recomputes live and shifts the vertical centre.
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8">
      {/* Greeting + quiet link to the stats page */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Parrot expr="happy" style={{ width: 48, height: 54 }} />
          <div>
            <p className="jp text-[15px]" style={{ color: "var(--ink-soft)" }}>
              おかえり
            </p>
            <p className="text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
              Let&apos;s study
            </p>
          </div>
        </div>
        <UserMenu email={session.user?.email ?? ""} />
      </div>

      {/* Level — the inline "set your level" control */}
      <div className="mt-8">
        <p
          className="text-[12px] font-semibold"
          style={{ color: "var(--ink-faint)", fontFamily: "var(--f-display)", letterSpacing: ".12em" }}
        >
          LEVEL
        </p>
        <div className="mt-2">
          <LevelPicker current={level} />
        </div>
      </div>

      {/* Mode picker — top-anchored (normal flow), NOT vertically centred. Centring made
          the buttons' offset depend on the viewport height, so they hopped when Android's
          gesture bar toggled in the installed PWA (svh/dvh resolve inconsistently inside a
          fullscreen PWA). Anchored from the top, their position is fixed by the content
          above; any height change just adds/removes empty space at the bottom. */}
      <div className="mt-8 flex flex-col gap-4">
        <ModeButton href="/study" emoji="🎴" title="Flashcard mode" subtitle="Spaced-repetition review" />
        <ModeButton href="/quiz" emoji="⚡" title="Quiz mode" subtitle="Quick multiple-choice" />
      </div>

      {/* Daily-pace note: shows the user's actual new-card cap, with the "why ten?" rationale
          a tap away. New words enter via Flashcard mode's queue (Quiz mode is non-scheduling). */}
      <p
        className="mt-5 flex items-center justify-center gap-1.5 text-[13px]"
        style={{ color: "var(--ink-faint)" }}
      >
        <span>🌱 {newPerDay} new words a day</span>
        <InfoBubble label="How the study pace works">
          <strong style={{ color: "var(--ink)" }}>Two bite-sized paces.</strong>
          <br />
          🎴 <strong style={{ color: "var(--ink)" }}>Flashcard</strong> — {newPerDay}{" "} new words a
          day. A pace you can keep, so reviews don&apos;t pile up (the #1 reason people quit).
          <br />
          ⚡ <strong style={{ color: "var(--ink)" }}>Quiz</strong> — 10 cards a session. A quick
          round whenever you want momentum.
          <br />
          <span className="jp">毎日ちょっとずつ</span> — a little every day.
        </InfoBubble>
      </p>
    </main>
  );
}

/** A large, tappable mode card (BRAND.md §7 surface). */
function ModeButton({
  href,
  emoji,
  title,
  subtitle,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
    >
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <span>
        <span className="block text-xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600, color: "var(--ink)" }}>
          {title}
        </span>
        <span className="block text-[14px]" style={{ color: "var(--ink-soft)" }}>
          {subtitle}
        </span>
      </span>
      <span className="ml-auto text-2xl" style={{ color: "var(--mag-500)" }} aria-hidden>
        →
      </span>
    </Link>
  );
}
