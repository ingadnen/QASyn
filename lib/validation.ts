import { z } from "zod";
import { APP_DESCRIPTION_MAX } from "./constants";
import {
  APP_LOGIN_TYPES, AUTH_TYPES, CRITICALITIES, FOCUS_KEYS, KNOWLEDGE_TYPES, ONBOARDING_ROLES, PAIN_POINTS, PLANS,
  PROVIDERS, REACH_MODES, SCHEDULES, TEST_STATUSES, TESTING_MATURITY, UPLOAD_KINDS, USER_ROLES,
} from "./types";
import { isEmail, normalizeWebsite } from "./utils";

/** Normalised http(s) URL or a validation error. */
export const websiteField = (message: string) =>
  z
    .string()
    .max(300)
    .transform((value, ctx) => {
      const normalized = normalizeWebsite(value);
      if (!normalized) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
        return z.NEVER;
      }
      return normalized;
    });

const optionalWebsite = z
  .string()
  .max(300)
  .optional()
  .transform((value, ctx) => {
    // Omitted means "leave unchanged" for PATCH; an empty string clears it.
    if (value === undefined) return undefined;
    if (!value.trim()) return null;
    const normalized = normalizeWebsite(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid website, e.g. https://your-domain.com" });
      return z.NEVER;
    }
    return normalized;
  });

const emailField = z.string().trim().toLowerCase().refine(isEmail, "Enter a valid e-mail address.");

export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128)
  .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Use letters and at least one number.");

/** Only small PNG / JPEG / WebP data URLs are accepted (no SVG: avoids script payloads). */
export const logoField = z
  .string()
  .max(400_000, "Logo must be under 300 KB.")
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Upload a PNG, JPEG or WebP image.")
  .nullable()
  .optional();

// ---------- Auth ----------
export const signupSchema = z.object({ email: emailField, password: passwordField });
export const loginSchema = z.object({ email: emailField, password: z.string().min(1, "Enter your password.").max(128) });
export const verifySchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.") });
export const switchOrgSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("own") }),
  z.object({ target: z.literal("demo") }),
  z.object({ target: z.literal("org"), organisationId: z.string().min(1).max(60) }),
]);

// ---------- Organisation ----------
export const createOrganisationSchema = z.object({
  ownerName: z.string().trim().min(2, "Enter your name.").max(80),
  name: z.string().trim().min(2, "Enter an organisation name.").max(60),
  slug: z.string().trim().toLowerCase().max(40).optional(),
  website: optionalWebsite,
  addToKnowledgeBase: z.boolean().default(true),
  logoUrl: logoField,
});

export const updateOrganisationSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  website: optionalWebsite,
  logoUrl: logoField,
  addToKnowledgeBase: z.boolean().optional(),
  permissions: z.record(z.string().max(60), z.record(z.string().max(40), z.boolean())).optional(),
});

// ---------- Onboarding ----------
export const stepPayloadSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal(1),
    appDescription: z.string().trim().max(APP_DESCRIPTION_MAX, `Keep it under ${APP_DESCRIPTION_MAX} characters.`),
    reachMode: z.enum(REACH_MODES),
    environmentUrl: z.string().max(300).optional(),
    localPort: z.number().int().min(1).max(65535).optional(),
    appLoginType: z.enum(APP_LOGIN_TYPES),
    appLoginUsername: z.string().trim().max(200).optional(),
    appLoginPassword: z.string().max(200).optional(),
  }),
  z.object({
    step: z.literal(2),
    skip: z.boolean().optional(),
    painPoints: z.array(z.enum(PAIN_POINTS)).max(PAIN_POINTS.length).default([]),
    userRole: z.enum(ONBOARDING_ROLES).nullable().optional(),
    testingMaturity: z.enum(TESTING_MATURITY).nullable().optional(),
  }),
  z.object({ step: z.literal(3), skip: z.boolean().optional() }),
  z.object({ step: z.literal(4), skip: z.boolean().optional() }),
  z.object({ step: z.literal(5), skip: z.boolean().optional(), focusPriority: z.enum(FOCUS_KEYS).nullable().optional() }),
  z.object({
    step: z.literal(6),
    skip: z.boolean().optional(),
    invitedEmails: z.array(emailField).max(20, "Invite up to 20 teammates.").default([]),
  }),
  z.object({ step: z.literal(7) }),
]);
export type StepPayload = z.infer<typeof stepPayloadSchema>;

export const connectionCheckSchema = z.discriminatedUnion("reachMode", [
  z.object({ reachMode: z.literal("staging"), environmentUrl: z.string().max(300) }),
  z.object({ reachMode: z.literal("localhost"), localPort: z.number().int().min(1).max(65535) }),
]);

