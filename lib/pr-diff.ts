import { prisma } from "./db";
import { parseIntegrationConfig } from "./integration-providers";

export interface PrFileDiff {
  file: string;
  /** Unified diff excerpt (truncated) for the changed file. */
  patch: string;
}

const PER_FILE_LIMIT = 2_400;
const MAX_FILES = 8;

/** Truncates a unified diff to a prompt-sized excerpt, keeping the leading hunks. */
function clampPatch(patch: string): string {
  if (patch.length <= PER_FILE_LIMIT) return patch;
  return `${patch.slice(0, PER_FILE_LIMIT)}\n… (diff truncated)`;
}

/**
 * Fetches the real unified diffs of ONE pull request so test drafting is
 * grounded in the actual code changes, not just file paths. GitHub and GitLab
 * use the integration's stored token (falling back to the workspace
 * GITHUB_TOKEN); every failure is swallowed — drafting degrades to the
 * changed-file list.
 */
export async function fetchPrDiffs(input: {
  organisationId: string;
  provider: string | null;
  repository: string | null;
  prNumber: number;
}): Promise<PrFileDiff[]> {
  const repository = (input.repository ?? "").trim();
  if (!repository.includes("/")) return [];
  const provider = (input.provider ?? "").toUpperCase();

  let token = "";
  let host = "";
  if (provider === "GITHUB") {
    host = "https://api.github.com";
  } else if (provider === "GITLAB") {
    host = "https://gitlab.com/api/v4";
  } else {
    return [];
  }

  const integration = await prisma.integration.findFirst({
    where: { organisationId: input.organisationId, provider: provider === "GITHUB" ? "GITHUB" : "GITLAB" },
  });
  const config = integration ? parseIntegrationConfig(integration.configJson) : {};
  token = config.token ?? config.apiToken ?? config.personalAccessToken ?? config.pat ?? process.env.GITHUB_TOKEN ?? "";
  if (!token) return [];

  try {
    if (provider === "GITHUB") {
      const response = await fetch(
        `${host}/repos/${repository}/pulls/${input.prNumber}/files?per_page=${MAX_FILES}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" }, cache: "no-store" },
      );
      if (!response.ok) return [];
      const listing = (await response.json()) as Array<{ filename?: string; patch?: string }>;
      if (!Array.isArray(listing)) return [];
      return listing
        .filter((entry) => typeof entry.filename === "string" && typeof entry.patch === "string" && entry.patch)
        .slice(0, MAX_FILES)
        .map((entry) => ({ file: entry.filename as string, patch: clampPatch(entry.patch as string) }));
    }
    const response = await fetch(
      `${host}/projects/${encodeURIComponent(repository)}/merge_requests/${input.prNumber}/diffs`,
      { headers: { "PRIVATE-TOKEN": token }, cache: "no-store" },
    );
    if (!response.ok) return [];
    const listing = (await response.json()) as Array<{ new_path?: string; diff?: string }>;
    if (!Array.isArray(listing)) return [];
    return listing
      .filter((entry) => typeof entry.new_path === "string" && typeof entry.diff === "string" && entry.diff)
      .slice(0, MAX_FILES)
      .map((entry) => ({ file: entry.new_path as string, patch: clampPatch(entry.diff as string) }));
  } catch {
    return [];
  }
}
