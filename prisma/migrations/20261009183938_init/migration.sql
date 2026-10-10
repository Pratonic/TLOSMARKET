-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('PORTFOLIO', 'GOOD_1', 'GOOD_2', 'GOOD_3', 'REVEAL_GOOD', 'BAD_1', 'BAD_2', 'BAD_3', 'REVEAL_BAD', 'FINAL_DECISION', 'END');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('GOOD', 'BAD');

-- CreateEnum
CREATE TYPE "ChoiceOption" AS ENUM ('AGGRESSIVE', 'MODERATE', 'PASS', 'HOLD', 'SELL_HALF', 'EXIT');

-- CreateTable
CREATE TABLE "Game" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "phase" "Phase" NOT NULL DEFAULT 'PORTFOLIO',
    "marketOpen" BOOLEAN NOT NULL DEFAULT false,
    "gameVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "basePrice" DECIMAL(20,6) NOT NULL DEFAULT 1000,
    "poolSize" INTEGER NOT NULL DEFAULT 2000,
    "poolSold" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "startingCash" DECIMAL(20,6) NOT NULL DEFAULT 10000000,
    "cash" DECIMAL(20,6) NOT NULL DEFAULT 10000000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(20,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDef" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCompany" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "aggressiveMove" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "moderateMove" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "holdDrop" DECIMAL(10,6) NOT NULL DEFAULT 0,

    CONSTRAINT "EventCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Choice" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "option" "ChoiceOption" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Choice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventResult" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "chosenOption" "ChoiceOption" NOT NULL,
    "effectiveOption" "ChoiceOption" NOT NULL,
    "downgradedFrom" "ChoiceOption",
    "feePaid" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "cashBefore" DECIMAL(20,6) NOT NULL,
    "cashAfter" DECIMAL(20,6) NOT NULL,
    "netWorthBefore" DECIMAL(20,6) NOT NULL,
    "netWorthAfter" DECIMAL(20,6) NOT NULL,
    "netWorthDelta" DECIMAL(20,6) NOT NULL,
    "optionDeltas" JSONB NOT NULL,
    "companyDetails" JSONB NOT NULL,
    "parameters" JSONB NOT NULL,
    "frozen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "milestone" "Phase" NOT NULL,
    "cash" DECIMAL(20,6) NOT NULL,
    "netWorth" DECIMAL(20,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotHolding" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "price" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "SnapshotHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeScore" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "judgeName" TEXT NOT NULL,
    "clarity" INTEGER NOT NULL DEFAULT 0,
    "justification" INTEGER NOT NULL DEFAULT 0,
    "answerQuality" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JudgeScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamNotes" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "line1" TEXT NOT NULL DEFAULT '',
    "line2" TEXT NOT NULL DEFAULT '',
    "line3" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TeamNotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_symbol_key" ON "Company"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Team_username_key" ON "Team"("username");

-- CreateIndex
CREATE INDEX "Trade_teamId_idx" ON "Trade"("teamId");

-- CreateIndex
CREATE INDEX "Trade_companyId_idx" ON "Trade"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EventDef_code_key" ON "EventDef"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EventCompany_eventId_companyId_key" ON "EventCompany"("eventId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Choice_teamId_eventId_key" ON "Choice"("teamId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventResult_teamId_eventId_key" ON "EventResult"("teamId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_teamId_milestone_key" ON "Snapshot"("teamId", "milestone");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotHolding_snapshotId_companyId_key" ON "SnapshotHolding"("snapshotId", "companyId");

-- CreateIndex
CREATE INDEX "LoginAttempt_username_ip_createdAt_idx" ON "LoginAttempt"("username", "ip", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeScore_teamId_judgeName_key" ON "JudgeScore"("teamId", "judgeName");

-- CreateIndex
CREATE UNIQUE INDEX "TeamNotes_teamId_key" ON "TeamNotes"("teamId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCompany" ADD CONSTRAINT "EventCompany_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCompany" ADD CONSTRAINT "EventCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Choice" ADD CONSTRAINT "Choice_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Choice" ADD CONSTRAINT "Choice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotHolding" ADD CONSTRAINT "SnapshotHolding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotHolding" ADD CONSTRAINT "SnapshotHolding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeScore" ADD CONSTRAINT "JudgeScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamNotes" ADD CONSTRAINT "TeamNotes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
