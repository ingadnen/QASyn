import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { guardApi } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

interface Step {
  id?: string;
  action: string;
  target: string;
  value?: string;
  selector?: string;
}

function q(value: string) {
  return JSON.stringify(value);
}

function stepToCode(step: Step): string {
  const selector = step.selector?.trim();
  const locator = selector ? `page.locator(${q(selector)})` : `page.getByText(${q(step.target)})`;
  switch (step.action) {
    case "Navigate":
      return `  await page.goto(${q(step.target.replace(/^Navigate to\s+/i, ""))});`;
    case "Click":
      return `  await ${locator}.first().click();`;
    case "Enter Text":
      return `  await ${locator}.first().fill(${q(step.value || step.target)});`;
    case "Verify Element":
    case "AI Assertion":
      return `  await expect(${locator}.first()).toBeVisible();`;
    case "API Call":
      return `  // API Call: ${step.target}${step.value ? ` → ${step.value}` : ""}`;
    case "OCR/Document Validation":
    case "KYC Check":
    case "Salesforce Workflow Steps":
      return `  // ${step.action}: ${step.target}`;
    default:
      return `  // ${step.action}: ${step.target}`;
  }
}

/** GET /api/dashboard/test-cases/[id]/export — a runnable Playwright .spec.ts file. */
export async function GET(_request: Request, { params }: Params) {
  const guard = await guardApi();
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const { id } = await params;

  const testCase = await prisma.testCase.findFirst({ where: { id, organisationId: ctx.org.id } });
  if (!testCase) return jsonError("Test case not found.", 404);

  let steps: Step[] = [];
  try {
    steps = JSON.parse(testCase.stepsJson || "[]") as Step[];
  } catch {
    steps = [];
  }
  if (steps.length === 0) {
    steps = [{ action: "Navigate", target: ctx.org.website || "about:blank" }];
  }

  const safeName = testCase.title.replace(/'/g, "\\'");
  const spec = [
    `import { test, expect } from "@playwright/test";`,
    ``,
    `test.describe(${q(testCase.module)}, () => {`,
    `  test(${q(safeName)}, async ({ page }) => {`,
    ...steps.map(stepToCode),
    `  });`,
    `});`,
    ``,
  ].join("\n");

  const fileName = testCase.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "test-case";
  return new NextResponse(spec, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}.spec.ts"`,
    },
  });
}
