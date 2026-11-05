/** Client fetch typé vers les routes /api (côté navigateur). */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  signal?: AbortSignal;
}

export async function apiFetch<T>(url: string, { method = "GET", json, signal }: ApiOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    cache: "no-store",
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, data);
  }
  return data as T;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again.";
