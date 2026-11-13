/**
 * Agent Skills Library — six QA engineering skills inspired by
 * addyosmani/agent-skills. They are plain Markdown instructions that can be
 * enabled per organisation and exported to Claude Code, GitHub Copilot and
 * OpenCode without any runtime dependency.
 */

export interface AgentSkill {
  id: string;
  name: string;
  title: string;
  description: string;
  category: "Testing" | "Review" | "Accessibility" | "Security" | "Reliability";
  icon: string;
  triggers: string[];
  tools: string[];
  body: string;
}

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: "playwright-self-healing",
    name: "playwright-self-healing",
    title: "Playwright Self-Healing",
    description: "Repairs broken locators with accessible, resilient selectors and re-runs the failed step.",
    category: "Testing",
    icon: "auto_fix_high",
    triggers: ["selector changed", "element not found", "auto-heal", "flaky locator"],
    tools: ["qasyn_run_test_case", "qasyn_get_execution_evidence", "qasyn_context7_resolve"],
    body: `## playwright-self-healing
When a Playwright step fails because a locator no longer matches:
1. Fetch the execution evidence and the failing step selector.
2. Resolve QASyn Framework Intelligence Playwright rules before proposing a replacement.
3. Rank replacements: getByRole > getByLabel > getByTestId > getByText > CSS.
4. Never use nth-child, generated utility classes or absolute XPath.
5. Apply the best locator, re-run only the failed step, and keep the old selector as fallback.
6. Report the before/after selector and the confidence score.`,
  },
  {
    id: "pr-blast-radius-gate",
    name: "pr-blast-radius-gate",
    title: "PR Blast Radius Gate",
    description: "Maps changed files to impacted tests and blocks merges when critical coverage is at risk.",
    category: "Review",
    icon: "merge",
    triggers: ["pull request", "PR review", "impact analysis", "merge gate"],
    tools: ["qasyn_analyze_pr", "qasyn_list_test_cases", "qasyn_run_test_plan"],
    body: `## pr-blast-radius-gate
For every pull request:
1. Collect changed files, owned modules and touched routes.
2. Map modules to test cases; mark critical/high tests as mandatory.
3. Compute blast radius: low (<8 files), medium (8-24), high (25+).
4. Run impacted tests. A critical failure means No-Go.
5. Post a verdict with evidence: files, tests run, regressions, uncovered paths.
6. Never approve solely from a green build when impacted critical tests were skipped.`,
  },
  {
    id: "tdd-spec-generator",
    name: "tdd-spec-generator",
    title: "TDD Spec Generator",
    description: "Turns a requirement into executable Given/When/Then specs before implementation.",
    category: "Testing",
    icon: "fact_check",
    triggers: ["new requirement", "acceptance criteria", "spec", "TDD", "test first"],
    tools: ["qasyn_create_web_test", "qasyn_list_test_cases"],
    body: `## tdd-spec-generator
1. Read the requirement and extract actors, preconditions, actions and outcomes.
2. Write Given/When/Then scenarios for happy path, negative path, boundary and permission cases.
3. Give every scenario a stable title and trace it to the requirement id.
4. Create the test cases before implementation, with concrete data and observable assertions.
5. Reject vague assertions ("page works"); assert URL, role, text, state or persisted data.`,
  },
  {
    id: "wcag-a11y-auditor",
    name: "wcag-a11y-auditor",
    title: "WCAG Accessibility Auditor",
    description: "Audits pages against WCAG 2.2 AA and opens actionable defects.",
    category: "Accessibility",
    icon: "accessibility_new",
    triggers: ["accessibility", "a11y", "WCAG", "screen reader", "contrast"],
    tools: ["qasyn_start_crawl", "qasyn_create_web_test", "qasyn_list_bugs"],
    body: `## wcag-a11y-auditor
Audit every critical flow against WCAG 2.2 AA:
- Keyboard-only navigation reaches every control in a logical order.
- Every interactive element has an accessible name and visible focus.
- Text and UI contrast meet 4.5:1 / 3:1.
- Images have meaningful alt text; decorative images are hidden.
- Forms expose labels, errors and instructions programmatically.
- No keyboard traps; skip links work; headings are hierarchical.
File one defect per violation with selector, screenshot and remediation.`,
  },
  {
    id: "flaky-test-doctor",
    name: "flaky-test-doctor",
    title: "Flaky Test Doctor",
    description: "Diagnoses non-deterministic tests and prescribes a root-cause fix, not retries.",
    category: "Reliability",
    icon: "healing",
    triggers: ["flaky", "intermittent", "race condition", "retry", "non-deterministic"],
    tools: ["qasyn_get_execution_evidence", "qasyn_run_test_case", "qasyn_context7_resolve"],
    body: `## flaky-test-doctor
1. Compare at least three runs: failures, durations, console and network logs.
2. Classify: timing, shared state, test order, data collision, animation, third-party dependency.
3. Replace sleeps with web-first assertions and deterministic waits.
4. Isolate data per test; reset auth/storage; avoid shared accounts.
5. Fix the root cause; do not mask flakiness with retries.
6. Add a regression guard and document the diagnosis.`,
  },
  {
    id: "security-owasp-gate",
    name: "security-owasp-gate",
    title: "Security OWASP Gate",
    description: "Runs a defensive OWASP-focused review and blocks release on high-risk findings.",
    category: "Security",
    icon: "shield",
    triggers: ["security", "OWASP", "CSP", "HSTS", "cookies", "headers"],
    tools: ["qasyn_start_crawl", "qasyn_list_bugs", "qasyn_analyze_pr"],
    body: `## security-owasp-gate
Inspect passively and defensively:
- Security headers: CSP, HSTS, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- Cookies: Secure, HttpOnly, SameSite; no secrets in URLs or localStorage.
- Exposure: verbose errors, debug endpoints, source maps, directory listing.
- OWASP Top 10 mapping and CVSS-style severity for every finding.
- Never exploit a target; no destructive payloads. Report remediation with owner and priority.
- High or critical unresolved finding means No-Go.`,
  },
];

