-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "website" TEXT,
    "addWebsiteToKb" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Onboarding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "appDescription" TEXT,
    "reachType" TEXT,
    "environmentUrl" TEXT,
    "selectedOs" TEXT,
    "localPort" INTEGER,
    "tunnelToken" TEXT,
    "focus" TEXT,
    "teamInvites" TEXT,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Onboarding_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Integration_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "release" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "branch" TEXT,
    "prNumber" INTEGER,
    "status" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "coverage" REAL NOT NULL,
    "costAvoided" REAL NOT NULL,
    "codeChanges" INTEGER NOT NULL,
    "impactedTests" INTEGER NOT NULL,
    "regressionsCaught" INTEGER NOT NULL,
    "anomaliesReproduced" INTEGER NOT NULL,
    "testsAdded" INTEGER NOT NULL,
    "testsTotal" INTEGER NOT NULL,
    "testsPassed" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testRunId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "stream" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    CONSTRAINT "LogLine_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Onboarding_organisationId_key" ON "Onboarding"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_organisationId_provider_key" ON "Integration"("organisationId", "provider");

-- CreateIndex
CREATE INDEX "TestRun_organisationId_createdAt_idx" ON "TestRun"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "LogLine_testRunId_timestamp_idx" ON "LogLine"("testRunId", "timestamp");
