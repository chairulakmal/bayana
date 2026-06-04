import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { getLevelStats } from "@/lib/stats";
import { Parrot } from "@/components/parrot";

// Light stats page (SPEC §13 "basic stats"; full dashboard is Phase 4, §16). Shows a few
// per-active-level numbers — progress, due, recall — linked from the home hub. Server
// component: it reads the DB directly, so the numbers are always fresh on navigation.
export default async function StatsPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const userId = await getCurrentUserId();
  const level = await getActiveLevel(userId);
  const stats = await getLevelStats(userId, level);

  const pct = stats.total > 0 ? Math.round((stats.started / stats.total) * 100) : 0;
  const recallPct = stats.recallRate === null ? null : Math.round(stats.recallRate * 100);

  // min-h-svh (not dvh): same reasoning as the home hub — keep the layout stable when the
  // Android nav/gesture bar toggles in the installed PWA. Content flows from the top.
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8">
      {/* Header: back to the hub + the active level chip */}
      <div className="flex items-center justify-between">
        <Link href="/home" className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
          ← Home
        </Link>
        <span className={`chip chip-${level.toLowerCase()}`}>{level}</span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Parrot expr="happy" style={{ width: 44, height: 49 }} />
        <h1 className="text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
          Your progress
        </h1>
      </div>

      {/* Progress: words started / total, with the brand magenta fill */}
      <section
        className="mt-6 rounded-[var(--r-lg)] p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
            Words started
          </span>
          <span className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
            {pct}%
          </span>
        </div>
        <p className="mt-1 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}>
          {stats.started.toLocaleString()}{" "}
          <span style={{ color: "var(--ink-faint)", fontWeight: 600 }}>
            / {stats.total.toLocaleString()}
          </span>
        </p>
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--cream-100)" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--magenta), var(--mag-500))" }}
          />
        </div>
        <p className="mt-2 text-[12px]" style={{ color: "var(--ink-faint)" }}>
          {stats.mature.toLocaleString()} mature (in long-term review)
        </p>
      </section>

      {/* Two tiles: due now + recall rate */}
      <section className="mt-4 grid grid-cols-2 gap-4">
        <Tile
          label="Due now"
          value={stats.dueNow.toLocaleString()}
          hint={stats.dueNow > 0 ? "ready to review" : "all caught up"}
        />
        <Tile
          label="Recall rate"
          value={recallPct === null ? "—" : `${recallPct}%`}
          hint={
            recallPct === null
              ? "no reviews yet"
              : `last ${stats.recallWindowDays} days · ${stats.recallSample} reviews`
          }
        />
      </section>

      <Link href="/study" className="btn btn-primary mt-8 w-full">
        Study now
      </Link>
    </main>
  );
}

/** A single headline-number card (BRAND.md §7 surface). */
function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
    >
      <p className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
        {label}
      </p>
      <p className="mt-1 text-3xl" style={{ fontFamily: "var(--f-display)", fontWeight: 700, color: "var(--ink)" }}>
        {value}
      </p>
      <p className="mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        {hint}
      </p>
    </div>
  );
}