export const DEFAULT_ENABLED_SKILLS = ["playwright-self-healing", "pr-blast-radius-gate", "tdd-spec-generator"];

/** Converts a Super Admin platform skill or workspace custom skill to the AgentSkill shape. */
export function dynamicAgentSkill(input: {
  id: string;
  name: string;
  trigger?: string;
  systemPrompt: string;
  model?: string;
  source: "platform" | "custom";
}): AgentSkill {
  const trigger = String(input.trigger ?? "").trim();
  return {
    id: `${input.source}-${input.id}`,
    name: input.name,
    title: input.name,
    description: trigger || `${input.source === "platform" ? "Platform" : "Workspace"} agent skill published in QASyn.`,
    category: "Testing",
    icon: "auto_awesome",
    triggers: trigger ? [trigger] : [],
    tools: input.model ? [input.model] : ["QASyn Vision AI"],
    body: `## ${input.name}\n${input.systemPrompt}`,
  };
}

export function normalizeEnabledSkills(value: unknown, knownIds?: Iterable<string>): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_ENABLED_SKILLS];
  const known = new Set(knownIds ?? AGENT_SKILLS.map((skill) => skill.id));
  return value.filter((entry): entry is string => typeof entry === "string" && known.has(entry));
}

export function enabledSkillObjects(ids: string[], extra: AgentSkill[] = []): AgentSkill[] {
  const catalogue = [...AGENT_SKILLS, ...extra];
  return catalogue.filter((skill) => ids.includes(skill.id));
}

function header(target: "claude" | "copilot"): string {
  return target === "claude"
    ? "# QASyn Agent Skills\n\nGenerated by the QASyn Agent Skills Library. Enable/disable skills in Dashboard → MCP or Dashboard → Context.\n"
    : "# QASyn agent instructions\n\nGenerated by the QASyn Agent Skills Library. Apply these rules to every QA, review and security task in this repository.\n";
}

export function buildClaudeInstructions(ids: string[], extra: AgentSkill[] = []): string {
  const skills = enabledSkillObjects(ids, extra);
  return `${header("claude")}\n${skills.map((skill) => `# ${skill.title}\n\n${skill.body}\n`).join("\n")}`;
}

export function buildCopilotInstructions(ids: string[], extra: AgentSkill[] = []): string {
  const skills = enabledSkillObjects(ids, extra);
  return `${header("copilot")}\n${skills.map((skill) => `## ${skill.title}\n\n${skill.body}\n`).join("\n")}`;
}

/** Valid opencode.json with the local QASyn MCP server and the enabled skills. */
export function buildOpenCodeConfig(ids: string[], extra: AgentSkill[] = []): string {
  const skills = enabledSkillObjects(ids, extra);
  return JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      model: "opencode/big-pickle",
      mcp: {
        qasyn: {
          type: "remote",
          url: "http://localhost:3000/api/mcp/sse",
          enabled: true,
        },
      },
      instructions: [".claude/CLAUDE.md", ".github/copilot-instructions.md"],
      agent: {
        "qasyn-qa": {
          description: "QA engineer using QASyn MCP tools and the enabled Agent Skills.",
          mode: "primary",
          prompt: skills.map((skill) => `# ${skill.title}\n${skill.body}`).join("\n\n") || "Use QASyn MCP tools to test this workspace.",
        },
      },
    },
    null,
    2,
  );
}
