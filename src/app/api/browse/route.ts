// GET /api/browse?level=N3
//
// Returns the full word list for one JLPT level (id + expression + reading + meaning only —
// no sentences). Intentionally omits sentences so the initial payload stays small (~100 KB
// gzipped for N1, the largest level); sentences are lazy-loaded per word on tap.
//
// The key design here is the Cache-Control header: word data is seeded once and never
// changes during normal app use, so the browser can cache this response and serve it
// instantly on repeat visits without hitting Railway at all. `private` keeps CDNs out
// (the route is auth-gated, even though the word list itself contains no user data).
// max-age=3600: fresh for 1 hour. stale-while-revalidate=86400: serve stale for up to a
// day while revalidating in the background — so the app feels instant even after expiry.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Level } from "@/generated/prisma/enums";

export const runtime = "nodejs";
// `force-dynamic` is NOT set here — we want Next's fetch cache to leave this alone so the
// browser's own Cache-Control header does the work. The response is per-level, not per-user,
// so caching is safe.

export async function GET(request: Request) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const levelParam = new URL(request.url).searchParams.get("level") ?? "N3";
  if (!(levelParam in Level)) {
    return NextResponse.json({ error: `Unknown level "${levelParam}"` }, { status: 400 });
  }

  const words = await db.word.findMany({
    where: { level: levelParam as Level },
    select: { id: true, expression: true, reading: true, meaning: true },
    orderBy: { expression: "asc" },
  });

  return NextResponse.json(
    { level: levelParam, words },
    {
      headers: {
        // Browser caches the word list privately (auth-gated route, but words are not
        // user-specific). 1 hr fresh; serve stale for up to 1 day while revalidating.
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
