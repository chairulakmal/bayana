// The database seam: the one parameter every DB-touching function in `src/lib` takes so its
// storage can be swapped.
//
// **Why this exists.** `src/lib` is the layer that survives the Nuxt migration close to
// verbatim (TODO.md), which is exactly what makes it dangerous: code that moves without being
// rewritten also moves without being re-read, and a queue whose ordering shifts or a
// distractor pool that quietly narrows produces no error and no visible symptom. Pinning that
// behaviour with tests needs some way to run these functions against known data, and reaching
// for the module-level `db` singleton directly leaves no such way.
//
// So each function takes `deps` as its **last parameter, with a default**. Every existing call
// site keeps working untouched; tests pass a fake; and the port gets a single, named place to
// hand the same logic a different query layer. That last property is the real payoff — TODO.md
// describes the acceptance gate as "a new query layer under them and no change above it", and
// this is that line drawn explicitly rather than left implicit in an import.
//
// **Why the type is `Pick<PrismaClient, …>` rather than a hand-written interface.** A narrow
// interface naming only the methods used would be more self-documenting, but production code
// would then be typed against *our* description of Prisma instead of Prisma's own, so a
// malformed `where` clause would stop being a compile error. Keeping the real client's types
// means the app is checked exactly as strictly as before this seam existed. The cost lands on
// the fake instead, which cannot structurally satisfy Prisma's generic delegates and is cast
// once (see `src/lib/__fixtures__/fake-db.ts`, which compensates by throwing on any query
// shape it does not implement rather than silently answering wrong).

import { db, serializableTxn } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * The Prisma delegates `src/lib` actually uses. Narrowed from the full client so the seam
 * states its surface: anything not listed here is not reachable from the domain layer, and
 * adding a model to this list is a deliberate act.
 */
export type Db = Pick<
  PrismaClient,
  | "word"
  | "exampleSentence"
  | "reviewState"
  | "reviewLog"
  | "grammarPoint"
  | "grammarProgress"
  | "grammarReviewLog"
  | "userProfile"
>;

/**
 * The serializable-transaction runner, as a value rather than a direct import.
 *
 * It is part of the seam because the two review modules are meaningless without it: their
 * whole read-compute-write cycle happens inside one, and a test that could not substitute it
 * would be testing a different code path from the one that runs in production.
 */
export type RunSerializableTxn = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries?: number,
) => Promise<T>;

/** What every seamed function needs. One shape everywhere, so threading it is mechanical. */
export type Deps = {
  db: Db;
  serializableTxn: RunSerializableTxn;
};

/**
 * Production wiring: the real client and the real transaction runner.
 *
 * A module-level constant rather than a factory, deliberately. `profile.ts` memoizes
 * `getProfile` with React's `cache()`, which keys on argument *identity*, so a fresh deps
 * object per call would silently defeat that memoization and restore the duplicate profile
 * reads it was written to remove.
 */
export const defaultDeps: Deps = { db, serializableTxn };
