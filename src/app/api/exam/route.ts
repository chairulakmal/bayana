// GET /api/exam?level=N3&count=20
//
// Returns a JLPT-style exam round split into two equal sections:
//   - First  ceil(count/2) questions: 問題１ (reading — pick the kana for a kanji word)
//   - Second floor(count/2) questions: 問題２ (writing — pick the kanji for a kana word)
//
// Questions are random and non-scheduling — exam mode is a pure benchmark that neither
// reads from nor writes to FSRS state (SPEC §8.6). Auth is still required to keep access
// control uniform with the other study endpoints.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { buildExam } from "@/lib/exam";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // randomised per request — never cache

const DEFAULT_COUNT = 20;
const MAX_COUNT = 40;

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

  const raw = Number(params.get("count") ?? DEFAULT_COUNT);
  const count = Number.isFinite(raw)
    ? Math.min(Math.max(2, Math.trunc(raw)), MAX_COUNT)
    : DEFAULT_COUNT;

  // Split evenly: ceil for reading (問題１), floor for writing (問題２).
  const readingCount = Math.ceil(count / 2);
  const writingCount = Math.floor(count / 2);

  try {
    const questions = await buildExam(levelParam as Level, readingCount, writingCount);
    return NextResponse.json({ level: levelParam, questions });
  } catch (err) {
    console.error("GET /api/exam failed:", err);
    return NextResponse.json({ error: "Failed to build exam" }, { status: 500 });
  }
}
