// GET /api/quiz?level=N3&count=10
//
// Returns a batch of distinct Quiz mode questions for a level (JP→EN). Batched so a
// round has no repeats and no per-question round-trips. **Non-scheduling**: reads words
// only, writes nothing — quiz results don't touch FSRS state (SPEC §8.2, §8.5).
//
// This route is no longer how a round gets its *first* payload: the `/quiz` page renders that
// server-side (§8.2). What it still serves is the imperative refetch behind "Play again" and the
// load-failure retry, which re-request a round from a component that is already mounted. It stays
// a route handler rather than becoming an action because a GET is the right shape for a read, and
// because it can be exercised with curl while developing (§14.16).
//
// Both entry points call `buildQuizRound`, so neither can drift on the round's size or its clamp.
//
// Auth is required (§9) for consistency even though there's no per-user data or API cost
// here; it also means the dev-login session (or a real one) gates access uniformly.
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { buildQuizRound, DEFAULT_QUIZ_COUNT } from "@/lib/quiz";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // questions are randomized per request — never cache

export async function GET(request: Request) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  // Validate the level against the enum so a bad query string can't reach the DB.
  // Object.hasOwn (not the `in` operator): `in` walks the prototype chain, so keys like
  // "constructor"/"toString" would pass and reach Prisma as an invalid enum (→ 500).
  const levelParam = params.get("level") ?? "N3";
  if (!Object.hasOwn(Level, levelParam)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  // `count` is parsed here but bounded by `buildQuizRound`, which clamps it to [1, 20] and
  // defaults anything non-numeric. Keeping the clamp in the builder rather than here means the
  // guarantee holds for the page render too, not only for whoever remembered to validate.
  const count = Number(params.get("count") ?? DEFAULT_QUIZ_COUNT);

  try {
    const questions = await buildQuizRound(levelParam as Level, count);
    return NextResponse.json({ level: levelParam, questions });
  } catch (err) {
    console.error("GET /api/quiz failed:", err);
    return NextResponse.json({ error: "Failed to build quiz" }, { status: 500 });
  }
}
