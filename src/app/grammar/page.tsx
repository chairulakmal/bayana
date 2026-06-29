// /grammar — Grammar hub page.
//
// Shows inline FSRS stats for the user's active level (total points, started, mature,
// due now) and a CTA to start a study session. Vocab stats stay on /stats — this page
// is self-contained for the grammar queue. Requires auth (same as /home).

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel, hasOnboarded } from "@/lib/profile";
import { getGrammarStats } from "@/lib/grammar-review";
import { BottomNav } from "@/components/bottom-nav";
import { UserMenu } from "@/components/user-menu";
import { Parrot } from "@/components/parrot";

export default async function GrammarPage() {
  const { userId, email, isDemo } = await requireAuth();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");

  const level = await getActiveLevel(userId);
  // Grammar levels are stored as plain strings; convert from the Level enum.
  const grammarLevel = level.toString(); // "N3" etc.

  const stats = await getGrammarStats(userId, grammarLevel);
  const hasCards = stats.dueNow > 0 || stats.started < stats.total;

  return (
    // flex-col with flex-1 spacer pushes the CTA to ~75% of the viewport height.
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Parrot expr="happy" style={{ width: 48, height: 54 }} />
          <div>
            <p className="jp text-[15px]" style={{ color: "var(--ink-soft)" }}>
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
        className="mt-6 grid grid-cols-4 gap-3 rounded-[var(--r-lg)] p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <StatCell label="Total" value={stats.total} />
        <StatCell label="Started" value={stats.started} />
        <StatCell label="Mature" value={stats.mature} />
        <StatCell label="Due" value={stats.dueNow} highlight={stats.dueNow > 0} />
      </section>

      {/* CTA section: min-h keeps the button at ~60% down on a mobile screen.
          flex-col + justify-end pins the button to the bottom of this region. */}
      <div className="flex flex-col justify-end pb-4" style={{ minHeight: "47svh" }}>
        {stats.started > 0 && (
          <p className="mb-4 text-center text-[13px]" style={{ color: "var(--ink-faint)" }}>
            {stats.started} of {stats.total} points in progress
            {stats.mature > 0 && ` · ${stats.mature} mature`}
          </p>
        )}
        {hasCards ? (
          <Link href="/grammar/study" className="btn btn-primary w-full text-center">
            Grammar Points{stats.dueNow > 0 ? ` · ${stats.dueNow} due` : ""}
          </Link>
        ) : (
          <button disabled className="btn btn-primary w-full opacity-50">
            Grammar Points
          </button>
        )}
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
