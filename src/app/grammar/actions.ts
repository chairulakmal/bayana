"use server";

// Write path for Grammar mode (SPEC §9.2). Replaces `POST /api/grammar/review`, which is retired
// with this change.
//
// **These are as web-reachable as the route they replace.** `"use server"` compiles every export
// here into a POST endpoint whose id is discoverable in the client bundle, so an action is not a
// private function that happens to run on the server: its arguments arrive from the network and
// are exactly as untrusted as a JSON body was. Every guard the route handler carried is therefore
// reproduced below, not summarised. What the action buys is a typed signature across the boundary
// and one less hand-maintained JSON contract (§14.16), a developer convenience and never a security
// boundary.
//
// **No `revalidatePath` in either action, deliberately** (§9.2). A session's card list is fixed
// when the queue is built and is client-owned state from that moment (§8.1), so revalidating
// `/grammar/study` would refetch the page underneath a session in progress and throw away the
// user's position in it. `setActiveLevel` is the opposite case and does revalidate, because the
// level scopes what every other route renders.
//
// Colocated at `app/grammar/` rather than `app/grammar/study/` per §9.2's module column, and
// because the grammar hub is the segment that owns grammar writes generally.

import { getCurrentUserId } from "@/lib/current-user";
import { reviewGrammarPoint, undoLastGrammarReview } from "@/lib/grammar-review";

/** The four FSRS grades. Named rather than inlined so both guards read the same way. */
const VALID_RATINGS = [1, 2, 3, 4];

/**
 * Apply an FSRS rating to one grammar point for the current user: update the scheduling state
 * and append a review-log row.
 *
 * Guards, in the order the route handler ran them: authentication, then a non-empty string
 * `grammarPointId`, then a rating in {1,2,3,4}. Throwing is the whole error channel here: Next.js redacts a thrown message before it reaches the browser (the client sees a generic
 * error plus a digest), so these strings are for the server log and the caller renders its own
 * copy. That is why the client's message is "Failed to save your review." rather than anything
 * it read off the rejection.
 *
 * @param input `grammarPointId` to rate and the rating to apply.
 * @returns the new due date and FSRS state, which the caller is free to ignore; the optimistic
 *   UI does exactly that and uses only whether this resolved or rejected.
 */
export async function rateGrammarPoint(input: { grammarPointId: string; rating: number }) {
  const userId = await getCurrentUserId(); // throws → the action rejects, unauthenticated
  const { grammarPointId, rating } = input;
  if (typeof grammarPointId !== "string" || !grammarPointId) {
    throw new Error("grammarPointId is required");
  }
  if (typeof rating !== "number" || !VALID_RATINGS.includes(rating)) {
    throw new Error("rating must be 1, 2, 3, or 4");
  }
  return reviewGrammarPoint(userId, grammarPointId, rating);
}

/**
 * Revert the most recent review of one grammar point (the single-step undo): roll the card back
 * to its prior scheduling state and delete that log row.
 *
 * New with this change rather than ported: grammar had no undo, because `GrammarProgress` holds
 * only the latest state and there was nothing to roll back to. `GrammarReviewLog` is what supplies
 * the prior state, and SPEC §8.4 records that vocab/grammar shortcut parity is deliberate, which
 * `u` being the one key the two queues disagreed on made worth closing.
 *
 * `undoLastGrammarReview` returns null when there is nothing to undo. An action has no status
 * code, so that case throws: it means the client's view of what it has rated disagrees with the
 * database, which is a genuine error rather than a quiet no-op, and the client already guards the
 * common case by disabling Undo on an empty history.
 *
 * @param input `grammarPointId` whose last review should be rolled back.
 * @returns the restored due date.
 */
export async function undoGrammarRating(input: { grammarPointId: string }) {
  const userId = await getCurrentUserId();
  const { grammarPointId } = input;
  if (typeof grammarPointId !== "string" || !grammarPointId) {
    throw new Error("grammarPointId is required");
  }

  const result = await undoLastGrammarReview(userId, grammarPointId);
  if (!result) throw new Error("Nothing to undo for this grammar point");
  return result;
}
