import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
