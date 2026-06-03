// GET /api/cards/queue?level=N3
//
// Returns today's study queue for the current user: cards already due, plus a capped
// number of brand-new words. Phase 1a defaults to N3.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getStudyQueue } from "@/lib/review";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs"; // Prisma needs the Node runtime, not Edge
export const dynamic = "force-dynamic"; // the queue changes after every review — never cache

export async function GET(request: Request) {
  const userId = getCurrentUserId();

  // Validate the level against the enum so a bad query string can't reach the DB.
  const levelParam = new URL(request.url).searchParams.get("level") ?? "N3";
  if (!(levelParam in Level)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  try {
    const queue = await getStudyQueue(userId, { level: levelParam as Level });
    return NextResponse.json(queue);
  } catch (err) {
    console.error("GET /api/cards/queue failed:", err);
    return NextResponse.json({ error: "Failed to build study queue" }, { status: 500 });
  }
}
