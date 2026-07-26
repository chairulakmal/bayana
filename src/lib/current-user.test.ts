// Tests for the demo-cookie authentication path (current-user.ts).
//
// **These are a specification, not just a characterization.** Everything else in this suite
// pins behaviour so the Nuxt port can be diffed against it; this file pins behaviour the port
// is not allowed to get wrong. The demo cookie is the app's second authentication path (SPEC
// §11.8) and it is self-issued: there is no server-side session row to check it against, so
// the HMAC and the signed expiry are the entire security boundary. Each rejection below
// corresponds to a concrete forgery, named in the test.
//
// No mocking of `next/headers` or Auth.js is needed, and that is why `verifyDemoCookie` was
// exported. The cookie functions are pure apart from reading `AUTH_SECRET`, so the crypto can
// be tested directly instead of through two layers of framework.

import { describe, it, expect, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";

// `current-user.ts` imports Auth.js and `next/headers` at module scope, for the *other*
// session path (`getOptionalUser` / `requireAuth`). Nothing under test here touches either,
// but loading them would drag the whole Next.js server runtime into a Node test process — and
// next-auth's own `next/server` import does not resolve outside a Next build.
//
// Stubbing both is honest rather than convenient: it states that the demo-cookie crypto has no
// dependency on the framework, which is exactly the claim that has to hold for this file's
// security behaviour to port unchanged. If a future edit made these stubs load-bearing, that
// would itself be the finding.
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import {
  DEMO_COOKIE_TTL_MS,
  createDemoCookieValue,
  verifyDemoCookie,
} from "@/lib/current-user";

const USER_ID = "clxdemo0000000000000000";

/** An expiry comfortably in the future, as a live cookie would carry. */
function futureExpiry(): number {
  return Date.now() + DEMO_COOKIE_TTL_MS;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("createDemoCookieValue", () => {
  it("produces `userId:expiresAtMs:hmac` with a 64-char hex signature", () => {
    const expiry = futureExpiry();
    const value = createDemoCookieValue(USER_ID, expiry);
    const [id, exp, sig] = value.split(":");
    expect(id).toBe(USER_ID);
    expect(exp).toBe(String(expiry));
    expect(sig).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  it("signs the expiry as well as the userId", () => {
    // The property the whole scheme rests on. If the signature covered only the userId, a
    // holder could extend their own session forever by editing the middle field.
    const a = createDemoCookieValue(USER_ID, 1_000_000);
    const b = createDemoCookieValue(USER_ID, 2_000_000);
    expect(a.split(":")[2]).not.toBe(b.split(":")[2]);
  });
});

describe("verifyDemoCookie", () => {
  it("accepts a cookie it just issued", () => {
    expect(verifyDemoCookie(createDemoCookieValue(USER_ID, futureExpiry()))).toBe(USER_ID);
  });

  it("rejects a cookie whose expiry has passed", () => {
    // Server-side expiry, not the browser's cookie attribute. A captured cookie value replayed
    // after its deadline must die even though the client controls whether it sends it.
    const value = createDemoCookieValue(USER_ID, Date.now() - 1);
    expect(verifyDemoCookie(value)).toBeNull();
  });

  it("rejects a cookie that expires exactly now", () => {
    // The boundary is `Date.now() > expiresAtMs`, so equality is still valid. Pinned because
    // a port that writes `>=` changes the contract by a millisecond and nothing would notice.
    vi.useFakeTimers();
    const instant = new Date("2026-07-27T00:00:00.000Z");
    vi.setSystemTime(instant);
    const value = createDemoCookieValue(USER_ID, instant.getTime());
    expect(verifyDemoCookie(value)).toBe(USER_ID);
    vi.setSystemTime(new Date(instant.getTime() + 1));
    expect(verifyDemoCookie(value)).toBeNull();
  });

  it("rejects a forged userId (the impersonation attack)", () => {
    // Swap the id and keep someone else's valid signature: this is the attack the HMAC exists
    // to stop, since the userId is the only thing identifying whose rows get served.
    const value = createDemoCookieValue(USER_ID, futureExpiry());
    const [, exp, sig] = value.split(":");
    expect(verifyDemoCookie(`clxvictim000000000000000:${exp}:${sig}`)).toBeNull();
  });

  it("rejects an extended expiry (the immortal-session attack)", () => {
    const expiry = futureExpiry();
    const value = createDemoCookieValue(USER_ID, expiry);
    const [id, , sig] = value.split(":");
    const farFuture = expiry + 365 * 24 * 60 * 60 * 1000;
    expect(verifyDemoCookie(`${id}:${farFuture}:${sig}`)).toBeNull();
  });

  it("rejects a signature made with a different key", () => {
    // The forger knows the format but not AUTH_SECRET.
    const expiry = futureExpiry();
    const payload = `${USER_ID}:${expiry}`;
    const wrongSig = createHmac("sha256", "not-the-real-secret").update(payload).digest("hex");
    expect(verifyDemoCookie(`${payload}:${wrongSig}`)).toBeNull();
  });

  it("rejects malformed values instead of throwing", () => {
    // A malformed cookie is untrusted input from the internet. Every one of these must return
    // null, never throw: a throw here would be a 500 on any page load, reachable by anyone.
    const malformed = [
      "",
      "nocolons",
      `${USER_ID}:${futureExpiry()}`, // no signature
      `${USER_ID}::`, // empty expiry and signature
      `:${futureExpiry()}:${"a".repeat(64)}`, // empty userId
      `${USER_ID}:notanumber:${"a".repeat(64)}`,
      `${USER_ID}:${futureExpiry()}:short`, // wrong signature length
      `${USER_ID}:${futureExpiry()}:${"z".repeat(64)}`, // right length, not hex
      `${USER_ID}:${futureExpiry()}:${"a".repeat(128)}`, // over-long signature
    ];
    for (const value of malformed) {
      expect(() => verifyDemoCookie(value)).not.toThrow();
      expect(verifyDemoCookie(value)).toBeNull();
    }
  });

  it("rejects the pre-expiry `userId:hmac` cookie format", () => {
    // Documented behaviour: old-format cookies fail verification and fall through to the
    // sign-in redirect. Acceptable for throwaway demo sessions, and asserted so that
    // "acceptable" stays a decision rather than a surprise.
    const legacySig = createHmac("sha256", "test-auth-secret-not-a-real-key")
      .update(USER_ID)
      .digest("hex");
    expect(verifyDemoCookie(`${USER_ID}:${legacySig}`)).toBeNull();
  });
});

describe("AUTH_SECRET handling", () => {
  it("throws rather than signing with an empty key when AUTH_SECRET is missing", () => {
    // Fail CLOSED. The previous `?? ""` fallback meant a misconfigured deploy signed every
    // cookie with a publicly-known key, making any userId forgeable — a silent total auth
    // bypass. A loud throw is the correct failure for a missing secret.
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => createDemoCookieValue(USER_ID, futureExpiry())).toThrow(/AUTH_SECRET/);
    expect(() => verifyDemoCookie(`${USER_ID}:${futureExpiry()}:${"a".repeat(64)}`)).toThrow(
      /AUTH_SECRET/,
    );
  });

  it("cannot verify a cookie signed under a different secret", () => {
    // Rotating AUTH_SECRET invalidates every live demo session. That is the intended
    // consequence and worth stating: rotation is a logout-everyone event.
    const value = createDemoCookieValue(USER_ID, futureExpiry());
    vi.stubEnv("AUTH_SECRET", "a-rotated-secret");
    expect(verifyDemoCookie(value)).toBeNull();
  });
});

describe("DEMO_COOKIE_TTL_MS", () => {
  it("is 7 days", () => {
    // The number the privacy policy's retention promise is measured from, and the cutoff
    // `deleteStaleDemoUsers` uses to decide a row is provably unreachable. Changing it changes
    // a published commitment, so it should not be changed silently.
    expect(DEMO_COOKIE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
