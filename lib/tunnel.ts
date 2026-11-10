import type { OsKey } from "./types";

/**
 * Commandes d'installation du tunnel affichÃ©es Ã  l'Ã©tape 2 (localhost).
 * âš  Commandes FICTIVES : le domaine `.dev` n'est pas rÃ©solu sur Internet et
 * le tunnel est entiÃ¨rement simulÃ© par /api/onboarding/connection.
 */
export function buildTunnelCommand(os: OsKey, token: string, port: number): string {
  switch (os) {
    case "WINDOWS":
      return [
        "# PowerShell",
        "Invoke-WebRequest https://get.qasyn.dev/tunnel.ps1 -OutFile qasyn-tunnel.ps1",
        `.\\qasyn-tunnel.ps1 -Token ${token} -Port ${port}`,
      ].join("\n");
    case "MACOS":
      return [
        "# Terminal (zsh)",
        "curl -fsSL https://get.qasyn.dev/tunnel.sh -o qasyn-tunnel.sh",
        `sh qasyn-tunnel.sh --token ${token} --port ${port}`,
      ].join("\n");
    case "LINUX":
      return [
        "# bash",
        "curl -fsSL https://get.qasyn.dev/tunnel.sh -o qasyn-tunnel.sh",
        `sh qasyn-tunnel.sh --token ${token} --port ${port}`,
      ].join("\n");
  }
}
