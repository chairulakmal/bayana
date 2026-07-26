// GET /api/grammar/browse?level=N3
//
// Returns every GrammarPoint for one level, grouped by lesson, for the /grammar/browse
// reference view. The payload is built by `buildGrammarBrowse` (`lib/grammar-browse.ts`),
// which documents the shape and why sentences and per-user status are both inline.
//
// **The page no longer calls this.** `/grammar/browse` builds its lessons during the server
// render (SPEC §9.3), so nothing in the app fetches this route today. It survives on purpose,
// as the documented, cacheable HTTP surface the reads-stay-route-handlers convention asks reads
// to keep (SPEC §9.2, §14.16), and because delegating to the shared builder costs almost
// nothing, whereas re-deriving this payload later would cost the drift. If it is ever deleted,
// delete it deliberately rather than as cleanup: the page's data shape is the contract, and this
// is the only thing asserting it is expressible over HTTP.
//
// Cache-Control: grammar points are seeded once from decks/grammar-*.md and change only when
// that file is re-seeded, but the response is user-specific (status depends on
// GrammarProgress), so it stays `private` with the shorter of the two browse lifetimes. This is
// the coupling `/api/browse` was split to escape (see `lib/browse.ts`); it is left alone here
// because ~220 rows do not justify a second round trip to decouple.

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/current-user";
import { buildGrammarBrowse } from "@/lib/grammar-browse";
import { GRAMMAR_LEVELS } from "@/lib/grammar-review";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const level = new URL(request.url).searchParams.get("level") ?? "N3";
  if (!GRAMMAR_LEVELS.has(level)) {
    return NextResponse.json({ error: `Unknown level "${level}"` }, { status: 400 });
  }

  const lessons = await buildGrammarBrowse(userId, level);

  return NextResponse.json(
    { level, lessons },
    { headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400" } },
  );
}
