// POST /api/review/undo   body: { wordId: string }
//
// Reverts the most recent review of a word for the current user (one-step undo): rolls
// the card back to its prior scheduling state and removes that review-log row.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { undoLastReview } from "@/lib/review";

export const runtime = "nodejs";

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
  const { wordId } = (body ?? {}) as { wordId?: unknown };
  if (typeof wordId !== "string" || !wordId) {
    return NextResponse.json({ error: "wordId is required" }, { status: 400 });
  }

  try {
    const result = await undoLastReview(userId, wordId);
    if (!result) {
      return NextResponse.json({ error: "Nothing to undo for this word" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/review/undo failed:", err);
    return NextResponse.json({ error: "Failed to undo review" }, { status: 500 });
  }
}
