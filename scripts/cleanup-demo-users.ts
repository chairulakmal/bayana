// Scheduled sweep of abandoned demo accounts.
//
// This script is the thing that makes the privacy policy's retention promise true. The
// deletion rule itself lives in `src/lib/demo-cleanup.ts`, shared with the demo-login route;
// what this file adds is an entry point that runs on a clock instead of on a visitor.
//
// Usage:
//   npx tsx scripts/cleanup-demo-users.ts
//
// Deploying it on Railway: add a **second service** in the same project, pointed at this
// same repository and sharing the app's `DATABASE_URL`, with
//   - Start command: `npx tsx scripts/cleanup-demo-users.ts`
//   - Cron schedule: `0 4 * * *` (daily, 04:00 UTC)
// Railway runs a cron service as a one-off container per tick and considers the tick done
// when the process exits, which is why this exits explicitly below rather than lingering.
//
// A cron *service* rather than an authenticated `/api/cron/*` route, deliberately: a route
// would put a destructive, unauthenticated-by-default operation on the public internet and
// make its safety depend on a shared secret being compared correctly. A scheduled process is
// not web-reachable at all, which is the stronger property (SPEC §11.3).
//
// Idempotent and safe to run at any frequency: it deletes only rows that are already
// provably unreachable, so a double tick simply finds nothing the second time.
//
// `dotenv/config` first so DATABASE_URL is loaded before the Prisma client is constructed.
import "dotenv/config";
import { deleteStaleDemoUsers } from "@/lib/demo-cleanup";

async function main() {
  const { deleted, cutoff } = await deleteStaleDemoUsers();
  // One structured-ish line, because this runs unattended: the count is the only evidence
  // that the promise is being kept, and the cutoff makes a surprising count diagnosable.
  console.log(
    `[demo-cleanup] deleted ${deleted} abandoned demo account(s) created before ${cutoff.toISOString()}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    // Exit non-zero so a failed tick is visible as a failed run rather than a silent no-op.
    console.error("[demo-cleanup] failed:", err);
    process.exit(1);
  });
