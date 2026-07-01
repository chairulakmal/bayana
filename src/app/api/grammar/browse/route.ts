// GET /api/grammar/browse?level=N3
//
// Returns every GrammarPoint for one level, grouped by lesson, for the /grammar/browse
// reference view. Unlike /api/browse (vocab), sentences are included directly in the
// payload rather than lazy-loaded per row — the grammar deck is two orders of magnitude
// smaller (~220 rows vs ~8,800 words), so there's no size/cost reason to defer them.
//
// Each point also carries a `status` ("new" | "started" | "mature") derived from the
// user's GrammarProgress, mirroring /api/browse's `started` flag — the reference view is
// otherwise just a static list, and a learner scanning ~220 points before an exam needs a
// way to tell what's already solid vs. what's new without switching to study mode.
// "mature" reuses getGrammarStats' threshold (scheduledDays >= 21).
//
// Cache-Control: grammar points are seeded once from decks/grammar-*.md and change only
// when that file is re-seeded, but the response is now user-specific (status depends on
// GrammarProgress) — same reasoning /api/browse gives for staying `private` rather than a
// shared CDN cache.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { db } from "@/lib/db";
import { GRAMMAR_LEVELS } from "@/lib/grammar-review";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const level = new URL(request.url).searchParams.get("level") ?? "N3";
  if (!GRAMMAR_LEVELS.has(level)) {
    return NextResponse.json({ error: `Unknown level "${level}"` }, { status: 400 });
  }

  // Fetch the point list and the user's progress on this level in parallel — two cheap
  // queries, same pattern as /api/browse's words + startedRows.
  const [points, progressRows] = await Promise.all([
    db.grammarPoint.findMany({
      where: { level },
      orderBy: [{ lesson: "asc" }, { position: "asc" }],
      select: {
        id: true,
        lesson: true,
        lessonTitle: true,
        position: true,
        pattern: true,
        reading: true,
        meanings: true,
        exampleJp: true,
        exampleEn: true,
      },
    }),
    db.grammarProgress.findMany({
      where: { userId, grammarPoint: { level } },
      select: { grammarPointId: true, scheduledDays: true },
    }),
  ]);

  const matureIds = new Set(
    progressRows.filter((r) => r.scheduledDays >= 21).map((r) => r.grammarPointId),
  );
  const startedIds = new Set(progressRows.map((r) => r.grammarPointId));

  function statusFor(pointId: string): "new" | "started" | "mature" {
    if (matureIds.has(pointId)) return "mature";
    if (startedIds.has(pointId)) return "started";
    return "new";
  }

  // Group into lesson buckets. Points are already ordered by lesson/position, so a
  // single linear pass (rather than a second sort) is enough to build the groups.
  type PointRow = {
    id: string;
    position: number;
    pattern: string;
    reading: string;
    meanings: string[];
    exampleJp: string;
    exampleEn: string;
    status: "new" | "started" | "mature";
  };
  const lessons: { lesson: number; title: string; points: PointRow[] }[] = [];
  for (const p of points) {
    let bucket = lessons[lessons.length - 1];
    if (!bucket || bucket.lesson !== p.lesson) {
      bucket = { lesson: p.lesson, title: p.lessonTitle, points: [] };
      lessons.push(bucket);
    }
    bucket.points.push({
      id: p.id,
      position: p.position,
      pattern: p.pattern,
      reading: p.reading,
      meanings: p.meanings,
      exampleJp: p.exampleJp,
      exampleEn: p.exampleEn,
      status: statusFor(p.id),
    });
  }

  return NextResponse.json(
    { level, lessons },
    { headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400" } },
  );
}
