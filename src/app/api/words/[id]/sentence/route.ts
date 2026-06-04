// GET /api/words/:id/sentence
//
// Lazy-loads the cached example sentence for one word. Called by the browse UI when the
// user taps a word row — keeps the initial word-list payload small (no sentences up front).
// Returns 404 when the word has no sentence yet (shouldn't happen post-seeding, but safe).

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const sentence = await db.exampleSentence.findFirst({
    where: { wordId: id },
    select: { japanese: true, reading: true, english: true },
  });

  if (!sentence) {
    return NextResponse.json({ error: "No sentence found" }, { status: 404 });
  }

  return NextResponse.json(sentence, {
    headers: {
      // Sentences are seeded once and never change — cache aggressively.
      "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
