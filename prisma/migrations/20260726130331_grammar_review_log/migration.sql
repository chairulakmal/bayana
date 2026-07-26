-- AlterTable
ALTER TABLE "GrammarPoint" ALTER COLUMN "lessonTitle" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GrammarReviewLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grammarPointId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "state" "FsrsState" NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrammarReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrammarReviewLog_userId_reviewedAt_idx" ON "GrammarReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "GrammarReviewLog_userId_grammarPointId_idx" ON "GrammarReviewLog"("userId", "grammarPointId");
