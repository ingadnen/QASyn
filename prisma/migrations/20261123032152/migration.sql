-- CreateTable
CREATE TABLE "TunnelMachine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT NOT NULL DEFAULT 'win',
    "hostname" TEXT,
    "status" TEXT NOT NULL DEFAULT 'expired',
    "browserHost" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "routeCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME,
    "connectedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TunnelMachine_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'charge',
    "note" TEXT,
    CONSTRAINT "CreditEntry_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestCaseVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'System',
    "addedJson" TEXT NOT NULL DEFAULT '[]',
    "removedJson" TEXT NOT NULL DEFAULT '[]',
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestCaseVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestCaseVersion_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestCaseRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'Automated',
    "mode" TEXT NOT NULL DEFAULT 'Standalone Run',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "failedStep" INTEGER,
    "failedStepText" TEXT,
    "autoFix" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "logJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestCaseRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestCaseRun_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MobileApp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileApp_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MobileTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "appId" TEXT,
    "name" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "deviceSelector" TEXT NOT NULL DEFAULT '',
    "gesturesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "logsJson" TEXT NOT NULL DEFAULT '[]',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileTest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MobileTest_appId_fkey" FOREIGN KEY ("appId") REFERENCES "MobileApp" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requestsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "resultsJson" TEXT NOT NULL DEFAULT '[]',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiTest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "decision" TEXT NOT NULL DEFAULT 'Pending',
    "stagesJson" TEXT NOT NULL DEFAULT '[]',
    "decisionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipWorkflow_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "branch" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filesChangedJson" TEXT NOT NULL DEFAULT '[]',
    "scopeJson" TEXT NOT NULL DEFAULT '[]',
    "riskLevel" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'Pending',
    "impactAssessment" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrAnalysis_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL DEFAULT '{}',
    "resultsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentTest_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalVariable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'String',
    "permission" TEXT NOT NULL DEFAULT 'RO',
    "value" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalVariable_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appUrl" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT 'Username and password',
    "username" TEXT NOT NULL DEFAULT '',
    "passwordCipher" TEXT NOT NULL DEFAULT '',
    "autoSignIn" BOOLEAN NOT NULL DEFAULT true,
    "advancedJson" TEXT NOT NULL DEFAULT '{}',
    "lastSignedInAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProxyProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8080,
    "username" TEXT NOT NULL DEFAULT '',
    "passwordCipher" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProxyProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewportSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Desktop',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewportSetting_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemoteBrowserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "remoteUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemoteBrowserProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContextSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "extractedText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContextSource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContextGraphNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "propertiesJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContextGraphNode_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContextGraphEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContextGraphEdge_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiTestChain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requestsJson" TEXT NOT NULL DEFAULT '[]',
    "resultsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiTestChain_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentTestSuite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentEndpoint" TEXT NOT NULL,
    "guardrailsJson" TEXT NOT NULL DEFAULT '[]',
    "knowledgeBaseJson" TEXT NOT NULL DEFAULT '[]',
    "lastVerdict" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentTestSuite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'web',
    "baseUrl" TEXT,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "testPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" DATETIME,
    "nextFireAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Schedule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestPlanExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "testPlanId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'manual',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "resultsJson" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "TestPlanExecution_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvironmentVariable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "environmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvironmentVariable_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "EnvironmentConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permission" TEXT NOT NULL DEFAULT 'RO',
    "environmentIds" TEXT NOT NULL DEFAULT '[]',
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "columnsJson" TEXT NOT NULL DEFAULT '[]',
    "rowsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataProfile_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualBaseline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "screenshotB64" TEXT NOT NULL DEFAULT '',
    "pixelHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisualBaseline_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisualDiff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baselineId" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "diffImageB64" TEXT NOT NULL DEFAULT '',
    "mismatchPercent" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisualDiff_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "VisualBaseline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Webhook_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT '[]',
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestComponent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#5b4ee8',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestFolder_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExploratorySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "actionsJson" TEXT NOT NULL DEFAULT '[]',
    "notesJson" TEXT NOT NULL DEFAULT '[]',
    "convertedCaseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "ExploratorySession_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "temperament" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "behaviorRules" TEXT NOT NULL DEFAULT '[]',
    "promptTemplate" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Persona_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RedTeamSuite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attacksJson" TEXT NOT NULL DEFAULT '[]',
    "resultsJson" TEXT NOT NULL DEFAULT '[]',
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RedTeamSuite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testRunId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "threshold" REAL,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "coverImage" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "tags" TEXT NOT NULL,
    "readTimeMin" INTEGER NOT NULL DEFAULT 5,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "featured" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "logoUrl" TEXT,
    "heroQuote" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "resultsJson" TEXT NOT NULL,
    "fullStory" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "shortDef" TEXT NOT NULL,
    "detailedDef" TEXT NOT NULL,
    "relatedTerms" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "durationHours" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "syllabusJson" TEXT NOT NULL,
    "badgeName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "certCode" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmailTestInbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailTestInbox_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailTestMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inboxId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "extractedOtp" TEXT,
    "extractedLinks" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailTestMessage_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "EmailTestInbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "scanType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "findingsJson" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "SecurityScan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "prNumber" INTEGER,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "factorsJson" TEXT NOT NULL,
    "suggestedTests" TEXT NOT NULL,
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskAnalysis_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InfrastructureGridNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "browserName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentRunId" TEXT,
    "concurrencyCap" INTEGER NOT NULL DEFAULT 5,
    "activeWorkers" INTEGER NOT NULL DEFAULT 0,
    "lastHeartbeat" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfrastructureGridNode_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'outbox',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Engineer',
    "invitedByEmail" TEXT NOT NULL DEFAULT 'system@qasyn.local',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamInvite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT '',
    "systemPrompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'QASyn Vision AI',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformPaymentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'platform',
    "paypalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paypalRecipientEmail" TEXT NOT NULL DEFAULT 'ingrebhiadnen@gmail.com',
    "paypalClientId" TEXT NOT NULL DEFAULT '',
    "paypalMeOrCheckoutUrl" TEXT NOT NULL DEFAULT 'https://www.paypal.com/cgi-bin/webscr',
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stripeRecipientAccount" TEXT NOT NULL DEFAULT 'ingrebhiadnen@gmail.com',
    "stripePublishableKey" TEXT NOT NULL DEFAULT '',
    "stripeSecretKey" TEXT NOT NULL DEFAULT '',
    "stripeWebhookSecret" TEXT NOT NULL DEFAULT '',
    "invoiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "invoiceBeneficiaryName" TEXT NOT NULL DEFAULT 'QASyn Inc.',
    "invoiceRecipientEmail" TEXT NOT NULL DEFAULT 'ingrebhiadnen@gmail.com',
    "invoiceBankDetails" TEXT NOT NULL DEFAULT 'RBC Royal Bank · Interac e-Transfer: ingrebhiadnen@gmail.com',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "mode" TEXT NOT NULL DEFAULT 'live_or_verified',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_TestCaseToTestSuite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TestCaseToTestSuite_A_fkey" FOREIGN KEY ("A") REFERENCES "TestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TestCaseToTestSuite_B_fkey" FOREIGN KEY ("B") REFERENCES "TestSuite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_TestCaseToTestPlan" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TestCaseToTestPlan_A_fkey" FOREIGN KEY ("A") REFERENCES "TestCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TestCaseToTestPlan_B_fkey" FOREIGN KEY ("B") REFERENCES "TestPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_TestPlanToTestSuite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TestPlanToTestSuite_A_fkey" FOREIGN KEY ("A") REFERENCES "TestPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TestPlanToTestSuite_B_fkey" FOREIGN KEY ("B") REFERENCES "TestSuite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" DATETIME,
    "ipAllowlistJson" TEXT NOT NULL DEFAULT '[]',
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiToken_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiToken" ("createdAt", "id", "lastUsedAt", "name", "organisationId", "tokenHash", "tokenPrefix") SELECT "createdAt", "id", "lastUsedAt", "name", "organisationId", "tokenHash", "tokenPrefix" FROM "ApiToken";
DROP TABLE "ApiToken";
ALTER TABLE "new_ApiToken" RENAME TO "ApiToken";
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");
CREATE INDEX "ApiToken_organisationId_idx" ON "ApiToken"("organisationId");
CREATE TABLE "new_CrawlSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "targetUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pagesVisited" INTEGER NOT NULL DEFAULT 0,
    "flowsMapped" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "logs" TEXT NOT NULL DEFAULT '[]',
    "publishMode" TEXT NOT NULL DEFAULT 'Require approval',
    "testTypesJson" TEXT NOT NULL DEFAULT '[]',
    "prerequisitesJson" TEXT NOT NULL DEFAULT '[]',
    "requirementId" TEXT,
    "explorePrompt" TEXT NOT NULL DEFAULT '',
    "additionalContext" TEXT NOT NULL DEFAULT '',
    "createSuite" BOOLEAN NOT NULL DEFAULT false,
    "createPlan" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CrawlSession_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrawlSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CrawlSession" ("completedAt", "flowsMapped", "id", "logs", "organisationId", "pagesVisited", "startedAt", "status", "targetUrl") SELECT "completedAt", "flowsMapped", "id", "logs", "organisationId", "pagesVisited", "startedAt", "status", "targetUrl" FROM "CrawlSession";