export const providerSchema = z.enum(PROVIDERS);
export const integrationBodySchema = z.object({
  detail: z
    .string()
    .trim()
    .max(100)
    .regex(/^[\w.\-/# ]*$/, "Use letters, numbers, '-', '_', '.', '/' or '#'.")
    .optional(),
});

// ---------- Dashboard ----------
const title = z.string().trim().min(3, "Title is too short.").max(160);
const moduleName = z.string().trim().min(2).max(40).regex(/^[\w &/-]+$/, "Use letters, numbers and spaces.");

export const createTestCaseSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("manual"),
    title,
    module: moduleName,
    criticality: z.enum(CRITICALITIES),
    stepsCount: z.number().int().min(1).max(50).default(3),
    /** Explicit Target URL entered in the creation modal (wins over the org website). */
    targetUrl: z.string().trim().max(300).optional(),
  }),
  z.object({
    mode: z.literal("ai"),
    module: moduleName,
    criticality: z.enum(CRITICALITIES).default("medium"),
    prompt: z.string().trim().max(200).default(""),
    count: z.number().int().min(1).max(4).default(3),
    /** Explicit Target URL entered in the creation modal (wins over the org website). */
    targetUrl: z.string().trim().max(300).optional(),
  }),
]);

export const updateTestCaseSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run") }),
  z.object({ action: z.literal("prerequisites"), testCaseIds: z.array(z.string().max(60)).max(50) }),
  z.object({ action: z.literal("variables"), variables: z.record(z.string().max(60), z.string().max(500)).default({}) }),
  z.object({ action: z.literal("set"), status: z.enum(TEST_STATUSES) }),
  z.object({
    action: z.literal("edit"),
    title: title.optional(),
    module: moduleName.optional(),
    criticality: z.enum(CRITICALITIES).optional(),
    description: z.string().max(4000).optional(),
    labels: z.array(z.string().trim().max(40)).max(20).optional(),
    environment: z.string().trim().max(80).optional(),
    version: z.string().trim().max(20).optional(),
    platform: z.enum(["web", "mobile", "api"]).optional(),
  }),
  z.object({
    action: z.literal("steps"),
    steps: z
      .array(
        z.object({
          id: z.string().max(40),
          action: z.enum(["Navigate", "Click", "Enter Text", "Verify Element", "API Call", "AI Assertion", "OCR/Document Validation", "KYC Check", "Salesforce Workflow Steps"]),
          target: z.string().trim().max(200),
          value: z.string().trim().max(500).default(""),
          selector: z.string().trim().max(200).default(""),
        }),
      )
      .max(50),
  }),
  z.object({ action: z.literal("run_steps"), autoFix: z.boolean().optional() }),
  z.object({ action: z.literal("clone"), title: title.optional(), folderId: z.string().max(60).nullable().optional() }),
  z.object({ action: z.literal("move"), folderId: z.string().max(60).nullable() }),
]);

export const runBatchSchema = z.object({
  module: z.string().max(40).optional(),
  testCaseIds: z.array(z.string().max(60)).max(100).optional(),
});

export const startCrawlSchema = z.object({
  targetUrl: z.string().max(300).optional(),
  platform: z.string().max(40).optional(),
  publishMode: z.string().max(40).optional(),
  testTypes: z.array(z.string().max(60)).max(20).optional(),
  prerequisites: z.array(z.string().max(60)).max(20).optional(),
  explorePrompt: z.string().max(2000).optional(),
  additionalContext: z.string().max(2000).optional(),
  requirementName: z.string().max(200).optional(),
  createSuite: z.boolean().optional(),
  createPlan: z.boolean().optional(),
});
export const crawlActionSchema = z.object({ action: z.enum(["complete", "cancel", "reimport"]) });
export const requirementActionSchema = z.object({
  action: z.enum(["generate", "reimport"]),
  count: z.number().int().min(1).max(10).optional(),
});
export const testFolderSchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#5b4ee8"),
});
export const collectionActionSchema = z.object({ action: z.literal("run") });

export const collectionUpdateSchema = z.object({
  action: z.literal("update"),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  module: z.string().max(80).optional(),
  platform: z.enum(["Web", "Mobile", "API"]).optional(),
  environment: z.string().max(60).optional(),
  labels: z.array(z.string().trim().max(40)).max(20).optional(),
  prerequisites: z.array(z.string().max(60)).max(50).optional(),
});
export const environmentUpdateSchema = z.object({ action: z.literal("default") });

const manualPrSchema = z.object({
  prNumber: z.number().int().min(1).max(999_999),
  title,
  branch: z.string().trim().min(1).max(100).regex(/^[\w./-]+$/, "Invalid branch name."),
  author: z.string().trim().min(1).max(60),
  filesChanged: z.number().int().min(1).max(5000),
  /** Optional provider URL; when present its provider/repository are persisted. */
  customUrl: z.string().trim().max(500).optional(),
});

