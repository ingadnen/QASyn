import type { OsKey } from "./types";

/**
 * Install commands shown at onboarding step 2 (localhost).
 *
 * They point at the real `/install.ps1` and `/install.sh` routes served by the
 * deployment the user is browsing, so the agent always discovers the correct
 * origin. The onboarding "enrol" action remains simulated.
 */
export function buildTunnelCommand(os: OsKey, token: string, port: number, origin: string): string {
  const base = origin || "http://localhost:3000";
  switch (os) {
    case "WINDOWS":
      return [
        "# PowerShell",
        `irm ${base}/install.ps1 | iex`,
        `qasyn connect --name qa --token ${token}`,
      ].join("\n");
    case "MACOS":
      return [
        "# Terminal (zsh)",
        `curl -fsSL ${base}/install.sh | bash -s -- connect --name qa --token ${token}`,
        `# then publish localhost:${port}`,
      ].join("\n");
    case "LINUX":
      return [
        "# bash",
        `curl -fsSL ${base}/install.sh | bash -s -- connect --name qa --token ${token}`,
        `# then publish localhost:${port}`,
      ].join("\n");
  }
}
