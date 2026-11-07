/**
 * Salesforce & SAP testing adapters: platform-specific step types and
 * simulated execution metadata (no external calls).
 */
export interface PlatformStep {
  id: string;
  action: string;
  target: string;
  value: string;
  platform: "salesforce" | "sap";
}

export const SALESFORCE_STEP_TYPES = ["Salesforce Login", "Lightning Component Click", "Record Create", "Record Verify", "Flow Trigger", "Agentforce Message"] as const;
export const SAP_STEP_TYPES = ["Fiori Navigation", "GUI Transaction", "BAPI Call", "iDoc Verify", "Batch Input"] as const;

export function platformStepsFor(platform: "salesforce" | "sap", raw: string): PlatformStep[] {
  const types = platform === "salesforce" ? SALESFORCE_STEP_TYPES : SAP_STEP_TYPES;
  return raw
    .split("\n")
    .filter(Boolean)
    .slice(0, 20)
    .map((line, i) => ({
      id: `pf-${i}`,
      action: types[i % types.length],
      target: line.slice(0, 120),
      value: "",
      platform,
    }));
}

export function platformAssertions(platform: "salesforce" | "sap"): Array<{ label: string; kind: string }> {
  return platform === "salesforce"
    ? [
        { label: "Record created", kind: "record" },
        { label: "Workflow triggered", kind: "workflow" },
        { label: "Agentforce reply grounded", kind: "ai" },
      ]
    : [
        { label: "Transaction committed", kind: "commit" },
        { label: "BAPI return code 0", kind: "bapi" },
        { label: "iDoc status OK", kind: "idoc" },
      ];
}
