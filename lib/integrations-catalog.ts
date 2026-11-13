import type { Provider } from "./types";

export const INTEGRATION_CATEGORIES = [
  "Source control",
  "Issue tracking",
  "Project management",
  "CI/CD & infra",
  "Notifications",
  "AI assistants",
  "AI & Verification",
  "Customer support",
] as const;

export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export interface CatalogItem {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** Monogramme affiché dans la tuile (pas de logo de marque) */
  mono: string;
  tile: string;
  /** Provider connectable pendant l'onboarding (table Integration) */
  provider?: Provider;
  /** Étape d'onboarding où il se connecte */
  step?: 3 | 4;
}

export const INTEGRATION_CATALOG: CatalogItem[] = [
  { id: "github", name: "GitHub", category: "Source control", mono: "GH", tile: "bg-slate-900 text-white", provider: "GITHUB", step: 3, description: "Index repositories, analyse pull requests and post quality checks." },
  { id: "gitlab", name: "GitLab", category: "Source control", mono: "GL", tile: "bg-orange-500 text-white", provider: "GITLAB", step: 3, description: "Merge request impact analysis and pipeline status." },
  { id: "bitbucket", name: "Bitbucket", category: "Source control", mono: "BB", tile: "bg-blue-600 text-white", description: "Pull request insights for Bitbucket Cloud workspaces." },
  { id: "azure-repos", name: "Azure Repos", category: "Source control", mono: "AR", tile: "bg-sky-600 text-white", description: "Git repositories hosted in Azure DevOps." },
  { id: "jira", name: "Jira", category: "Issue tracking", mono: "JI", tile: "bg-blue-500 text-white", provider: "JIRA", step: 4, description: "Reproduce bugs from tickets and attach root cause and trace." },
  { id: "linear", name: "Linear", category: "Issue tracking", mono: "LN", tile: "bg-indigo-500 text-white", provider: "LINEAR", step: 4, description: "Sync issues and close the loop with regression tests." },
  { id: "azure-boards", name: "Azure Boards", category: "Issue tracking", mono: "AB", tile: "bg-sky-700 text-white", description: "Work items linked to test evidence." },
  { id: "youtrack", name: "YouTrack", category: "Issue tracking", mono: "YT", tile: "bg-fuchsia-600 text-white", description: "Issue sync with reproduction steps." },
  { id: "bugzilla", name: "Bugzilla", category: "Issue tracking", mono: "BZ", tile: "bg-red-700 text-white", description: "Classic bug tracker import." },
  { id: "trello", name: "Trello", category: "Project management", mono: "TR", tile: "bg-sky-500 text-white", description: "Turn cards into acceptance tests." },
  { id: "clickup", name: "ClickUp", category: "Project management", mono: "CU", tile: "bg-violet-500 text-white", description: "Tasks and docs as test requirements." },
  { id: "asana", name: "Asana", category: "Project management", mono: "AS", tile: "bg-rose-500 text-white", description: "Project milestones linked to release quality." },
  { id: "jenkins", name: "Jenkins", category: "CI/CD & infra", mono: "JK", tile: "bg-red-600 text-white", description: "Trigger QASyn from any pipeline stage." },
  { id: "github-actions", name: "GitHub Actions", category: "CI/CD & infra", mono: "GA", tile: "bg-slate-700 text-white", description: "Quality gate step for workflows." },
  { id: "circleci", name: "CircleCI", category: "CI/CD & infra", mono: "CI", tile: "bg-neutral-800 text-white", description: "Orb to run impacted tests on every build." },
  { id: "docker", name: "Docker", category: "CI/CD & infra", mono: "DK", tile: "bg-blue-500 text-white", description: "Spin up ephemeral environments for test runs." },
  { id: "aws", name: "AWS", category: "CI/CD & infra", mono: "AW", tile: "bg-amber-500 text-slate-900", description: "Deploy hooks from CodePipeline and Lambda." },
  { id: "selenium", name: "Selenium Grid", category: "CI/CD & infra", mono: "SE", tile: "bg-emerald-600 text-white", description: "Run generated tests on your own grid." },
  { id: "slack", name: "Slack", category: "Notifications", mono: "SL", tile: "bg-purple-700 text-white", provider: "SLACK", step: 4, description: "Release reports and regression alerts in channels." },
  { id: "teams", name: "Microsoft Teams", category: "Notifications", mono: "MT", tile: "bg-indigo-600 text-white", description: "Quality alerts for Teams channels." },
  { id: "chatgpt", name: "ChatGPT", category: "AI assistants", mono: "GP", tile: "bg-emerald-700 text-white", description: "Ask about release quality from your assistant." },
  { id: "claude", name: "Claude", category: "AI assistants", mono: "CL", tile: "bg-orange-700 text-white", description: "MCP server exposing runs, logs and reports." },
  { id: "cursor", name: "Cursor", category: "AI assistants", mono: "CR", tile: "bg-neutral-900 text-white", description: "Generate tests from inside the editor." },
  { id: "bivia", name: "QASyn Vision AI", category: "AI & Verification", mono: "B8", tile: "bg-[#111827] text-white", provider: "BIVIA", step: 3, description: "Calibrated multimodal AI for visual verification, smart locator healing and PR impact." },
  { id: "zendesk", name: "Zendesk", category: "Customer support", mono: "ZD", tile: "bg-teal-700 text-white", description: "Turn support tickets into reproductions." },
  { id: "intercom", name: "Intercom", category: "Customer support", mono: "IC", tile: "bg-blue-700 text-white", description: "Escalate customer-reported bugs automatically." },
];
