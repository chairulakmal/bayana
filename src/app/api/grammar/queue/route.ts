// GET /api/grammar/queue?level=N3[&limit=20]
//
// Returns one session's worth of grammar cards: due cards first, then new points
// filling remaining slots up to `newCardsPerDay`. `limit` is clamped to 1–100.
//
// This route is no longer how a session gets its *first* payload: the `/grammar/study` page
// renders that server-side (§8.1). What it still serves is the imperative refetch ("Check for
// more", "Another session?", and the load-failure retry), all of which re-request a queue from a
// component that is already mounted. It stays a route handler rather than becoming an action
// because a GET is the right shape for a read, and because it can be exercised with curl while
// developing (§14.16).
//
// **The response shape changed with that port.** It returned raw Prisma rows (`{ due, newPoints,
// totalDue }`), which the client flattened on arrival, so every due card shipped its whole
// `GrammarProgress` FSRS state plus four unused `GrammarPoint` columns to a browser that reads
// none of them. It now returns `buildGrammarSession`'s flattened payload, the same shape the page
// hands the client, so the two entry points cannot drift apart. This mirrors what
// `/api/cards/queue` does for vocab.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { buildGrammarSession } from "@/lib/grammar-cards";
import { GRAMMAR_LEVELS } from "@/lib/grammar-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  const level = params.get("level") ?? "N3";
  if (!GRAMMAR_LEVELS.has(level)) {
    return NextResponse.json({ error: `Unknown level "${level}"` }, { status: 400 });
  }

  const rawLimit = parseInt(params.get("limit") ?? "20", 10);
  const sessionLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

  try {
    const session = await buildGrammarSession(userId, { level, sessionLimit });
    return NextResponse.json(session);
  } catch (err) {
    console.error("GET /api/grammar/queue failed:", err);
    return NextResponse.json({ error: "Failed to build grammar queue" }, { status: 500 });
  }
}
