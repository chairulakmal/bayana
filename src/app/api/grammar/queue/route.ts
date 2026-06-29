// GET /api/grammar/queue?level=N3[&limit=20]
//
// Returns one session's worth of grammar cards: due cards first, then new points
// filling remaining slots up to `newCardsPerDay`. `limit` is clamped to 1–100.
// The response shape mirrors /api/cards/queue but uses GrammarPoint/GrammarProgress.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getGrammarQueue } from "@/lib/grammar-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Grammar levels are plain strings (not the Level enum) so new levels need no code change.
const VALID_LEVELS = new Set(["N5", "N4", "N3", "N2", "N1"]);

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  const level = params.get("level") ?? "N3";
  if (!VALID_LEVELS.has(level)) {
    return NextResponse.json({ error: `Unknown level "${level}"` }, { status: 400 });
  }

  const rawLimit = parseInt(params.get("limit") ?? "20", 10);
  const sessionLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

  try {
    const queue = await getGrammarQueue(userId, { level, sessionLimit });
    return NextResponse.json(queue);
  } catch (err) {
    console.error("GET /api/grammar/queue failed:", err);
    return NextResponse.json({ error: "Failed to build grammar queue" }, { status: 500 });
  }
}
