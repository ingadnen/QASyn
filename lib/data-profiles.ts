/**
 * Data profiles: CSV parser and parameterized execution planning.
 * Excel is accepted as CSV text in this prototype (upload is simulated).
 */
export interface DataProfileRows {
  columns: string[];
  rows: Record<string, string>[];
}

/** Parses CSV text into columns + row objects. */
export function parseCsv(text: string): DataProfileRows {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { columns: [], rows: [] };
  const split = (line: string) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const columns = split(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ""]));
  });
  return { columns, rows };
}

/** Substitutes {{row.COL}} variables for one data row. */
export function applyDataRow(template: string, row: Record<string, string>): string {
  return template.replace(/\{\{row\.(\w+)\}\}/g, (_, k) => row[k] ?? "");
}

/** Filter variable substitution: {{env.KEY}}, {{var.KEY}}, {{row.KEY}}. */
export function substituteVariables(template: string, ctx: { env?: Record<string, string>; vars?: Record<string, string>; row?: Record<string, string> }): string {
  return template
    .replace(/\{\{env\.(\w+)\}\}/g, (_, k) => ctx.env?.[k] ?? `{{env.${k}}}`)
    .replace(/\{\{var\.(\w+)\}\}/g, (_, k) => ctx.vars?.[k] ?? `{{var.${k}}}`)
    .replace(/\{\{row\.(\w+)\}\}/g, (_, k) => ctx.row?.[k] ?? `{{row.${k}}}`);
}

/** Masks secrets for logs/reports: keeps the first char and last 2. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 3) return "***";
  return `${value[0]}***${value.slice(-2)}`;
}
