import { randomBytes } from "node:crypto";

/** Jeton de tunnel simulé, ex. "tnl_BzB-1fS…" (serveur uniquement). */
export function generateTunnelToken(): string {
  return `tnl_${randomBytes(18).toString("base64url")}`;
}
