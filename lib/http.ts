import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/** Latence artificielle des routes simulées (0 = aucune attente, réponses instantanées). */
export const MOCK_LATENCY_MS = 0;

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function validationError(error: ZodError) {
  return jsonError(error.issues[0]?.message ?? "Invalid request.", 400, {
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}

/** Lit le corps JSON sans lever d'exception (null si absent / invalide). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
