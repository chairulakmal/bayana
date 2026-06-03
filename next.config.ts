import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Postgres driver (and pg-native bits) out of the server bundle — they use
  // dynamic requires that bundlers can't statically analyze. Required for Prisma's
  // pg driver adapter to work in Next's server runtime.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
