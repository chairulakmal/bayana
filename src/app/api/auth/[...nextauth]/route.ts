// Auth.js catch-all route — handles sign-in requests, the magic-link callback, session,
// and sign-out. The Prisma adapter + database sessions need the Node runtime.
import { handlers } from "@/auth";

export const runtime = "nodejs";
export const { GET, POST } = handlers;
