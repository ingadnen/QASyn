/**
 * Scheduler: cron expression parser (5-field) and next-fire computation.
 * Limited to standard cron fields: minute hour dom month dow.
 */
export function parseCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((p) => /^[\d*\/,\-]+$/.test(p));
}

/** Computes the next fire time (minutes) for a cron expression, scanning ahead (max 7 days). */
export function nextFireTime(expr: string, from = new Date()): Date | null {
  if (!parseCron(expr)) return null;
  const [min, hour] = expr.trim().split(/\s+/);
  const matches = (field: string, value: number) => {
    if (field === "*") return true;
    if (field.startsWith("*/")) return value % Number(field.slice(2)) === 0;
    return field.split(",").some((p) => p === String(value) || (p.includes("-") && value >= Number(p.split("-")[0]) && value <= Number(p.split("-")[1])));
  };
  const cursor = new Date(from.getTime() + 60_000);
  cursor.setSeconds(0, 0);
  for (let i = 0; i < 7 * 24 * 60; i++) {
    if (matches(min, cursor.getMinutes()) && matches(hour, cursor.getHours())) return new Date(cursor);
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return null;
}

/** Human-friendly preset for common cron expressions. */
export function cronPreset(expr: string): string {
  const presets: Record<string, string> = {
    "0 2 * * *": "Daily at 02:00",
    "*/15 * * * *": "Every 15 minutes",
    "0 * * * *": "Hourly",
    "0 9 * * 1": "Weekly on Monday 09:00",
  };
  return presets[expr] ?? expr;
}
