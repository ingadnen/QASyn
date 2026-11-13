/**
 * Context7 Live Docs resolver.
 *
 * Mirrors the upstash/context7 workflow: resolve a natural-language QA task to
 * a versioned library, return the current rules that matter for test
 * generation/healing, and inject them into an agent prompt. The catalogue is
 * local and deterministic so generation never depends on an external outage.
 */

export interface Context7Library {
  id: string;
  name: string;
  version: string;
  docsUrl: string;
  keywords: string[];
  rules: string[];
  snippet: string;
}

export interface Context7Resolution {
  resolved: boolean;
  score: number;
  library: Context7Library;
  query: string;
  rules: string[];
  injectedPrompt: string;
  source: string;
}

export const CONTEXT7_LIBRARIES: Context7Library[] = [
  {
    id: "playwright",
    name: "Playwright",
    version: "1.65",
    docsUrl: "https://playwright.dev/docs/intro",
    keywords: ["playwright", "browser", "selector", "locator", "click", "navigate", "test", "e2e", "page"],
    rules: [
      "Use user-facing locators first: getByRole, getByLabel, getByPlaceholder, getByText; use getByTestId only when there is no accessible name.",
      "Never use nth-child or long CSS chains as the primary locator.",
      "Use expect(locator).toBeVisible() with auto-waiting instead of fixed sleeps; set explicit timeouts only for known slow transitions.",
      "Prefer web-first assertions and avoid waitForTimeout in committed tests.",
      "Isolate state per test (storageState, fixtures) and capture trace/screenshot/video on failure.",
    ],
    snippet: "page.getByRole('button', { name: /sign in/i }); await expect(page.getByRole('heading')).toBeVisible();",
  },
  {
    id: "nextjs",
    name: "Next.js",
    version: "15.5",
    docsUrl: "https://nextjs.org/docs",
    keywords: ["next", "nextjs", "app router", "server component", "route handler", "hydration", "server action"],
    rules: [
      "Wait for hydration/network idle before asserting interactive state in App Router pages.",
      "Server Components cannot use browser APIs; exercise them through user-visible UI or Route Handlers.",
      "Use data-testid sparingly; prefer semantic roles rendered by Server Components.",
      "Route Handlers are HTTP endpoints: test status, JSON schema and auth, not React internals.",
    ],
    snippet: "await page.goto('/dashboard'); await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();",
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    version: "4.1",
    docsUrl: "https://tailwindcss.com/docs",
    keywords: ["tailwind", "css", "class", "responsive", "viewport", "layout", "style"],
    rules: [
      "Never select by generated utility classes; they change with design refactors.",
      "Test responsive breakpoints with explicit viewport sizes and assert visible labels, not class names.",
      "Use role/text assertions for hover/focus states; CSS class assertions are not behavioural.",
    ],
    snippet: "await page.setViewportSize({ width: 375, height: 812 }); await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();",
  },
  {
    id: "prisma",
    name: "Prisma",
    version: "6.16",
    docsUrl: "https://www.prisma.io/docs",
    keywords: ["prisma", "database", "sqlite", "postgres", "orm", "migration", "seed", "query"],
    rules: [
      "Assert persisted state through the API/database, never only through optimistic UI.",
      "Scope every query by organisationId in multi-tenant flows.",
      "Use transactions for multi-row invariants; clean up test fixtures by id.",
    ],
    snippet: "const record = await prisma.testCase.findFirst({ where: { id, organisationId } }); expect(record).not.toBeNull();",
  },
  {
    id: "typescript",
    name: "TypeScript",
    version: "5.6",
    docsUrl: "https://www.typescriptlang.org/docs",
    keywords: ["typescript", "types", "type", "tsc", "compile", "interface", "generic"],
    rules: [
      "Keep external payloads unknown until validated (zod/type guard); never cast blindly.",
      "Prefer discriminated unions for step/action variants so exhaustive UI rendering is checked.",
      "Run tsc --noEmit in CI; test code is type-checked too.",
    ],
    snippet: "type StepAction = 'Navigate' | 'Click' | 'Enter Text'; function render(action: StepAction) { switch (action) { /* exhaustive */ } }",
  },
];

function scoreLibrary(library: Context7Library, query: string): number {
  const needle = query.toLowerCase();
  let score = 0;
  for (const keyword of library.keywords) {
    if (needle.includes(keyword)) score += keyword.length > 4 ? 14 : 8;
  }
  if (needle.includes(library.name.toLowerCase())) score += 30;
  return score;
}

/** Resolve the most relevant library and return prompt-ready rules. */
export function resolveContext7(query: string): Context7Resolution {
  const trimmed = query.trim();
  const ranked = CONTEXT7_LIBRARIES.map((library) => ({ library, score: scoreLibrary(library, trimmed) })).sort((a, b) => b.score - a.score);
  const best = ranked[0] ?? { library: CONTEXT7_LIBRARIES[0], score: 0 };
  const resolved = best.score > 0;
  const rules = best.library.rules;
  const injectedPrompt = [
    `QASyn Framework Intelligence · ${best.library.name} v${best.library.version}`,
    `Source: ${best.library.docsUrl}`,
    ...rules.map((rule) => `- ${rule}`),
    `Reference snippet: ${best.library.snippet}`,
  ].join("\n");
  return {
    resolved,
    score: best.score,
    library: best.library,
    query: trimmed,
    rules,
    injectedPrompt,
    source: best.library.docsUrl,
  };
}

/** Short guidance block injected into generation and self-healing prompts. */
export function context7Guidance(query: string, limit = 3): string {
  const resolution = resolveContext7(query);
  return resolution.rules.slice(0, limit).map((rule) => `QASyn Framework Intelligence/${resolution.library.name}: ${rule}`).join("\n");
}
