/**
 * Root Cause Analysis: classifies run failures and produces a Jira/Linear
 * bug payload with stack trace and evidence references.
 */
export type FailureClass = "ELEMENT_MUTATION" | "TIMEOUT" | "ASSERTION_FAILURE" | "API_500" | "NETWORK" | "UNKNOWN";

export function classifyFailure(logs: Array<{ tag: string; message: string }>): { classification: FailureClass; confidence: number; explanation: string } {
  const hay = logs.map((l) => `${l.tag} ${l.message}`).join(" ").toLowerCase();
  if (/healed|selector|mutation|element not found|detached/.test(hay)) return { classification: "ELEMENT_MUTATION", confidence: 0.9, explanation: "DOM mutation broke a recorded selector; auto-healing engaged." };
  if (/timeout|timed out|deadline/.test(hay)) return { classification: "TIMEOUT", confidence: 0.85, explanation: "Step exceeded its execution window." };
  if (/assert|expected|to be visible|to contain/.test(hay)) return { classification: "ASSERTION_FAILURE", confidence: 0.8, explanation: "An assertion on page state failed." };
  if (/500|internal server error/.test(hay)) return { classification: "API_500", confidence: 0.75, explanation: "Backend returned a 5xx response." };
  if (/network|requestfailed|failed to fetch|econnrefused/.test(hay)) return { classification: "NETWORK", confidence: 0.7, explanation: "Network-level failure during execution." };
  return { classification: "UNKNOWN", confidence: 0.3, explanation: "Classify manually from logs." };
}

export function bugExportPayload(run: { id: string; release: number; version: string; title: string }, rca: { classification: FailureClass; explanation: string }, tracker: "jira" | "linear") {
  return {
    tracker,
    title: `[${rca.classification}] ${run.title} (Release #${run.release} v${run.version})`,
    description: `Autonomous RCA from QASyn run ${run.id}.\n\nClassification: ${rca.classification}\nEvidence: ${rca.explanation}\nReproduce: open /dashboard/runs/${run.id} for logs, screenshots and traces.`,
    labels: ["qasyn", "autonomous-rca", rca.classification.toLowerCase()],
    priority: rca.classification === "API_500" || rca.classification === "ELEMENT_MUTATION" ? "High" : "Medium",
  };
}
