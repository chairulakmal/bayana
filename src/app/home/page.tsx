import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { Parrot } from "@/components/parrot";
import { LevelPicker } from "@/components/level-picker";

// The home hub (SPEC §8.5) — the post-login landing for returning users. It's the mode
// picker (Flashcard / Quiz) plus an inline level selector; deliberately NOT a full dashboard
// (stats/streak live there in Phase 4). Login and the public landing both redirect here.
export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const userId = await getCurrentUserId();
  const level = await getActiveLevel(userId);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      {/* Greeting */}
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

      {/* Mode picker */}
      <div className="mt-8 flex flex-1 flex-col justify-center gap-4">
        <ModeButton href="/study" emoji="🎴" title="Flashcard mode" subtitle="Spaced-repetition review" />
        <ModeButton href="/quiz" emoji="⚡" title="Quiz mode" subtitle="Quick multiple-choice" />
      </div>
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
