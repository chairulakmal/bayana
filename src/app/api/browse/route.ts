// GET /api/browse?level=N3
//
// Returns the full word list for one JLPT level (id + expression + reading + meaning +
// started) — no sentences. Intentionally omits sentences so the initial payload stays
// small (~100 KB gzipped for N1); sentences are lazy-loaded per word on tap.
//
// Ordering: words the user has already started reviewing appear first (most relevant to
// their current study), then unstarted words — both groups sorted alphabetically by
// expression. This makes the default first page show the words they're actively studying.
//
// `started: boolean` is included so the client can render a per-row indicator without
// a second request.
//
// Cache-Control: word data is seeded once and changes ~never. `private` keeps CDNs out
// (auth-gated). max-age=3600: fresh for 1 hr. stale-while-revalidate=86400: serve stale
// for up to a day while revalidating in the background.
//
// Note: the response is now user-specific (ordering depends on ReviewState), so a shared
// CDN cache would serve the wrong order to another user. `private` is correct here.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const levelParam = new URL(request.url).searchParams.get("level") ?? "N3";
  if (!(levelParam in Level)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  // Fetch the word list and the user's started set in parallel — two cheap queries.
  const [words, startedRows] = await Promise.all([
    db.word.findMany({
      where: { level: levelParam as Level },
      select: { id: true, expression: true, reading: true, meaning: true },
    }),
    db.reviewState.findMany({
      where: { userId, word: { level: levelParam as Level } },
      select: { wordId: true },
    }),
  ]);

  const startedIds = new Set(startedRows.map((r) => r.wordId));

  // Sort: started words first (alphabetical within), then unstarted (alphabetical within).
  // Using Japanese locale for localeCompare gives correct kana/kanji collation order.
  words.sort((a, b) => {
    const aS = startedIds.has(a.id);
    const bS = startedIds.has(b.id);
    if (aS !== bS) return aS ? -1 : 1;
    return a.expression.localeCompare(b.expression, "ja");
  });

  const payload = words.map((w) => ({ ...w, started: startedIds.has(w.id) }));

  return NextResponse.json(
    { level: levelParam, words: payload },
    {
      headers: {
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
