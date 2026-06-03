// Resolves the acting user for a request.
//
// Phase 1a is single-user: every request runs as the seeded DEFAULT_USER_ID. Phase 1b
// replaces this with the Auth.js session user (and a proxy.ts route guard), at which
// point the routes call the session lookup instead — their service calls don't change.
export function getCurrentUserId(): string {
  const id = process.env.DEFAULT_USER_ID;
  if (!id) {
    throw new Error(
      "DEFAULT_USER_ID is not set — run `npx tsx scripts/seed-user.ts` and set it in .env.",
    );
  }
  return id;
}
