/**
 * Security scanner: OWASP Top 10 style checks over fetched headers/body.
 * Simulated fetch is optional — callers pass already-fetched data.
 */
export interface SecurityFinding {
  check: string;
  owasp: string;
  severity: "high" | "medium" | "low";
  description: string;
  remediation: string;
}

export function scanHeaders(headers: Record<string, string>): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  if (!lower["content-security-policy"]) findings.push({ check: "CSP header", owasp: "A05", severity: "medium", description: "Missing Content-Security-Policy header", remediation: "Add a strict CSP header." });
  if (!lower["x-frame-options"] && !lower["content-security-policy"]?.includes("frame-ancestors")) findings.push({ check: "Clickjacking", owasp: "A05", severity: "medium", description: "Missing anti-clickjacking headers", remediation: "Set X-Frame-Options or frame-ancestors." });
  if (!lower["strict-transport-security"]) findings.push({ check: "HSTS", owasp: "A05", severity: "low", description: "Missing Strict-Transport-Security", remediation: "Add HSTS with max-age ≥ 31536000." });
  if (!lower["x-content-type-options"]) findings.push({ check: "MIME sniffing", owasp: "A05", severity: "low", description: "Missing X-Content-Type-Options", remediation: "Set nosniff." });
  const cookie = lower["set-cookie"] ?? "";
  if (cookie && (!/samesite=/i.test(cookie) || !/secure/i.test(cookie))) findings.push({ check: "Cookie flags", owasp: "A05", severity: "medium", description: "Cookies missing Secure/SameSite flags", remediation: "Set Secure and SameSite=Lax at minimum." });
  return findings;
}

export function scanBody(body: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  if (/<script[^>]*>(?!.*<\/script>)/i.test(body)) findings.push({ check: "XSS reflection", owasp: "A03", severity: "high", description: "Unescaped script content detected", remediation: "Encode user input before rendering." });
  if (/(union\s+select|drop\s+table|or\s+1=1)/i.test(body)) findings.push({ check: "SQL injection vector", owasp: "A03", severity: "high", description: "SQLi pattern in response body", remediation: "Use parameterized queries everywhere." });
  if (/debug\s*=/i.test(body)) findings.push({ check: "Debug exposure", owasp: "A05", severity: "low", description: "Debug parameter exposed", remediation: "Remove debug flags in production." });
  return findings;
}

export function cvssScore(findings: SecurityFinding[]): number {
  const weights = { high: 25, medium: 10, low: 3 };
  return Math.min(100, findings.reduce((s, f) => s + weights[f.severity], 0));
}
