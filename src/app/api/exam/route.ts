// GET /api/exam?level=N3&count=20
//
// Returns a JLPT-style exam round split into two equal sections:
//   - First  ceil(count/2) questions: 問題１ (reading — pick the kana for a kanji word)
//   - Second floor(count/2) questions: 問題２ (writing — pick the kanji for a kana word)
//
// Questions are random and non-scheduling — exam mode is a pure benchmark that neither
// reads from nor writes to FSRS state (SPEC §8.6). Auth is still required to keep access
// control uniform with the other study endpoints.
//
// This route no longer serves a round's *first* payload: the `/exam` page renders that
// server-side (§8.6). What it still serves is the imperative refetch behind "Try again" on the
// summary screen. **The section split is not performed here any more**, deliberately:
// `buildExamRound` owns it so this route and the page cannot divide a round differently, which
// `ExamSession` would not notice, since it recovers the boundary from question order (§9).

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { buildExamRound, DEFAULT_EXAM_COUNT } from "@/lib/exam";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // randomised per request — never cache

export async function GET(request: Request) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  const levelParam = params.get("level") ?? "N3";
  if (!Object.hasOwn(Level, levelParam)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  // Parsed here, clamped to [2, 40] inside `buildExamRound` so the bound holds for the page
  // render too rather than only for callers that remembered to validate.
  const count = Number(params.get("count") ?? DEFAULT_EXAM_COUNT);

  try {
    const questions = await buildExamRound(levelParam as Level, count);
    return NextResponse.json({ level: levelParam, questions });
  } catch (err) {
    console.error("GET /api/exam failed:", err);
    return NextResponse.json({ error: "Failed to build exam" }, { status: 500 });
  }
}
