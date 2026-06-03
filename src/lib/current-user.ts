// Resolves the acting user for a request — the real security boundary.
//
// Validates the Auth.js session server-side (database session via the Prisma adapter)
// and returns the signed-in user's id. Throws if there is no valid session, so callers
// can return 401. This replaced the Phase-1a `DEFAULT_USER_ID` shim.
import { auth } from "@/auth";

export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return session.user.id;
}
