-- Lower the default daily new-card cap 20 -> 10: a research-backed, sustainable pace that
-- matches the "ten words a day" product promise (SPEC §16). Smaller new-card rates keep the
-- daily review pile manageable (review debt is the #1 reason learners abandon SRS).
ALTER TABLE "UserProfile" ALTER COLUMN "newCardsPerDay" SET DEFAULT 10;

-- One-time data fix: bring existing profiles still on the old default (20) down to the new
-- default. Scoped to "= 20" so a deliberately-customised value is never clobbered. Runs on
-- prod via `prisma migrate deploy` at the next deploy, keeping local and prod consistent.
UPDATE "UserProfile" SET "newCardsPerDay" = 10 WHERE "newCardsPerDay" = 20;
