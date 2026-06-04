// Auth.js (NextAuth v5) configuration — passwordless email magic-link sign-in,
// restricted to allowlisted addresses, with database sessions (SPEC §11).
//
// Security (SPEC §11.3):
//  - The allowlist is enforced BEFORE any email is sent (in sendVerificationRequest),
//    so this endpoint can never be abused as an open email relay (#4).
//  - Magic-link tokens are single-use (handled by Auth.js) with a 15-minute TTL (#3).
//  - Sessions live in Postgres via the Prisma adapter; cookies are httpOnly/secure (#6).
//  - A signIn callback re-checks the allowlist at verification time (defense in depth).

import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

// Parse AUTH_ALLOWED_EMAIL as a comma-separated list (single address still works).
// Stored as a Set for O(1) lookup. Both sides are lowercased: Auth.js lowercases the
// submitted identifier before our checks run, and we normalize the env var too so a
// stray uppercase doesn't accidentally lock someone out (availability footgun, not a
// bypass). Email local-parts are technically case-sensitive per RFC 5321, but every
// real provider treats them case-insensitively, so this is safe.
const ALLOWED_EMAILS: Set<string> = new Set(
  (process.env.AUTH_ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);
const EMAIL_FROM = process.env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev";
const TOKEN_TTL_SECONDS = 15 * 60; // 15-minute magic links
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30-day database sessions

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
    // Explicit session expiry (SPEC §11.3 #6) rather than relying on the library default.
    // 30 days suits a personal study app (stay signed in between sessions); shorten if a
    // tighter window is wanted. `updateAge` makes it rolling: an active session is only
    // re-persisted once per day, avoiding a DB write on every request.
    maxAge: SESSION_TTL_SECONDS,
    updateAge: 24 * 60 * 60,
  },
  trustHost: true, // behind Railway's proxy (not Vercel), so trust the forwarded host
  pages: { signIn: "/auth/signin" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: EMAIL_FROM,
      maxAge: TOKEN_TTL_SECONDS,
      // Send the magic link ourselves so we can gate on the allowlist FIRST.
      async sendVerificationRequest({ identifier: email, url }) {
        // Fails CLOSED: if the set is empty (env var unset/blank), no email is ever sent.
        if (!ALLOWED_EMAILS.has(email.trim().toLowerCase())) {
          // Reject before any email is sent → no open relay (SPEC §11.3 #4).
          throw new Error("This email address is not allowed to sign in.");
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: email,
            subject: "Sign in to Bayana 🦜",
            text: `Sign in to Bayana:\n${url}\n\nThis link expires in 15 minutes and can be used once.`,
            html: `<p>Click to sign in to <strong>Bayana</strong>:</p>
                   <p><a href="${url}">${url}</a></p>
                   <p style="color:#666">This link expires in 15 minutes and can be used once.</p>`,
          }),
        });
        if (!res.ok) {
          throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
        }
      },
    }),
  ],
  callbacks: {
    // Defense in depth: reject any non-allowlisted email at verification time too.
    signIn({ user }) {
      return !!user.email && ALLOWED_EMAILS.has(user.email.trim().toLowerCase());
    },
    // Expose the DB user id on the session so server code can scope queries by user.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
