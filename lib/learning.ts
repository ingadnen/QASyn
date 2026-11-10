/**
 * Learning catalog â€” structure extracted from https://learning.contextqa.com/
 * (QASyn Documentation / Learning Hub, GitBook): sections, roles and workflows.
 * Each module maps to an in-app destination so it can be launched directly.
 */
export interface LearningModule {
  id: string;
  title: string;
  section: string;
  kind: "guide" | "tutorial" | "video" | "demo";
  minutes: number;
  description: string;
  /** In-app destination launched from the workspace. */
  href: string;
  cta: string;
}

export interface LearningSection {
  name: string;
  modules: LearningModule[];
}

const m = (
  id: string,
  title: string,
  section: string,
  kind: LearningModule["kind"],
  minutes: number,
  description: string,
  href: string,
  cta: string,
): LearningModule => ({ id, title, section, kind, minutes, description, href, cta });

export const LEARNING_SECTIONS: LearningSection[] = [
  {
    name: "Getting Started",
    modules: [
      m("gs-intro", "Introduction to QASyn", "Getting Started", "guide", 8, "What QASyn does: AI-powered test automation, crawl, PR checks and evidence.", "/dashboard/overview", "Open overview"),
      m("gs-quickstart", "Quickstart Guide", "Getting Started", "tutorial", 15, "Create your workspace, connect an environment and run your first crawl.", "/dashboard/crawl", "Start a crawl"),
      m("gs-video", "Video Walkthroughs", "Getting Started", "video", 20, "Watch the full product tour: test cases, execution, reporting and Ship.", "/learning", "Watch"),
      m("gs-demo", "Interactive Demo", "Getting Started", "demo", 10, "Hands-on interactive demo of crawl, generation and execution.", "/dashboard/test-cases", "Open test cases"),
      m("gs-cicd", "Tutorial: Prepare a CI/CD quality gate", "Getting Started", "tutorial", 12, "Wire PR checks into CI with API tokens and baseline gates.", "/dashboard/pull-requests", "Check a PR"),
    ],
  },
  {
    name: "Web Testing",
    modules: [
      m("web-create", "Creating Test Cases (No-Code / NLP)", "Web Testing", "tutorial", 18, "Describe steps in natural language: Navigate, Click, Enter Text, Verify Element.", "/dashboard/test-cases", "Create a test case"),
      m("web-steps", "Test Steps Editor", "Web Testing", "guide", 14, "Visual step editor with selector inspector and AI auto-healing.", "/dashboard/test-cases", "Open Studio"),
      m("web-suites", "Managing Test Suites & Test Plans", "Web Testing", "guide", 12, "Group cases into suites and schedule plans per environment.", "/dashboard/plans/suites", "Open suites"),
      m("web-healing", "AI Self-Healing Tests", "Web Testing", "demo", 10, "When a selector changes, AI finds the new target and heals the step live.", "/dashboard/test-cases", "Try auto-healing"),
      m("web-data", "Tutorial: Data-Driven Testing", "Web Testing", "tutorial", 16, "Parameterise steps with environment variables and test data sets.", "/dashboard/environments", "Open environments"),
      m("web-req", "Requirements Management", "Web Testing", "guide", 10, "Link requirements to test cases and measure coverage.", "/dashboard/requirements", "Open requirements"),
    ],
  },
  {
    name: "Mobile Testing",
    modules: [
      m("mob-upload", "Uploading Apps (APK & IPA)", "Mobile Testing", "guide", 8, "Register mobile builds and evidence videos as uploads.", "/dashboard/uploads", "Open uploads"),
      m("mob-create", "Creating Mobile Tests", "Mobile Testing", "tutorial", 15, "Generate mobile flows from a crawl of the app package.", "/dashboard/crawl", "Start a crawl"),
    ],
  },
  {
    name: "API Testing",
    modules: [
      m("api-create", "Creating API Tests", "API Testing", "tutorial", 14, "API Call steps with response validation and chaining.", "/dashboard/test-cases", "Open Studio"),
      m("api-validate", "Validating Responses & API Chaining", "API Testing", "guide", 12, "Assert status, JSON paths and pass values between calls.", "/dashboard/knowledge-base", "Open knowledge base"),
    ],
  },
  {
    name: "Execution",
    modules: [
      m("exec-run", "Running Tests", "Execution", "tutorial", 10, "Run a single case step-by-step or a whole suite in one click.", "/dashboard/test-cases", "Run a test"),
      m("exec-cross", "Running Tests Across Multiple Browsers", "Execution", "guide", 12, "Cross-browser and parallel execution from environments.", "/dashboard/environments", "Open environments"),
      m("exec-schedule", "Scheduling & Regression Suite", "Execution", "tutorial", 14, "Tutorial: build and schedule a regression suite.", "/dashboard/plans/test-plans", "Open test plans"),
      m("exec-video", "Video & Screenshots", "Execution", "guide", 8, "Every run captures video, screenshots and network traces.", "/dashboard/settings/bug-reproduction", "Open settings"),
    ],
  },
  {
    name: "Reporting",
    modules: [
      m("rep-results", "Test Results & Analytics Dashboard", "Reporting", "guide", 10, "Quality score, coverage, regressions and cost avoided per release.", "/dashboard/overview", "Open overview"),
      m("rep-flaky", "Find and Fix Flaky Tests in CI", "Reporting", "tutorial", 12, "Flaky detection from execution history and failure analysis.", "/dashboard/settings/analysis", "Open analysis"),
    ],
  },
  {
    name: "AI Features",
    modules: [
      m("ai-gen", "AI Test Generation", "AI Features", "demo", 12, "Generate test cases from a prompt, a crawl or requirements.", "/dashboard/test-cases?new=1", "Generate with AI"),
      m("ai-pr", "PR Impact Analysis", "AI Features", "demo", 10, "Risk-level diff analysis with baseline comparison on every PR.", "/dashboard/pull-requests", "Analyze a PR"),
      m("ai-kb", "Knowledge Base", "AI Features", "guide", 10, "Index website, docs and OpenAPI specs for the AQE engine.", "/dashboard/knowledge-base", "Open knowledge base"),
      m("ai-agent", "Autonomous Agent Pipeline", "AI Features", "guide", 15, "Crawl â†’ generate â†’ execute â†’ report, without human steps.", "/dashboard/crawl", "Start a crawl"),
    ],
  },
  {
    name: "Integrations & MCP",
    modules: [
      m("int-jira", "Jira & Linear", "Integrations & MCP", "guide", 8, "Connect issue trackers for automatic bug reproduction.", "/dashboard/integrations", "Open integrations"),
      m("mcp-server", "MCP Server", "Integrations & MCP", "tutorial", 10, "Query your workspace from Claude, Cursor or Codex via MCP tools.", "/dashboard/mcp", "Open MCP"),
      m("mcp-tokens", "API Tokens", "Integrations & MCP", "guide", 6, "Create cqa_ tokens for CI and MCP clients.", "/dashboard/settings/api-tokens", "Create a token"),
    ],
  },
  {
    name: "Ship by QASyn",
    modules: [
      m("ship-setup", "Set up a Ship Workspace", "Ship by QASyn", "tutorial", 12, "Connect a repository, pick a baseline and enable PR impact analysis.", "/dashboard/integrations", "Open integrations"),
      m("ship-dashboard", "Read the Ship Dashboard and Evidence", "Ship by QASyn", "guide", 10, "Quality score, coverage, regressions and cost avoided per release.", "/dashboard/overview", "Open overview"),
      m("ship-workflows", "Run Ship Workflows", "Ship by QASyn", "tutorial", 14, "Autonomous pipeline: crawl, generate, execute, report â€” no human steps.", "/dashboard/crawl", "Start a crawl"),
      m("ship-integrations", "Connect Ship Integrations and MCP", "Ship by QASyn", "guide", 10, "GitHub, GitLab, Jira, Linear, Slack and the MCP server.", "/dashboard/mcp", "Open MCP"),
      m("ship-security", "Operate Ship Safely", "Ship by QASyn", "guide", 8, "Audit logs, API tokens, roles and usage controls.", "/dashboard/settings/audits", "Open audits"),
    ],
  },
  {
    name: "Administration",
    modules: [
      m("adm-team", "Team & Access", "Administration", "guide", 6, "Invite teammates and assign roles per organisation.", "/dashboard/team", "Open team"),
      m("adm-audits", "System Audits", "Administration", "guide", 6, "Full audit log of every member action.", "/dashboard/settings/audits", "Open audits"),
      m("adm-billing", "Billing & Usage", "Administration", "guide", 6, "Trial credits, plans and payment methods.", "/dashboard/billing", "Open billing"),
    ],
  },
  {
    name: "Reference & Planning",
    modules: [
      m("ref-roles", "Browse by Role", "Reference & Planning", "guide", 8, "Learning paths for Engineers, QA, Eng managers and Founders.", "/dashboard/learning", "Open learning"),
      m("ref-business", "Business Use Cases", "Reference & Planning", "guide", 12, "Requirements to release, regression risk, specialized quality gates.", "/dashboard/requirements", "Open requirements"),
      m("ref-migrate", "Migrate from Playwright / Selenium / Tosca", "Reference & Planning", "tutorial", 16, "MCP-assisted migration of existing suites to QASyn.", "/dashboard/knowledge-base", "Open knowledge base"),
    ],
  },
];

export const LEARNING_MODULES: LearningModule[] = LEARNING_SECTIONS.flatMap((s) => s.modules);

export function learningStats(progress: Record<string, { status: string }>) {
  const total = LEARNING_MODULES.length;
  const done = LEARNING_MODULES.filter((mod) => progress[mod.id]?.status === "completed").length;
  const inProgress = LEARNING_MODULES.filter((mod) => progress[mod.id]?.status === "in_progress").length;
  return { total, done, inProgress, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Per-section completion for progress bars. */
export function sectionStats(progress: Record<string, { status: string }>, section: LearningSection) {
  const total = section.modules.length;
  const done = section.modules.filter((mod) => progress[mod.id]?.status === "completed").length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
