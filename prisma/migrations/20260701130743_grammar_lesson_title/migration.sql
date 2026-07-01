/*
  Warnings:

  - Added the required column `lessonTitle` to the `GrammarPoint` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Default '' only backfills existing rows; the app always supplies a real value on
-- writes (lessonTitle has no @default in schema.prisma), so this satisfies NOT NULL
-- without making the column optional at the Prisma layer.
ALTER TABLE "GrammarPoint" ADD COLUMN     "lessonTitle" TEXT NOT NULL DEFAULT '';
