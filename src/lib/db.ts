// Prisma client singleton.
//
// Why a singleton: in development Next.js hot-reloads modules on every change.
// Without this guard, each reload would construct a brand-new PrismaClient (and a
// fresh DB connection pool) and quickly exhaust Postgres connections. We cache one
// instance on globalThis so it survives Hot Module Replacement. In production a
// single instance per server process is created and the global is not used.
//
// Prisma 7 connects through a driver adapter (here `@prisma/adapter-pg`, the
// node-postgres adapter) rather than an internal engine; the connection string
// comes from DATABASE_URL (loaded by Next.js, or by dotenv in standalone scripts).
//
// Always import the database client from HERE (`@/lib/db`) — never from the
// generated output (`src/generated/prisma`) directly — so every caller shares the
// same connection pool.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse a single client across HMR reloads by stashing it on the global object.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Fail fast with a clear message rather than a confusing driver error later.
    throw new Error("DATABASE_URL is not set — check your .env (see .env.example).");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
