// Seeds the single default User + its 1:1 UserProfile that the app runs as until
// multi-user auth lands (SPEC §6, §11.5).
//
// Usage:
//   npx tsx scripts/seed-user.ts
//
// Idempotent:
//   - If DEFAULT_USER_ID is set in .env, the user is upserted with that exact id
//     (so the env var and the DB row always agree).
//   - If it is not set yet, we reuse the sole existing user or create a fresh one,
//     then print the id to copy into .env.
//
// `dotenv/config` first so DATABASE_URL (and DEFAULT_USER_ID) are loaded before
// the Prisma client is constructed.
import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
  // Empty string (the blank placeholder in .env) is treated as "not set".
  const pinnedId = process.env.DEFAULT_USER_ID || undefined;

  // 1) Find or create the default user.
  let user;
  if (pinnedId) {
    // Pin the row to the configured id so reruns are stable and match .env.
    user = await db.user.upsert({
      where: { id: pinnedId },
      create: { id: pinnedId }, // email stays null for the default local user
      update: {},
    });
  } else {
    // No id pinned yet: reuse the only existing user, or make one.
    user = (await db.user.findFirst()) ?? (await db.user.create({ data: {} }));
  }

  // 2) Link this user to the allowlisted email so magic-link sign-in attaches to it
  //    (the Auth.js adapter matches users by email) — preserving existing study progress
  //    instead of creating a brand-new user on first login.
  const allowedEmail = process.env.AUTH_ALLOWED_EMAIL || null;
  if (allowedEmail && user.email !== allowedEmail) {
    user = await db.user.update({ where: { id: user.id }, data: { email: allowedEmail } });
    console.log(`Linked email → ${allowedEmail}`);
  }

  // 3) Ensure the 1:1 profile exists (all other fields use schema defaults:
  //    role=MEMBER, studyReverse=false (JP→EN), newCardsPerDay=20, etc.).
  await db.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  console.log(`Default user ready. id = ${user.id}`);
  if (!pinnedId) {
    console.log(`\n→ Add this line to .env so the app and reruns use this user:`);
    console.log(`DEFAULT_USER_ID=${user.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