export const createPrSchema = z.union([
  // PR selected from a connected provider/repository.
  z.object({
    mode: z.literal("catalog"),
    provider: z.string().trim().min(2).max(40),
    repository: z.string().trim().min(2).max(160),
    prNumber: z.number().int().min(1).max(999_999),
  }),
  // Manual / custom PR URL.
  z.object({
    mode: z.literal("custom"),
    url: z.string().trim().min(8).max(500),
  }),
  manualPrSchema,
]);

export const requirementSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(20).regex(/^[A-Z0-9-]+$/, "Use A-Z, 0-9 and '-'."),
  title,
  source: z.enum(["manual", "jira", "linear", "doc", "import"]).default("manual"),
});

export const importRequirementsSchema = z.object({ text: z.string().max(20_000) });
export const linkTestsSchema = z.object({ testCaseIds: z.array(z.string().max(40)).max(200) });

export const collectionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional(),
  schedule: z.enum(SCHEDULES).default("manual"),
  module: z.string().trim().max(80).default(""),
  environment: z.string().trim().max(60).optional(),
  platform: z.enum(["Web", "Mobile", "API"]).optional(),
  labels: z.array(z.string().trim().max(40)).max(20).optional(),
  prerequisites: z.array(z.string().max(60)).max(50).optional(),
  testCaseIds: z.array(z.string().max(60)).max(300).optional(),
  suiteIds: z.array(z.string().max(60)).max(100).optional(),
  browsers: z.array(z.string().max(40)).max(10).optional(),
  settings: z.record(z.string().max(80), z.unknown()).optional(),
});

export const environmentSchema = z.object({
  name: z.string().trim().min(2).max(40),
  baseUrl: websiteField("Enter a valid base URL."),
  authType: z.enum(AUTH_TYPES).default("none"),
  variables: z
    .record(z.string().regex(/^[A-Z_][A-Z0-9_]{0,40}$/, "Variable names use A-Z, 0-9 and _."), z.string().max(500))
    .default({}),
  isDefault: z.boolean().default(false),
});

export const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(160).regex(/^[^\\/:*?"<>|]+$/, "Invalid file name."),
  sizeBytes: z.number().int().min(0).max(2_000_000_000),
  kind: z.enum(UPLOAD_KINDS).optional(),
});

export const knowledgeSchema = z.object({
  title: z.string().trim().min(2).max(120),
  type: z.enum(KNOWLEDGE_TYPES),
  urlOrPath: z.string().trim().min(1).max(300),
});

export const inviteSchema = z.object({
  email: emailField,
  role: z.enum(USER_ROLES).default("Engineer"),
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  roles: z.array(z.enum(USER_ROLES)).min(1).max(6).optional(),
});
export const updateMemberSchema = z.object({ role: z.enum(USER_ROLES) });

export const tunnelActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("connect"),
    name: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]{0,20}$/, "Invalid machine name."),
    token: z.string().trim().min(8).max(120),
    os: z.string().trim().max(20).optional(),
    hostname: z.string().trim().max(120).optional(),
  }),
  z.object({
    action: z.enum(["rotate", "enroll", "disconnect"]),
    localPort: z.number().int().min(1).max(65535).optional(),
  }),
]);

export const billingSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan"), plan: z.enum(PLANS) }),
  z.object({
    action: z.literal("payment"),
    cardholder: z.string().trim().min(2).max(80),
    /** Only the last 4 digits are kept; the full number never reaches the database. */
    cardNumber: z.string().regex(/^[\d ]{12,23}$/, "Enter a test card number."),
  }),
]);