DROP TABLE "CrawlSession";
ALTER TABLE "new_CrawlSession" RENAME TO "CrawlSession";
CREATE INDEX "CrawlSession_organisationId_startedAt_idx" ON "CrawlSession"("organisationId", "startedAt");
CREATE TABLE "new_EnvironmentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "accent" TEXT NOT NULL DEFAULT '#5b4ee8',
    "authType" TEXT NOT NULL DEFAULT 'none',
    "variablesJson" TEXT NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvironmentConfig_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EnvironmentConfig" ("authType", "baseUrl", "createdAt", "id", "isDefault", "name", "organisationId", "variablesJson") SELECT "authType", "baseUrl", "createdAt", "id", "isDefault", "name", "organisationId", "variablesJson" FROM "EnvironmentConfig";
DROP TABLE "EnvironmentConfig";
ALTER TABLE "new_EnvironmentConfig" RENAME TO "EnvironmentConfig";
CREATE INDEX "EnvironmentConfig_organisationId_idx" ON "EnvironmentConfig"("organisationId");
CREATE TABLE "new_Integration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "lastSyncAt" DATETIME,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Integration_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Integration" ("connectedAt", "detail", "id", "organisationId", "provider", "status", "updatedAt") SELECT "connectedAt", "detail", "id", "organisationId", "provider", "status", "updatedAt" FROM "Integration";
DROP TABLE "Integration";
ALTER TABLE "new_Integration" RENAME TO "Integration";
CREATE UNIQUE INDEX "Integration_organisationId_provider_key" ON "Integration"("organisationId", "provider");
CREATE TABLE "new_PullRequestCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "branchTarget" TEXT NOT NULL DEFAULT 'main',
    "author" TEXT NOT NULL,
    "provider" TEXT,
    "repository" TEXT,
    "externalUrl" TEXT,
    "status" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "filesChanged" INTEGER NOT NULL,
    "changedFilesJson" TEXT NOT NULL DEFAULT '[]',
    "impactJson" TEXT NOT NULL DEFAULT '{}',
    "logsJson" TEXT NOT NULL DEFAULT '[]',
    "commentBody" TEXT,
    "commentPosted" BOOLEAN NOT NULL DEFAULT false,
    "testsRun" INTEGER NOT NULL DEFAULT 0,
    "regressions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PullRequestCheck_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PullRequestCheck" ("author", "branch", "createdAt", "filesChanged", "id", "organisationId", "prNumber", "regressions", "riskLevel", "status", "testsRun", "title") SELECT "author", "branch", "createdAt", "filesChanged", "id", "organisationId", "prNumber", "regressions", "riskLevel", "status", "testsRun", "title" FROM "PullRequestCheck";
