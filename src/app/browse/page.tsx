import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/current-user";
import { getActiveLevel } from "@/lib/profile";
import { BrowseClient } from "@/components/browse-client";
import { Level } from "@/generated/prisma/enums";

// Browse/search page (SPEC §13 Phase 2 light polish). Whole-deck lookup for the active
// level: search any word by kanji, reading, or meaning; tap to see its example sentence.
// The word list is fetched by the client (browser-cached); this server component only
// handles auth and passes the level down.
export const metadata = { title: "Browse" };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  const userId = await getCurrentUserId();
  const { level } = await searchParams;
  const lvl = level && level in Level ? level : await getActiveLevel(userId);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8">
      <div className="flex items-center justify-between">
        <Link href="/home" className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
          ← Home
        </Link>
        <span className={`chip chip-${lvl.toLowerCase()}`}>{lvl}</span>
      </div>

      <h1
        className="mt-6 text-2xl"
        style={{ fontFamily: "var(--f-display)", fontWeight: 600 }}
      >
        Browse words
      </h1>
      <p className="mt-1 text-[13px]" style={{ color: "var(--ink-soft)" }}>
        Tap any word to see its example sentence.
      </p>

      <div className="mt-5">
        <BrowseClient level={lvl} />
      </div>
    </main>
  );
}
