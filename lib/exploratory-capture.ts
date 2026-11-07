/**
 * Exploratory capture: converts unstructured session actions into NLP steps.
 */
export interface ExploratoryAction {
  kind: string;
  target: string;
  value?: string;
  ts?: string;
}

export function actionsToNlpSteps(actions: ExploratoryAction[]): Array<{ id: string; action: string; target: string; value: string; selector: string }> {
  const map: Record<string, string> = { click: "Click", input: "Enter Text", navigate: "Navigate", verify: "Verify Element", scroll: "Verify Element" };
  return actions.slice(0, 50).map((a, i) => ({
    id: `exp-${i}`,
    action: map[a.kind.toLowerCase()] ?? "Click",
    target: a.target || "element",
    value: a.value ?? "",
    selector: "",
  }));
}
