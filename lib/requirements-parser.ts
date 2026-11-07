/**
 * Requirements parser: extracts testable acceptance criteria from plain
 * text / Jira stories / Figma frames, and auto-generates test cases.
 */
export function parseRequirements(text: string): Array<{ title: string; criteria: string[] }> {
  const chunks = text.split(/\n{2,}|\n(?=\s*[-•]|\d+\.)/).map((c) => c.trim()).filter(Boolean);
  return chunks.slice(0, 20).map((chunk, i) => {
    const sentences = chunk.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 8);
    return { title: sentences[0]?.slice(0, 80) || `Requirement ${i + 1}`, criteria: sentences.slice(0, 5) };
  });
}

export function requirementsToTestCases(requirements: Array<{ title: string; criteria: string[] }>): Array<{ title: string; steps: string[] }> {
  return requirements.map((r) => ({
    title: `Verify: ${r.title}`,
    steps: r.criteria.length ? r.criteria : [`Navigate to the feature`, `Verify "${r.title}"`],
  }));
}

export function parseCsvRequirements(csv: string): Array<{ title: string }> {
  return csv
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.toLowerCase().startsWith("title"))
    .slice(0, 50)
    .map((line) => ({ title: line.split(",")[0].trim() }));
}
