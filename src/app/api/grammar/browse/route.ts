// GET /api/grammar/browse?level=N3
//
// Returns every GrammarPoint for one level, grouped by lesson, for the /grammar/browse
// reference view. Unlike /api/browse (vocab), sentences are included directly in the
// payload rather than lazy-loaded per row — the grammar deck is two orders of magnitude
// smaller (~220 rows vs ~8,800 words), so there's no size/cost reason to defer them.
//
// Cache-Control: grammar points are seeded once from decks/grammar-*.md and change only
// when that file is re-seeded — same reasoning as /api/browse. `private` because the
// route sits behind auth even though the payload itself isn't user-specific.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const level = new URL(request.url).searchParams.get("level") ?? "N3";

  const points = await db.grammarPoint.findMany({
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
  });

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
    });
  }

  return NextResponse.json(
    { level, lessons },
    { headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400" } },
  );
}
