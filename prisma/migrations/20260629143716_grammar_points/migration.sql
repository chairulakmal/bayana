-- CreateTable
CREATE TABLE "GrammarPoint" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "lesson" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "pattern" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "meanings" TEXT[],
    "exampleJp" TEXT NOT NULL,
    "exampleEn" TEXT NOT NULL,

    CONSTRAINT "GrammarPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grammarPointId" TEXT NOT NULL,
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReview" TIMESTAMP(3),
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" "FsrsState" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "GrammarProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrammarPoint_level_idx" ON "GrammarPoint"("level");

-- CreateIndex
CREATE UNIQUE INDEX "GrammarPoint_level_lesson_position_key" ON "GrammarPoint"("level", "lesson", "position");

-- CreateIndex
CREATE INDEX "GrammarProgress_userId_due_idx" ON "GrammarProgress"("userId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "GrammarProgress_userId_grammarPointId_key" ON "GrammarProgress"("userId", "grammarPointId");

-- AddForeignKey
ALTER TABLE "GrammarProgress" ADD CONSTRAINT "GrammarProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarProgress" ADD CONSTRAINT "GrammarProgress_grammarPointId_fkey" FOREIGN KEY ("grammarPointId") REFERENCES "GrammarPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
