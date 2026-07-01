import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/current-user";
import { getActiveLevel, hasOnboarded } from "@/lib/profile";
import { GrammarBrowseClient } from "@/components/grammar-browse-client";
import { UserMenu } from "@/components/user-menu";
import { BottomNav } from "@/components/bottom-nav";

// /grammar/browse — full grammar reference, all points and examples grouped by lesson.
// Mirrors /browse (vocab): whole-deck lookup for the active level, search by pattern,
// reading, or meaning. See grammar-browse-client.tsx for why sentences aren't lazy-loaded
// here the way vocab sentences are on /browse.
export const metadata = { title: "Browse grammar" };

export default async function GrammarBrowsePage() {
  const { userId, email, isDemo } = await requireAuth();
  if (!(await hasOnboarded(userId))) redirect("/onboarding");

  const level = await getActiveLevel(userId);
  const grammarLevel = level.toString();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-24">
      {/* Header: back link left, level chip centred, avatar right */}
      <div className="relative flex h-9 items-center justify-center">
        <div className="absolute left-0">
          <Link
            href="/grammar"
            className="inline-flex items-center gap-1 active:opacity-70"
            style={{
              fontFamily: "var(--f-display)",
              fontWeight: 600,
              fontSize: 13,
              padding: "4px 10px",
              borderRadius: 999,
              background: "var(--surface)",
              boxShadow: "inset 0 0 0 1.5px var(--pink-200), 0 2px 0 var(--line)",
              color: "var(--grape)",
            }}
          >
            <span aria-hidden style={{ color: "var(--ink-faint)" }}>←</span>
            <span>Grammar</span>
          </Link>
        </div>
        <span className={`chip chip-${grammarLevel.toLowerCase()}`}>{grammarLevel}</span>
        <div className="absolute right-0">
          <UserMenu email={email ?? ""} isDemo={isDemo} />
        </div>
      </div>

      <h1 className="mt-6 text-2xl" style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}>
        Browse grammar
      </h1>

      <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
        Every grammar point and example, grouped by lesson.
      </p>

      <div className="mt-5">
        <GrammarBrowseClient level={grammarLevel} />
      </div>
      <BottomNav />
    </main>
  );
}
