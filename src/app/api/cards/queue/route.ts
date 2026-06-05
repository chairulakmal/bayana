// GET /api/cards/queue?level=N3[&limit=20]
//
// Returns one session's worth of cards for the current user: due cards (oldest first,
// capped to `limit`), plus new words filling the remaining slots. Defaults to 20 cards
// per session. `limit` is clamped to 1–100 to prevent abuse.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getStudyQueue } from "@/lib/review";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs"; // Prisma needs the Node runtime, not Edge
export const dynamic = "force-dynamic"; // the queue changes after every review — never cache

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  // Validate the level against the enum so a bad query string can't reach the DB.
  // Object.hasOwn (not `in`): `in` walks the prototype chain, so "constructor"/"toString"
  // would pass and reach Prisma as an invalid enum (→ 500).
  const levelParam = params.get("level") ?? "N3";
  if (!Object.hasOwn(Level, levelParam)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  // Parse the optional session limit; clamp to a safe range so the client can't
  // accidentally (or maliciously) request an unbounded queue.
  const rawLimit = parseInt(params.get("limit") ?? "20", 10);
  const sessionLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

  try {
    const queue = await getStudyQueue(userId, { level: levelParam as Level, sessionLimit });
    return NextResponse.json(queue);
  } catch (err) {
    console.error("GET /api/cards/queue failed:", err);
    return NextResponse.json({ error: "Failed to build study queue" }, { status: 500 });
  }
}
