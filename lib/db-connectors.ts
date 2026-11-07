/**
 * Database & ERP connectors: real Prisma raw queries scoped to the organisation,
 * plus metadata adapters for Salesforce Lightning and SAP.
 * No credentials are stored: queries run against the local QASyn database.
 */
import { prisma } from "./db";

export interface DbAssertion {
  label: string;
  /** Whitelisted count query — only these keys are accepted (no raw SQL from clients). */
  check: "test_cases" | "bugs_reproduced" | "prs_checked" | "crawls_completed" | "tokens_active";
  expected: number;
}

export const DB_CHECKS: Record<string, DbAssertion["check"]> = {
  test_cases: "test_cases",
  bugs_reproduced: "bugs_reproduced",
  prs_checked: "prs_checked",
  crawls_completed: "crawls_completed",
  tokens_active: "tokens_active",
};

export async function countForCheck(organisationId: string, check: DbAssertion["check"]): Promise<number> {
  const where = { organisationId };
  switch (check) {
    case "test_cases":
      return prisma.testCase.count({ where });
    case "bugs_reproduced":
      return prisma.bugReport.count({ where: { ...where, status: "reproduced" } });
    case "prs_checked":
      return prisma.pullRequestCheck.count({ where });
    case "crawls_completed":
      return prisma.crawlSession.count({ where: { ...where, status: "completed" } });
    case "tokens_active":
      return prisma.apiToken.count({ where });
  }
}

/** Runs the whitelisted assertions against the organisation's own data (raw Prisma aggregates). */
export async function runDbAssertions(organisationId: string, assertions: DbAssertion[]) {
  const results = [];
  for (const a of assertions) {
    const actual = await countForCheck(organisationId, a.check);
    results.push({ label: a.label, check: a.check, expected: a.expected, actual, passed: actual >= a.expected });
  }
  return { results, passed: results.every((r) => r.passed) };
}

// ---------------------------------------------------------- ERP metadata adapters

export interface ErpObject {
  name: string;
  fields: string[];
  description: string;
}

/** Salesforce Lightning metadata (read-only descriptors of accessible objects). */
export function salesforceMetadata(): ErpObject[] {
  return [
    { name: "Account", fields: ["Id", "Name", "Industry", "BillingCountry", "LastModifiedDate"], description: "Salesforce Account object" },
    { name: "Opportunity", fields: ["Id", "Name", "StageName", "Amount", "CloseDate"], description: "Salesforce Opportunity object" },
    { name: "Case", fields: ["Id", "Subject", "Status", "Priority", "Origin"], description: "Support case object" },
    { name: "Contact", fields: ["Id", "FirstName", "LastName", "Email", "AccountId"], description: "Salesforce Contact object" },
  ];
}

/** SAP S/4HANA metadata (read-only descriptors of accessible entities). */
export function sapMetadata(): ErpObject[] {
  return [
    { name: "BusinessPartner", fields: ["BusinessPartner", "BusinessPartnerName", "Country", "Language"], description: "SAP Business Partner" },
    { name: "SalesOrder", fields: ["SalesOrder", "SalesDocumentType", "TotalNetAmount", "OrderDate"], description: "SAP Sales Order" },
    { name: "PurchaseOrder", fields: ["PurchaseOrder", "Supplier", "OrderDate", "TotalNetAmount"], description: "SAP Purchase Order" },
    { name: "Material", fields: ["Material", "MaterialDescription", "BaseUnit", "MaterialType"], description: "SAP Material master" },
  ];
}
