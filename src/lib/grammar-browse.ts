// Data access for /grammar/browse (grammar reference view), server-only.
//
// Extracted from `app/api/grammar/browse/route.ts` when the page moved to a server render
// (SPEC §9.3). The builder lives here rather than in the route for the same reason
// `lib/study-cards.ts` exists: two callers now need the identical payload (the page render and
// the read route), and a shared builder is what guarantees a change reaches both. Without it the
// route would keep serving whatever shape the page has since drifted away from.
//
// Unlike the vocabulary half (`lib/browse.ts`), nothing here is split into cacheable and
// per-user parts, and the difference is scale rather than taste: this is ~220 rows for a level
// against ~2,700, small enough that serializing the whole thing into the page's RSC payload
// costs less than the extra round trip the split would preserve.

import { defaultDeps, type Deps } from "@/lib/deps";

/** One grammar point as the reference view renders it. `status` is per-user, derived from
 *  `GrammarProgress`; "mature" reuses `getGrammarStats`' threshold (scheduledDays >= 21). */
export type GrammarBrowsePoint = {
  id: string;
  position: number;
  pattern: string;
  reading: string;
  meanings: string[];
  exampleJp: string;
  exampleEn: string;
  status: "new" | "started" | "mature";
};

/** Points bucketed by lesson, in lesson order: the shape the accordion renders directly. */
export type GrammarLessonGroup = {
  lesson: number;
  title: string;
  points: GrammarBrowsePoint[];
};

/**
 * Every grammar point at one level, grouped by lesson, annotated with the user's progress.
 *
 * Sentences are included inline rather than lazy-fetched per row the way vocabulary sentences
 * are on /browse: the grammar deck is two orders of magnitude smaller (~220 rows vs ~8,100
 * words), so there is no size or cost reason to defer them.
 *
 * `status` exists because the reference list is otherwise static, and a learner scanning ~220
 * points before an exam needs to tell what is already solid from what is new without switching
 * into study mode.
 *
 * @param userId  whose progress annotates the points
 * @param level   a JLPT level string; callers validate it against `GRAMMAR_LEVELS` first
 * @returns lesson groups in ascending lesson order, points in ascending position order
 */
export async function buildGrammarBrowse(
  userId: string,
  level: string,
  { db }: Deps = defaultDeps,
): Promise<GrammarLessonGroup[]> {
  // Fetch the point list and the user's progress on this level in parallel — two cheap
  // queries, same pattern as the vocabulary browse pair.
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

  function statusFor(pointId: string): GrammarBrowsePoint["status"] {
    if (matureIds.has(pointId)) return "mature";
    if (startedIds.has(pointId)) return "started";
    return "new";
  }

  // Group into lesson buckets. Points are already ordered by lesson/position, so a single
  // linear pass (rather than a second sort) is enough to build the groups.
  const lessons: GrammarLessonGroup[] = [];
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

  return lessons;
}
