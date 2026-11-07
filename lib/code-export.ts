/**
 * Code export engine: generates test files per framework from NLP steps.
 * Pure string templating, no external deps.
 */
import type { NlpStep } from "./engines";

export type ExportFramework = "playwright" | "selenium" | "cypress" | "webdriverio";
export type ExportLanguage = "typescript" | "javascript" | "python" | "java";

export interface ExportFile {
  path: string;
  language: string;
  content: string;
}

const slug = (text: string) => text.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "test";

function stepLinePlaywright(s: NlpStep): string {
  switch (s.action) {
    case "Navigate":
      return `await page.goto("${s.target}");`;
    case "Click":
      return s.selector ? `await page.locator("${s.selector}").click();` : `await page.getByText("${s.target}").click();`;
    case "Enter Text":
      return `await page.fill("${s.selector || "input"}", "${s.value || s.target}");`;
    case "Verify Element":
      return `await expect(page.locator("${s.selector || `text=${s.target}`}")).toBeVisible();`;
    case "API Call":
      return `await page.request.get("${s.target}");`;
    default:
      return `// ${s.action}: ${s.target}`;
  }
}

function stepLineCypress(s: NlpStep): string {
  switch (s.action) {
    case "Navigate":
      return `cy.visit("${s.target}");`;
    case "Click":
      return s.selector ? `cy.get("${s.selector}").click();` : `cy.contains("${s.target}").click();`;
    case "Enter Text":
      return `cy.get("${s.selector || "input"}").type("${s.value || s.target}");`;
    case "Verify Element":
      return `cy.get("${s.selector || "body"}").contains("${s.target}").should("be.visible");`;
    default:
      return `// ${s.action}: ${s.target}`;
  }
}

function stepLinePython(s: NlpStep): string {
  switch (s.action) {
    case "Navigate":
      return `driver.get("${s.target}")`;
    case "Click":
      return `driver.find_element(By.CSS_SELECTOR, "${s.selector || "body"}").click()`;
    case "Enter Text":
      return `driver.find_element(By.CSS_SELECTOR, "${s.selector || "input"}").send_keys("${s.value || s.target}")`;
    case "Verify Element":
      return `assert driver.find_element(By.CSS_SELECTOR, "${s.selector || "body"}")`;
    default:
      return `# ${s.action}: ${s.target}`;
  }
}

function stepLineJava(s: NlpStep): string {
  switch (s.action) {
    case "Navigate":
      return `driver.get("${s.target}");`;
    case "Click":
      return `driver.findElement(By.cssSelector("${s.selector || "body"})).click();`;
    case "Enter Text":
      return `driver.findElement(By.cssSelector("${s.selector || "input"})).sendKeys("${s.value || s.target}");`;
    case "Verify Element":
      return `assert driver.findElement(By.cssSelector("${s.selector || "body"}")) != null;`;
    default:
      return `// ${s.action}: ${s.target}`;
  }
}

export function exportTestCase(tc: { title: string }, steps: NlpStep[], framework: ExportFramework, language: ExportLanguage): ExportFile[] {
  const name = slug(tc.title);
  const body = steps.map((s) => `  ${framework === "cypress" ? stepLineCypress(s) : framework === "selenium" ? (language === "java" ? stepLineJava(s) : stepLinePython(s)) : stepLinePlaywright(s)}`).join("\n");
  const pom = `// Page Object: ${name}\n// Generated from QASyn TestCase "${tc.title}"\nexport class ${name[0].toUpperCase()}${name.slice(1)}Page {\n  constructor(private page: Page) {}\n  async goto(url: string) { await this.page.goto(url); }\n}\n`;

  switch (framework) {
    case "playwright":
      return [
        {
          path: `tests/${name}.spec.ts`,
          language: "typescript",
          content: `import { test, expect } from "@playwright/test";\n\ntest.describe("${tc.title}", () => {\n  test("runs the recorded flow", async ({ page }) => {\n${body}\n  });\n});\n`,
        },
        { path: `pages/${name}.page.ts`, language: "typescript", content: pom },
        { path: "playwright.config.ts", language: "typescript", content: `import { defineConfig } from "@playwright/test";\nexport default defineConfig({ testDir: "./tests", use: { baseURL: process.env.BASE_URL } });\n` },
      ];
    case "cypress":
      return [
        {
          path: `cypress/e2e/${name}.cy.js`,
          language: "javascript",
          content: `describe("${tc.title}", () => {\n  it("runs the recorded flow", () => {\n${body}\n  });\n});\n`,
        },
        { path: "cypress.config.js", language: "javascript", content: `const { defineConfig } = require("cypress");\nmodule.exports = defineConfig({ e2e: { baseUrl: process.env.BASE_URL } });\n` },
      ];
    case "selenium":
      if (language === "java") {
        return [
          {
            path: `src/test/java/qasyn/${name[0].toUpperCase()}${name.slice(1)}Test.java`,
            language: "java",
            content: `package qasyn;\nimport org.openqa.selenium.*;\npublic class ${name[0].toUpperCase()}${name.slice(1)}Test {\n  public static void main(String[] args) {\n    WebDriver driver = new ChromeDriver();\n${body}\n    driver.quit();\n  }\n}\n`,
          },
        ];
      }
      return [
        {
          path: `tests/test_${name}.py`,
          language: "python",
          content: `from selenium import webdriver\nfrom selenium.webdriver.common.by import By\n\ndef test_flow():\n    driver = webdriver.Chrome()\n${body}\n    driver.quit()\n`,
        },
      ];
    case "webdriverio":
      return [
        {
          path: `test/specs/${name}.js`,
          language: "javascript",
          content: `describe("${tc.title}", () => {\n  it("runs the recorded flow", async () => {\n    await browser.url("${steps[0]?.target ?? "https://example.com"}");\n${body}\n  });\n});\n`,
        },
        { path: "wdio.conf.js", language: "javascript", content: `exports.config = { specs: ["./test/specs/**/*.js"], capabilities: [{ browserName: "chrome" }] };\n` },
      ];
  }
}
