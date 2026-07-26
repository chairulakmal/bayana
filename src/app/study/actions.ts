"use server";

// Write path for Flashcard mode (SPEC §9.2). Replaces `POST /api/review` and
// `POST /api/review/undo`, which stay in place until the other three modes are ported.
//
// **These are as web-reachable as the routes they replace.** `"use server"` compiles every
// export here into a POST endpoint whose id is discoverable in the client bundle, so an
// action is not a private function that happens to run on the server: its arguments arrive
// from the network and are exactly as untrusted as a JSON body was. Every guard the route
// handlers carried is therefore reproduced below, not summarised. What the action buys is a
// typed signature across the boundary and one less hand-maintained JSON contract (§14.16) —
// a developer convenience, never a security boundary.
//
// **No `revalidatePath` in either action, deliberately** (§9.2). A session's card list is
// fixed when the queue is built and is client-owned state from that moment (§8.1), so
// revalidating `/study` would refetch the page underneath a session in progress and throw
// away the user's position in it. `setActiveLevel` is the opposite case and does revalidate,
// because the level scopes what every other route renders.

import { getCurrentUserId } from "@/lib/current-user";
import { reviewWord, undoLastReview } from "@/lib/review";

/** The four FSRS grades. Named rather than inlined so both guards read the same way. */
const VALID_RATINGS = [1, 2, 3, 4];

/**
 * Apply an FSRS rating to one word for the current user: update the scheduling state and
 * append an immutable review-log row.
 *
 * Guards, in the order the route handler ran them: authentication, then a non-empty string
 * `wordId`, then a rating in {1,2,3,4}. Throwing is the whole error channel here — Next.js
 * redacts a thrown message before it reaches the browser (the client sees a generic error
 * plus a digest), so these strings are for the server log and the caller renders its own
 * copy. That is why the client's message is "Failed to save your review." rather than
 * anything it read off the rejection.
 *
 * @param input `wordId` to rate and the rating to apply.
 * @returns the new due date and FSRS state, which the caller is free to ignore; the optimistic
 *   UI does exactly that and uses only whether this resolved or rejected.
 */
export async function rateCard(input: { wordId: string; rating: number }) {
  const userId = await getCurrentUserId(); // throws → the action rejects, unauthenticated
  const { wordId, rating } = input;
  if (typeof wordId !== "string" || !wordId) throw new Error("wordId is required");
  if (typeof rating !== "number" || !VALID_RATINGS.includes(rating)) {
    throw new Error("rating must be 1, 2, 3, or 4");
  }
  return reviewWord(userId, wordId, rating);
}

/**
 * Revert the most recent review of one word (the single-step undo): roll the card back to its
 * prior scheduling state and delete that log row.
 *
 * `undoLastReview` returns null when there is nothing to undo, which the retired route
 * reported as a 404. An action has no status code, so that case throws: it means the client's
 * view of what it has rated disagrees with the database, which is a genuine error rather than
 * a quiet no-op, and the client already guards the common case by disabling Undo on an empty
 * history.
 *
 * @param input `wordId` whose last review should be rolled back.
 * @returns the restored due date.
 */
export async function undoRating(input: { wordId: string }) {
  const userId = await getCurrentUserId();
  const { wordId } = input;
  if (typeof wordId !== "string" || !wordId) throw new Error("wordId is required");

  const result = await undoLastReview(userId, wordId);
  if (!result) throw new Error("Nothing to undo for this word");
  return result;
}
