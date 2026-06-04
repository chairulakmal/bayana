// GET /api/quiz?level=N3&count=10
//
// Returns a batch of distinct Duolingo-mode questions for a level (JP→EN). Batched so a
// round has no repeats and no per-question round-trips. **Non-scheduling**: reads words
// only, writes nothing — quiz results don't touch FSRS state (SPEC §8.2, §8.5).
//
// Auth is required (§9) for consistency even though there's no per-user data or API cost
// here; it also means the dev-login session (or a real one) gates access uniformly.
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { buildQuiz } from "@/lib/quiz";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // questions are randomized per request — never cache

const DEFAULT_COUNT = 10;
const MAX_COUNT = 20;

export async function GET(request: Request) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  // Validate the level against the enum so a bad query string can't reach the DB.
  const levelParam = params.get("level") ?? "N3";
  if (!(levelParam in Level)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  // Clamp count into [1, MAX_COUNT]; default on anything non-numeric.
  const raw = Number(params.get("count") ?? DEFAULT_COUNT);
  const count = Number.isFinite(raw) ? Math.min(Math.max(1, Math.trunc(raw)), MAX_COUNT) : DEFAULT_COUNT;

  try {
    const questions = await buildQuiz(levelParam as Level, count);
    return NextResponse.json({ level: levelParam, questions });
  } catch (err) {
    console.error("GET /api/quiz failed:", err);
    return NextResponse.json({ error: "Failed to build quiz" }, { status: 500 });
  }
}
