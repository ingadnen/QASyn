import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const norm = (value) => value.replace(/\s+/g, " ").trim();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByLabel("Work e-mail").fill("cgi@cgi.com");
await page.locator('input[type="password"]').fill("CgiDemo2026!");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForTimeout(3500);
await page.waitForLoadState("networkidle");
console.log("LOGIN URL:", page.url());

// ---- New Requirement: method chooser + file generation ----
await page.goto(`${BASE}/dashboard/requirements`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /New Requirement/ }).click();
const requirementDialog = page.getByRole("dialog", { name: "New Requirement" });
await requirementDialog.waitFor();
const stepOne = norm(await requirementDialog.innerText());
console.log("REQ STEP1:", stepOne.slice(0, 500));
console.log("REQ STEP1 cards:", ["Generate from Integrations", "Generate from File", "Generate from Crawl"].every((label) => stepOne.includes(label)));
console.log("REQ STEP1 badge:", stepOne.includes("Step 1 of 2"));
await page.screenshot({ path: "contextqa-dump/local-new-requirement-step1.png" });
await requirementDialog.getByRole("button", { name: /Generate from File/ }).click();
await requirementDialog.getByLabel("Requirement name *").fill("Wizard parity uploaded specification");
console.log("REQ STEP2 badge:", norm(await requirementDialog.innerText()).includes("Step 2 of 2"));
await page.screenshot({ path: "contextqa-dump/local-new-requirement-step2.png" });
await requirementDialog.getByRole("button", { name: "Generate Requirement" }).click();
await requirementDialog.waitFor({ state: "hidden", timeout: 20000 });
await page.waitForTimeout(800);
console.log("REQ CREATED:", norm(await page.locator("body").innerText()).includes("Wizard parity uploaded specification"));

// ---- Create Test Suite wizard ----
await page.goto(`${BASE}/dashboard/plans/suites`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Create Test Suite" }).click();
const suiteDialog = page.getByRole("dialog", { name: "Create Test Suite" });
await suiteDialog.waitFor();
const suiteText = norm(await suiteDialog.innerText());
console.log("SUITE STEP1:", suiteText.slice(0, 600));
console.log("SUITE STEP1 checks:", ["Suite Basics", "Add Test Cases", "Folder / Location", "Prerequisites (Optional)", "Labels (Optional)", "Hide Configuration Options", "Select Target Platform", "Next, you'll add test cases"].every((copy) => suiteText.includes(copy)));
await suiteDialog.locator("#create-suite-name").fill("Wizard Parity Suite");
await page.screenshot({ path: "contextqa-dump/local-suite-wizard-step1.png" });
await suiteDialog.getByRole("button", { name: "Add Test Cases" }).click();
await page.waitForTimeout(250);
const suiteStepTwo = norm(await suiteDialog.innerText());
console.log("SUITE STEP2:", suiteStepTwo.slice(0, 350));
const caseCheckboxes = suiteDialog.getByRole("checkbox");
console.log("SUITE STEP2 checkboxes:", await caseCheckboxes.count());
await caseCheckboxes.nth(1).check();
await caseCheckboxes.nth(2).check();
await page.screenshot({ path: "contextqa-dump/local-suite-wizard-step2.png" });
await suiteDialog.getByRole("button", { name: "Create Test Suite" }).click();
await page.waitForURL(/\/dashboard\/plans\/suites\/[^/]+$/, { timeout: 30000 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(700);
const suiteBody = norm(await page.locator("body").innerText());
console.log("SUITE CREATED URL:", page.url());
console.log("SUITE CREATED body:", suiteBody.slice(0, 500));
const suiteUrl = page.url();

// ---- Create Test Plan wizard ----
await page.goto(`${BASE}/dashboard/plans/test-plans`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "New Test Plan" }).click();
const planDialog = page.getByRole("dialog", { name: "Create Test Plan" });
await planDialog.waitFor();
const planText = norm(await planDialog.innerText());
console.log("PLAN STEP1:", planText.slice(0, 700));
console.log("PLAN STEP1 checks:", ["Create Test Plan", "Test Machines & Suites Selection", "Test Plan Settings", "Test Plan Name *", "Labels (Optional)", "Description (Optional)", "Hide on Dashboard", "Send Notification", "Viewport *", "Resolution *"].every((copy) => planText.includes(copy)));
await planDialog.locator("#testPlanName").fill("Wizard Parity Plan");
const planLabels = planDialog.getByPlaceholder("Add label");
if (await planLabels.count()) await planLabels.fill("wizard");
if (await planLabels.count()) await planLabels.press("Enter");
await page.screenshot({ path: "contextqa-dump/local-plan-wizard-step1.png" });
await planDialog.getByRole("button", { name: "Next" }).click();
await page.waitForTimeout(1500);
const planStepTwo = norm(await planDialog.innerText());
console.log("PLAN STEP2:", planStepTwo.slice(0, 450));
await planDialog.getByRole("button", { name: "Add Machine/Device" }).click();
await planDialog.getByRole("button", { name: /Desktop · Chromium/ }).click();
await planDialog.getByRole("button", { name: "Add Test Suites" }).click();
await page.waitForTimeout(800);
const suiteChecks = planDialog.getByRole("checkbox");
console.log("PLAN suite checkboxes:", await suiteChecks.count());
if ((await suiteChecks.count()) > 0) await suiteChecks.first().check();
await page.screenshot({ path: "contextqa-dump/local-plan-wizard-step2.png" });
await planDialog.getByRole("button", { name: "Next" }).click();
await page.waitForTimeout(300);
const planStepThree = norm(await planDialog.innerText());
console.log("PLAN STEP3:", planStepThree.slice(0, 500));
console.log("PLAN STEP3 checks:", ["Execution Settings", "PARALLEL NODES", "CAPTURE SCREENSHOTS", "Proxy & Remote Browser Settings", "Notifications", "NOTIFICATION EMAILS", "Recovery Actions"].every((copy) => planStepThree.includes(copy)));
await page.screenshot({ path: "contextqa-dump/local-plan-wizard-step3.png" });
await planDialog.getByRole("button", { name: "Create Test Plan" }).click();
await page.waitForURL(/\/dashboard\/plans\/test-plans\/[^/]+$/, { timeout: 30000 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(700);
const planBody = norm(await page.locator("body").innerText());
console.log("PLAN CREATED URL:", page.url());
console.log("PLAN CREATED body:", planBody.slice(0, 600));

// ---- Verify propagation via API ----
const data = await page.evaluate(async (suiteUrl) => {
  const [suites, plans] = await Promise.all([
    fetch("/api/dashboard/collections/suites").then((response) => response.json()),
    fetch("/api/dashboard/collections/test-plans").then((response) => response.json()),
  ]);
  return {
    suite: suites.items?.find((item) => item.name === "Wizard Parity Suite"),
    plan: plans.items?.find((item) => item.name === "Wizard Parity Plan"),
    suiteUrl,
  };
}, suiteUrl);
console.log("PROPAGATION suite:", JSON.stringify(data.suite));
console.log("PROPAGATION plan:", JSON.stringify(data.plan));
console.log("PAGE ERRORS:", errors.slice(0, 5));
await browser.close();