DROP TABLE "PullRequestCheck";
ALTER TABLE "new_PullRequestCheck" RENAME TO "PullRequestCheck";
CREATE UNIQUE INDEX "PullRequestCheck_organisationId_prNumber_key" ON "PullRequestCheck"("organisationId", "prNumber");
CREATE TABLE "new_TestCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "labelsJson" TEXT NOT NULL DEFAULT '[]',
    "criticality" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "environment" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "platform" TEXT NOT NULL DEFAULT 'web',
    "stepsCount" INTEGER NOT NULL DEFAULT 1,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "assertionsJson" TEXT NOT NULL DEFAULT '[]',
    "variablesJson" TEXT NOT NULL DEFAULT '{}',
    "suiteId" TEXT,
    "folderId" TEXT,
    "dataProfileId" TEXT,
    "projectId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestCase_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestCase_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TestFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestCase_dataProfileId_fkey" FOREIGN KEY ("dataProfileId") REFERENCES "DataProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TestCase" ("createdAt", "criticality", "id", "lastRunAt", "module", "organisationId", "source", "status", "stepsCount", "title") SELECT "createdAt", "criticality", "id", "lastRunAt", "module", "organisationId", "source", "status", "stepsCount", "title" FROM "TestCase";
DROP TABLE "TestCase";
ALTER TABLE "new_TestCase" RENAME TO "TestCase";
CREATE INDEX "TestCase_organisationId_module_idx" ON "TestCase"("organisationId", "module");
CREATE TABLE "new_TestPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schedule" TEXT NOT NULL DEFAULT 'manual',
    "module" TEXT NOT NULL DEFAULT '',
    "environment" TEXT,
    "browsersJson" TEXT NOT NULL DEFAULT '["Chromium"]',
    "testCasesCount" INTEGER NOT NULL DEFAULT 0,
    "passRate" REAL NOT NULL DEFAULT 0,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "projectId" TEXT,
    CONSTRAINT "TestPlan_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TestPlan" ("createdAt", "description", "environment", "id", "lastRunAt", "module", "name", "organisationId", "passRate", "schedule", "testCasesCount") SELECT "createdAt", "description", "environment", "id", "lastRunAt", "module", "name", "organisationId", "passRate", "schedule", "testCasesCount" FROM "TestPlan";