export const apiTokenSchema = z.object({
  name: z.string().trim().min(2).max(255),
  scopes: z.array(z.string().trim().min(1).max(40)).min(1, "Pick at least one scope.").max(20),
  /** null = never expires */
  expiresInDays: z.number().int().min(1).max(180).nullable().default(30),
  ipAllowlist: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

export const organizationPreferencesSchema = z.object({
  defaultBrowser: z.enum(["Chromium", "Chrome", "Firefox", "Safari", "Edge"]),
  testcaseTimeout: z.number().int().min(1).max(1440),
  crawlTimeout: z.number().int().min(1).max(1440),
  retryFailedSteps: z.number().int().min(0).max(10),
  waitTimeoutLocators: z.number().int().min(1).max(300),
  autoWaitDuration: z.number().int().min(0).max(600),
  captureStepScreenshots: z.boolean(),
  videoRecording: z.boolean(),
  autonomousCrawl: z.boolean(),
  autoApproveAutoHeal: z.boolean(),
  organizeByModule: z.boolean(),
  showScrollbars: z.boolean(),
  clickPressHold: z.boolean(),
  viewport: z.enum(["desktop", "laptop", "tablet", "mobile"]),
  resolution: z.string().max(60),
  autoFix: z.boolean(),
  autoFixRerunCount: z.number().int().min(0).max(10),
  timeZone: z.string().max(80),
  defaultAiAction: z.enum(["Only action", "Create step", "Create dynamic step", "Create Partial steps"]),
  aiSmartness: z.enum(["Expert (Recommended)", "Fast", "Strict"]),
  knowledgeBaseId: z.string().max(60),
  useAiMetadata: z.boolean(),
  mockApi: z.boolean(),
  weeklyReportRecipients: z.array(z.string().max(120)).max(50),
});

export const analysisCodeSettingsSchema = z.object({
  baseBranches: z.string().max(300),
  maxFiles: z.number().int().min(1).max(5000),
  pathScope: z.string().max(4000),
  runMode: z.enum(["never", "after_merge", "before_merge"]),
  environmentId: z.string().max(60),
  postPrComment: z.boolean(),
  postStatusCheck: z.boolean(),
  suppressPaths: z.string().max(4000),
});

export const bugReproductionSettingsSchema = z.object({
  environmentId: z.string().max(60),
  dataProfileId: z.string().max(60),
  triggerMode: z.enum(["label", "every"]),
  triggerLabels: z.array(z.string().max(80)).max(30),
  triggerOnCreated: z.boolean(),
  triggerOnLabeled: z.boolean(),
  triggerOnEdited: z.boolean(),
  triggerOnComment: z.boolean(),
  maxPerTicket: z.number().int().min(1).max(100).nullable(),
  maxPerDay: z.number().int().min(1).max(1000).nullable(),
  revalidate: z.boolean(),
});

export const analysisSettingsSchema = z.object({
  severityThreshold: z.enum(CRITICALITIES),
  blockOnRegression: z.boolean(),
  autoHealing: z.boolean(),
  minCoverage: z.number().int().min(0).max(100),
  prComment: z.boolean(),
});

export const bugReproSettingsSchema = z.object({
  autoReproduce: z.boolean(),
  sources: z.array(z.enum(["jira", "linear", "slack"])).max(3),
  captureVideo: z.boolean(),
  captureNetwork: z.boolean(),
  captureConsole: z.boolean(),
  maxAttempts: z.number().int().min(1).max(10),
});

export const dismissSchema = z.object({ card: z.enum(["slack", "bugTracker", "invite", "crawl"]), slackChannel: z.boolean().optional() });

export const mcpTestSchema = z.object({
  tool: z.enum(["list_test_cases", "get_quality_summary", "list_bugs", "list_pull_requests"]),
});

// ---------- Web / Mobile / API / Ship engines ----------
export const testPlanRunSchema = z.object({ planId: z.string().min(1, "planId required.").max(60) });

export const mobileUploadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  platform: z.enum(["iOS", "Android"]),
  version: z.string().trim().min(1).max(40),
  fileName: z.string().trim().min(1).max(160).regex(/^[^\\/:*?"<>|]+$/, "Invalid file name."),
  sizeBytes: z.number().int().min(0).max(2_000_000_000).default(0),
});

export const gestureSchema = z.object({
  id: z.string().max(40),
  gesture: z.enum(["Tap", "Swipe", "Scroll", "Enter Text", "Pinch", "Rotate", "Biometric"]),
  target: z.string().trim().max(200),
  value: z.string().trim().max(500).default(""),
});

export const mobileTestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  appId: z.string().max(60).optional(),
  device: z.string().trim().min(2).max(80),
  gestures: z.array(gestureSchema).max(50).default([]),
});

export const mobileRunSchema = z.object({ testId: z.string().min(1).max(60) });

export const apiAssertionSchema = z.object({
  kind: z.enum(["status", "schema", "value"]),
  path: z.string().trim().max(200),
  expected: z.string().trim().max(500),
});
export const apiExtractionSchema = z.object({
  variable: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,40}$/, "Invalid variable name."),
  path: z.string().trim().max(200),
});
export const apiRequestStepSchema = z.object({
  id: z.string().max(40),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  url: z.string().trim().min(1).max(2000),
  headers: z.record(z.string().max(100), z.string().max(1000)).default({}),
  body: z.string().max(5000).default(""),
  assertions: z.array(apiAssertionSchema).max(20).default([]),
  extractionRules: z.array(apiExtractionSchema).max(10).default([]),
});
export const apiTestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  requests: z.array(apiRequestStepSchema).max(20).default([]),
});
export const apiExecuteSchema = z.object({ testId: z.string().min(1).max(60) });

export const prImpactSchema = z.object({
  prNumber: z.number().int().min(1).max(999_999),
  branch: z.string().trim().min(1).max(100),
  title: z.string().trim().min(3).max(160),
  files: z.array(z.string().trim().min(1).max(300)).max(500).default([]),
});
export const bugReproSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(5000),
});
