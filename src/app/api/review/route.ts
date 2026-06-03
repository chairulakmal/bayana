// POST /api/review   body: { wordId: string, rating: 1 | 2 | 3 | 4 }
//
// Applies an FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy) to a word for the current
// user: updates the scheduling state and appends an immutable review-log row.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { reviewWord } from "@/lib/review";

export const runtime = "nodejs";

const VALID_RATINGS = [1, 2, 3, 4];

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse + validate the body before touching the database.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { wordId, rating } = (body ?? {}) as { wordId?: unknown; rating?: unknown };
  if (typeof wordId !== "string" || !wordId) {
    return NextResponse.json({ error: "wordId is required" }, { status: 400 });
  }
  if (typeof rating !== "number" || !VALID_RATINGS.includes(rating)) {
    return NextResponse.json({ error: "rating must be 1, 2, 3, or 4" }, { status: 400 });
  }

  try {
    const result = await reviewWord(userId, wordId, rating);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/review failed:", err);
    return NextResponse.json({ error: "Failed to record review" }, { status: 500 });
  }
}
