import type { NextConfig } from "next";

// Security response headers (SPEC §11.3 #8), applied to every route. These are
// defense-in-depth: none is load-bearing on its own, but together they close off
// whole bug classes (clickjacking, MIME sniffing, protocol downgrade) for free.
//
// CSP note: Next.js injects inline <script> tags for hydration and React uses
// inline style attributes, so `'unsafe-inline'` is required in script-src/style-src
// unless we adopt per-request nonces (which need dynamic rendering everywhere —
// not worth it for an app with no third-party scripts). Even with 'unsafe-inline',
// the policy still blocks loading any EXTERNAL script/frame/object, which is the
// main XSS exfiltration/escalation path worth blocking here.
// `next dev` sets NODE_ENV=development. Gate dev-only CSP relaxations on this so the
// production policy is unaffected by them.
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    // Force HTTPS for two years, subdomains included. Browsers remember this and
    // refuse plain-HTTP even if a user types http:// — the durable form of the
    // HTTP→HTTPS redirect Railway already does.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-eval' in DEVELOPMENT ONLY. React's development build calls eval() for
      // debugging features (reconstructing cross-environment callstacks for the error
      // overlay), and Turbopack's HMR runtime evaluates hot-updated modules the same way.
      // Without it the dev server throws "eval() is not supported in this environment" and
      // the overlay degrades. React never uses eval() in production, so the production
      // policy keeps script-src strict — which matters, because 'unsafe-eval' would undo
      // much of what this CSP is for by making any injected string executable.
      isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
      // No third-party hosts here: next/font downloads the brand faces at build time and
      // serves them from /_next/static/media, so neither fonts.googleapis.com (stylesheet)
      // nor fonts.gstatic.com (font files) is contacted at runtime any more (SPEC §14.12).
      // Keep it that way: a stray @import of Google Fonts will now be blocked outright.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      // Dev also needs the HMR websocket. CSP 3 says 'self' covers ws:// on the same
      // origin, but browser behaviour here has been inconsistent, so name it explicitly
      // rather than leave hot reload dependent on that detail.
      isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
      "frame-ancestors 'none'", // nothing may embed Bayana in an iframe
      "base-uri 'self'",
      "form-action 'self'", // forms may only submit back to our own origin
    ].join("; "),
  },
  // Legacy equivalent of frame-ancestors for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Never MIME-sniff responses into a different (executable) content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send only the origin (no path/query) on cross-origin navigations — magic-link
  // URLs and level/query params stay out of third-party Referer logs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },

  // Produce a minimal self-contained server bundle: only the files actually imported
  // are included, rather than shipping all of node_modules. Cuts idle RSS by ~30–50%
  // compared to the default "server" output. The trade-off is that Railway/Railpack
  // must serve from .next/standalone/server.js instead of the normal `next start`.
  // The start command in railway.json accounts for this.
  output: "standalone",

  // Keep the Postgres driver (and pg-native bits) out of the server bundle — they use
  // dynamic requires that bundlers can't statically analyze. Required for Prisma's
  // pg driver adapter to work in Next's server runtime.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