DROP TABLE "TestPlan";
ALTER TABLE "new_TestPlan" RENAME TO "TestPlan";
CREATE INDEX "TestPlan_organisationId_idx" ON "TestPlan"("organisationId");
CREATE TABLE "new_TestRun" (
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
    "logsJson" TEXT NOT NULL DEFAULT '[]',
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "planId" TEXT,
    "projectId" TEXT,
    "passRate" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TestRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TestRun" ("anomaliesReproduced", "branch", "codeChanges", "costAvoided", "coverage", "createdAt", "durationMs", "id", "impactedTests", "organisationId", "prNumber", "qualityScore", "regressionsCaught", "release", "status", "testsAdded", "testsPassed", "testsTotal", "title", "version") SELECT "anomaliesReproduced", "branch", "codeChanges", "costAvoided", "coverage", "createdAt", "durationMs", "id", "impactedTests", "organisationId", "prNumber", "qualityScore", "regressionsCaught", "release", "status", "testsAdded", "testsPassed", "testsTotal", "title", "version" FROM "TestRun";
DROP TABLE "TestRun";
ALTER TABLE "new_TestRun" RENAME TO "TestRun";
CREATE INDEX "TestRun_organisationId_createdAt_idx" ON "TestRun"("organisationId", "createdAt");
CREATE TABLE "new_TestSuite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schedule" TEXT NOT NULL DEFAULT 'manual',
    "module" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT 'Web',
    "labelsJson" TEXT NOT NULL DEFAULT '[]',
    "prerequisitesJson" TEXT NOT NULL DEFAULT '[]',
    "testCasesCount" INTEGER NOT NULL DEFAULT 0,
    "passRate" REAL NOT NULL DEFAULT 0,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,
    CONSTRAINT "TestSuite_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestSuite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TestSuite" ("createdAt", "description", "id", "lastRunAt", "module", "name", "organisationId", "passRate", "schedule", "testCasesCount") SELECT "createdAt", "description", "id", "lastRunAt", "module", "name", "organisationId", "passRate", "schedule", "testCasesCount" FROM "TestSuite";
DROP TABLE "TestSuite";
ALTER TABLE "new_TestSuite" RENAME TO "TestSuite";
CREATE INDEX "TestSuite_organisationId_idx" ON "TestSuite"("organisationId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Admin',
    "avatarInitials" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "emailVerifiedAt" DATETIME,
    "verifyCodeHash" TEXT,
    "verifyExpiresAt" DATETIME,
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "creditQuota" INTEGER NOT NULL DEFAULT 0,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "organisationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarInitials", "createdAt", "email", "emailVerifiedAt", "id", "name", "organisationId", "passwordHash", "role", "status", "verifyAttempts", "verifyCodeHash", "verifyExpiresAt") SELECT "avatarInitials", "createdAt", "email", "emailVerifiedAt", "id", "name", "organisationId", "passwordHash", "role", "status", "verifyAttempts", "verifyCodeHash", "verifyExpiresAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_organisationId_idx" ON "User"("organisationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TunnelMachine_organisationId_idx" ON "TunnelMachine"("organisationId");

-- CreateIndex
CREATE INDEX "CreditEntry_organisationId_occurredAt_idx" ON "CreditEntry"("organisationId", "occurredAt");

-- CreateIndex
CREATE INDEX "TestCaseVersion_organisationId_idx" ON "TestCaseVersion"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseVersion_testCaseId_version_key" ON "TestCaseVersion"("testCaseId", "version");

-- CreateIndex
CREATE INDEX "TestCaseRun_organisationId_createdAt_idx" ON "TestCaseRun"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "TestCaseRun_testCaseId_idx" ON "TestCaseRun"("testCaseId");

-- CreateIndex
CREATE INDEX "MobileApp_organisationId_idx" ON "MobileApp"("organisationId");

-- CreateIndex
CREATE INDEX "MobileTest_organisationId_idx" ON "MobileTest"("organisationId");

-- CreateIndex
CREATE INDEX "ApiTest_organisationId_idx" ON "ApiTest"("organisationId");

-- CreateIndex
CREATE INDEX "ShipWorkflow_organisationId_idx" ON "ShipWorkflow"("organisationId");

-- CreateIndex
CREATE INDEX "PrAnalysis_organisationId_idx" ON "PrAnalysis"("organisationId");

-- CreateIndex
CREATE INDEX "AgentTest_organisationId_idx" ON "AgentTest"("organisationId");

-- CreateIndex
CREATE INDEX "GlobalVariable_organisationId_idx" ON "GlobalVariable"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalVariable_organisationId_name_key" ON "GlobalVariable"("organisationId", "name");

-- CreateIndex
CREATE INDEX "AuthProfile_organisationId_idx" ON "AuthProfile"("organisationId");

-- CreateIndex
CREATE INDEX "ProxyProfile_organisationId_idx" ON "ProxyProfile"("organisationId");

-- CreateIndex
CREATE INDEX "ViewportSetting_organisationId_idx" ON "ViewportSetting"("organisationId");

-- CreateIndex
CREATE INDEX "RemoteBrowserProfile_organisationId_idx" ON "RemoteBrowserProfile"("organisationId");

-- CreateIndex
CREATE INDEX "ContextSource_organisationId_idx" ON "ContextSource"("organisationId");

-- CreateIndex
CREATE INDEX "ContextGraphNode_organisationId_idx" ON "ContextGraphNode"("organisationId");

-- CreateIndex
CREATE INDEX "ContextGraphEdge_organisationId_idx" ON "ContextGraphEdge"("organisationId");

-- CreateIndex
CREATE INDEX "ApiTestChain_organisationId_idx" ON "ApiTestChain"("organisationId");

-- CreateIndex
CREATE INDEX "AgentTestSuite_organisationId_idx" ON "AgentTestSuite"("organisationId");

-- CreateIndex
CREATE INDEX "Project_organisationId_idx" ON "Project"("organisationId");

-- CreateIndex
CREATE INDEX "Schedule_organisationId_idx" ON "Schedule"("organisationId");

-- CreateIndex
CREATE INDEX "TestPlanExecution_organisationId_idx" ON "TestPlanExecution"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentVariable_environmentId_key_key" ON "EnvironmentVariable"("environmentId", "key");

-- CreateIndex
CREATE INDEX "DataProfile_organisationId_idx" ON "DataProfile"("organisationId");

-- CreateIndex
CREATE INDEX "VisualBaseline_organisationId_idx" ON "VisualBaseline"("organisationId");

-- CreateIndex
CREATE INDEX "Webhook_organisationId_idx" ON "Webhook"("organisationId");

-- CreateIndex
CREATE INDEX "NotificationRule_organisationId_idx" ON "NotificationRule"("organisationId");

-- CreateIndex
CREATE INDEX "TestComponent_organisationId_idx" ON "TestComponent"("organisationId");

-- CreateIndex
CREATE INDEX "TestFolder_organisationId_idx" ON "TestFolder"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TestFolder_organisationId_name_key" ON "TestFolder"("organisationId", "name");

-- CreateIndex
CREATE INDEX "ExploratorySession_organisationId_idx" ON "ExploratorySession"("organisationId");

-- CreateIndex
CREATE INDEX "Persona_organisationId_idx" ON "Persona"("organisationId");

-- CreateIndex
CREATE INDEX "RedTeamSuite_organisationId_idx" ON "RedTeamSuite"("organisationId");

-- CreateIndex
CREATE INDEX "PerformanceMetric_testRunId_idx" ON "PerformanceMetric"("testRunId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudy_slug_key" ON "CaseStudy"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_slug_key" ON "GlossaryTerm"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_certCode_key" ON "Certification"("certCode");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTestInbox_emailAddress_key" ON "EmailTestInbox"("emailAddress");

-- CreateIndex
CREATE INDEX "EmailOutbox_to_createdAt_idx" ON "EmailOutbox"("to", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamInvite_organisationId_email_idx" ON "TeamInvite"("organisationId", "email");

-- CreateIndex
CREATE INDEX "TeamInvite_token_idx" ON "TeamInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "_TestCaseToTestSuite_AB_unique" ON "_TestCaseToTestSuite"("A", "B");

-- CreateIndex
CREATE INDEX "_TestCaseToTestSuite_B_index" ON "_TestCaseToTestSuite"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TestCaseToTestPlan_AB_unique" ON "_TestCaseToTestPlan"("A", "B");

-- CreateIndex
CREATE INDEX "_TestCaseToTestPlan_B_index" ON "_TestCaseToTestPlan"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TestPlanToTestSuite_AB_unique" ON "_TestPlanToTestSuite"("A", "B");

-- CreateIndex
CREATE INDEX "_TestPlanToTestSuite_B_index" ON "_TestPlanToTestSuite"("B");
