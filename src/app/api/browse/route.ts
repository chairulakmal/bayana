// GET /api/browse?level=N3
//
// Returns the full word list for one JLPT level (id + expression + reading + meaning) for the
// /browse reference view. Filtering, ordering and pagination all happen on the client, so the
// whole level ships in one response, which is what makes in-memory search per keystroke
// possible without a request.
//
// **This response carries no per-user data, and that is deliberate.** It used to include a
// `started` flag per word and sort started words first, which meant a payload of ~2,700
// immutable deck rows expired as soon as the user rated a single card. The per-user half now
// arrives with the page render instead (`getStartedWordIds`, read in `app/browse/page.tsx`),
// leaving this route as pure deck data. Rationale and the alternative considered: SPEC §9.3
// and §14.25.
//
// Cache-Control: `max-age=86400` (a day, up from an hour) with a week of
// stale-while-revalidate. Words change only when `decks/*.csv` is re-seeded, which is a
// deploy-time event, so a day-old copy is a day-old copy of something that did not change. The
// old TTL was not a judgement about deck data at all: it was the freshness the *ordering*
// needed, and the ordering has moved.
//
// Still `private`, and still auth-gated. A `public` value would let a shared cache serve it,
// but nothing sits in front of this app on Railway that would use one, so `public` would buy
// nothing while turning an authenticated endpoint into an unauthenticated one that hits the
// database, which is a security-surface change (SPEC §11.8) in exchange for zero measured benefit.
//
// Sentences are intentionally omitted; they are lazy-fetched per word on tap via
// GET /api/words/:id/sentence. Reads stay route handlers per SPEC §9.2.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { getLevelWords } from "@/lib/browse";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // Called for the auth check alone: the response body no longer depends on who is asking.
    // Still required: this is deck data behind an invite-only app, and an endpoint that runs
    // a query for anyone is the thing the gate exists to prevent.
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Object.hasOwn, not `in`: `in` walks the prototype chain, so "constructor"/"toString"
  // would pass and reach Prisma as an invalid enum value.
  const levelParam = new URL(request.url).searchParams.get("level") ?? "N3";
  if (!Object.hasOwn(Level, levelParam)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  const words = await getLevelWords(levelParam as Level);

  return NextResponse.json(
    { level: levelParam, words },
    {
      headers: {
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
