-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "provider" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "dedupeKey" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Notification_organisationId_createdAt_idx" ON "Notification"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organisationId_readAt_idx" ON "Notification"("organisationId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organisationId_dedupeKey_key" ON "Notification"("organisationId", "dedupeKey");
