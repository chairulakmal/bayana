// POST /api/grammar/review   body: { grammarPointId: string, rating: 1 | 2 | 3 | 4 }
//
// Applies an FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy) to a grammar point for
// the current user. Updates GrammarProgress; no separate log table in v1.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { reviewGrammarPoint } from "@/lib/grammar-review";

export const runtime = "nodejs";

const VALID_RATINGS = [1, 2, 3, 4];

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { grammarPointId, rating } = (body ?? {}) as {
    grammarPointId?: unknown;
    rating?: unknown;
  };
  if (typeof grammarPointId !== "string" || !grammarPointId) {
    return NextResponse.json({ error: "grammarPointId is required" }, { status: 400 });
  }
  if (typeof rating !== "number" || !VALID_RATINGS.includes(rating)) {
    return NextResponse.json({ error: "rating must be 1, 2, 3, or 4" }, { status: 400 });
  }

  try {
    const result = await reviewGrammarPoint(userId, grammarPointId, rating);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/grammar/review failed:", err);
    return NextResponse.json({ error: "Failed to record grammar review" }, { status: 500 });
  }
}
