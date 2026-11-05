import type { OsKey } from "./types";

/**
 * Commandes d'installation du tunnel affichées à l'étape 2 (localhost).
 * ⚠ Commandes FICTIVES : le domaine `.local` n'est pas résolu sur Internet et
 * le tunnel est entièrement simulé par /api/onboarding/connection.
 */
export function buildTunnelCommand(os: OsKey, token: string, port: number): string {
  switch (os) {
    case "WINDOWS":
      return [
        "# PowerShell",
        "Invoke-WebRequest https://get.qasyn.local/tunnel.ps1 -OutFile qasyn-tunnel.ps1",
        `.\\qasyn-tunnel.ps1 -Token ${token} -Port ${port}`,
      ].join("\n");
    case "MACOS":
      return [
        "# Terminal (zsh)",
        "curl -fsSL https://get.qasyn.local/tunnel.sh -o qasyn-tunnel.sh",
        `sh qasyn-tunnel.sh --token ${token} --port ${port}`,
      ].join("\n");
    case "LINUX":
      return [
        "# bash",
        "curl -fsSL https://get.qasyn.local/tunnel.sh -o qasyn-tunnel.sh",
        `sh qasyn-tunnel.sh --token ${token} --port ${port}`,
      ].join("\n");
  }
}
