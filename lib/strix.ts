/**
 * Strix Security — passive, defensive web surface scanner.
 *
 * It performs exactly one GET request (redirects are not followed) and inspects
 * response headers, cookies and the first 200 KB of HTML. It never sends an
 * exploit payload and refuses private/loopback targets (SSRF protection).
 */

export type StrixSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface StrixFinding {
  id: string;
  title: string;
  severity: StrixSeverity;
  category: "headers" | "cookies" | "exposure" | "transport";
  passed: boolean;
  evidence: string;
  remediation: string;
  owasp: string;
}

export interface StrixCookie {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

export interface StrixReport {
  target: string;
  scannedAt: string;
  reachable: boolean;
  httpStatus: number | null;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  findings: StrixFinding[];
  headers: Record<string, string>;
  cookies: StrixCookie[];
  surface: string[];
  error?: string;
  notes: string[];
}

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|.*\.local$|.*\.internal$)/i;

/** Only public http(s) targets may be scanned. */
export function isPassiveScanTarget(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (PRIVATE_HOST.test(url.hostname)) return false;
  return true;
}

function severityPenalty(severity: StrixSeverity): number {
  switch (severity) {
    case "critical": return 30;
    case "high": return 18;
    case "medium": return 8;
    case "low": return 3;
    default: return 0;
  }
}

function gradeFor(score: number): StrixReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function parseCookie(raw: string): StrixCookie {
  const [pair, ...attributes] = raw.split(";").map((part) => part.trim());
  const name = pair.split("=")[0] || "(unnamed)";
  const flags = new Set(attributes.map((attribute) => attribute.toLowerCase()));
  const sameSite = attributes.find((attribute) => /^samesite=/i.test(attribute))?.split("=")[1] ?? "unset";
  return { name, secure: flags.has("secure"), httpOnly: flags.has("httponly"), sameSite };
}

/** Runs the passive scan. Never throws: network failures become an unreachable report. */
export async function runStrixScan(target: string): Promise<StrixReport> {
  const normalised = /^https?:\/\//i.test(target.trim()) ? target.trim() : `https://${target.trim()}`;
  const base: StrixReport = {
    target: normalised,
    scannedAt: new Date().toISOString(),
    reachable: false,
    httpStatus: null,
    score: 0,
    grade: "F",
    findings: [],
    headers: {},
    cookies: [],
    surface: [],
    notes: [
      "Passive scan only: one GET request, no redirects followed, no exploit payload sent.",
      "Private, loopback and link-local targets are refused to prevent SSRF.",
    ],
  };
  if (!isPassiveScanTarget(normalised)) {
    return { ...base, error: "Target must be a public http(s) URL. Private, loopback and credential-bearing URLs are refused.", findings: [], score: 0, grade: "F" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(normalised, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "QASyn-Strix-Passive/1.0 (+defensive header audit)", accept: "text/html,application/xhtml+xml" },
    });
    clearTimeout(timer);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : headers["set-cookie"]
          ? [headers["set-cookie"]]
          : [];
    const cookies = setCookies.map(parseCookie);
    const contentType = headers["content-type"] ?? "";
    const body = response.status < 400 && /text\/html|application\/xhtml/i.test(contentType) ? (await response.text()).slice(0, 200_000) : "";
    const isHttps = normalised.startsWith("https:");

    const findings: StrixFinding[] = [];
    const add = (
      id: string,
      title: string,
      severity: StrixSeverity,
      category: StrixFinding["category"],
      passed: boolean,
      evidence: string,
      remediation: string,
      owasp: string,
    ) => findings.push({ id, title, severity, category, passed, evidence, remediation, owasp });

    const csp = headers["content-security-policy"];
    add(
      "csp-present",
      "Content-Security-Policy",
      "high",
      "headers",
      Boolean(csp),
      csp ? csp.slice(0, 180) : "Header missing",
      "Define a default-src 'self' policy and only allow the hosts actually used by scripts, styles and frames.",
      "A05:2021 Security Misconfiguration",
    );
    if (csp) {
      const weak = /unsafe-inline|unsafe-eval/i.test(csp) || !/default-src|script-src/i.test(csp);
      add(
        "csp-strict",
        "CSP is restrictive",
        "medium",
        "headers",
        !weak,
        weak ? "Policy allows unsafe-inline/unsafe-eval or has no default-src/script-src." : "No unsafe-inline/unsafe-eval directive detected.",
        "Remove unsafe-inline/unsafe-eval; use nonces or hashes for inline scripts and styles.",
        "A05:2021 Security Misconfiguration",
      );
    }

    const hsts = headers["strict-transport-security"];
    if (isHttps) {
      const maxAge = Number(/max-age=(\d+)/i.exec(hsts ?? "")?.[1] ?? 0);
      add(
        "hsts",
        "Strict-Transport-Security",
        "high",
        "transport",
        Boolean(hsts) && maxAge >= 15_552_000,
        hsts ?? "Header missing",
        "Serve Strict-Transport-Security: max-age=31536000; includeSubDomains; preload on HTTPS responses.",
        "A02:2021 Cryptographic Failures",
      );
    } else {
      add("https", "HTTPS transport", "high", "transport", false, "Target is served over plain HTTP.", "Redirect all HTTP traffic to HTTPS and enable HSTS.", "A02:2021 Cryptographic Failures");
    }

    const frame = headers["x-frame-options"];
    const frameAllowed = /deny|sameorigin/i.test(frame ?? "") || /frame-ancestors/i.test(csp ?? "");
    add(
      "frame",
      "Clickjacking protection",
      "medium",
      "headers",
      frameAllowed,
      frame || (csp ? "Checked CSP frame-ancestors" : "No X-Frame-Options and no frame-ancestors"),
      "Send X-Frame-Options: DENY (or SAMEORIGIN) and CSP frame-ancestors 'self'.",
      "A05:2021 Security Misconfiguration",
    );

    add(
      "nosniff",
      "X-Content-Type-Options",
      "low",
      "headers",
      /nosniff/i.test(headers["x-content-type-options"] ?? ""),
      headers["x-content-type-options"] ?? "Header missing",
      "Always send X-Content-Type-Options: nosniff.",
      "A05:2021 Security Misconfiguration",
    );

    const referrer = headers["referrer-policy"];
    add(
      "referrer",
      "Referrer-Policy",
      "low",
      "headers",
      Boolean(referrer) && !/unsafe-url/i.test(referrer),
      referrer ?? "Header missing",
      "Use Referrer-Policy: strict-origin-when-cross-origin (or no-referrer).",
      "A01:2021 Broken Access Control",
    );

    add(
      "permissions",
      "Permissions-Policy",
      "low",
      "headers",
      Boolean(headers["permissions-policy"]),
      headers["permissions-policy"] ?? "Header missing",
      "Disable unused browser features: camera=(), microphone=(), geolocation=().",
      "A05:2021 Security Misconfiguration",
    );

    const insecureCookies = cookies.filter((cookie) => !cookie.secure || !cookie.httpOnly || cookie.sameSite.toLowerCase() === "none" || cookie.sameSite === "unset");
    add(
      "cookies",
      "Cookie flags",
      cookies.length === 0 ? "info" : "high",
      "cookies",
      insecureCookies.length === 0,
      cookies.length === 0 ? "No Set-Cookie header on this response." : `${cookies.length} cookie(s), ${insecureCookies.length} missing Secure/HttpOnly/SameSite.`,
      "Set Secure, HttpOnly and SameSite=Lax (or Strict) on every session cookie.",
      "A07:2021 Identification and Authentication Failures",
    );

    const server = headers.server;
    add(
      "server-banner",
      "Server banner disclosure",
      "low",
      "exposure",
      !server,
      server ? `Server: ${server}` : "No Server header.",
      "Remove or genericise the Server and X-Powered-By headers to reduce fingerprinting.",
      "A05:2021 Security Misconfiguration",
    );

    const poweredBy = headers["x-powered-by"] ?? headers["x-aspnet-version"];
    add(
      "tech-banner",
      "Framework version disclosure",
      "low",
      "exposure",
      !poweredBy,
      poweredBy ?? "No framework version header.",
      "Remove X-Powered-By / X-AspNet-Version and verbose error pages in production.",
      "A05:2021 Security Misconfiguration",
    );

    const cors = headers["access-control-allow-origin"];
    add(
      "cors",
      "CORS wildcard",
      "medium",
      "exposure",
      cors !== "*",
      cors ? `Access-Control-Allow-Origin: ${cors}` : "No wildcard CORS header.",
      "Restrict Access-Control-Allow-Origin to trusted origins; never combine '*' with credentials.",
      "A01:2021 Broken Access Control",
    );

    const sourceMap = /sourceMappingURL=([^\s*]+)/i.exec(body)?.[1];
    add(
      "sourcemaps",
      "Production source maps",
      "medium",
      "exposure",
      !sourceMap,
      sourceMap ? `sourceMappingURL=${sourceMap}` : "No sourceMappingURL in the returned HTML.",
      "Do not publish .map files in production, or restrict them to authenticated internal users.",
      "A05:2021 Security Misconfiguration",
    );

    const directoryListing = /<title>\s*Index of \//i.test(body);
    add(
      "directory-listing",
      "Directory listing",
      "high",
      "exposure",
      !directoryListing,
      directoryListing ? "HTML title looks like an Apache/nginx directory index." : "No directory index detected.",
      "Disable autoindex/directory browsing on the web server.",
      "A05:2021 Security Misconfiguration",
    );

    const mixedForm = /<form[^>]+action=["']http:\/\//i.test(body);
    add(
      "mixed-form",
      "Insecure form action",
      "high",
      "exposure",
      !mixedForm,
      mixedForm ? "A form posts to a plain HTTP action." : "No plain-HTTP form action detected.",
      "Post forms to HTTPS endpoints only and enable HSTS.",
      "A02:2021 Cryptographic Failures",
    );

    const surface = [
      isHttps ? "HTTPS" : "HTTP (insecure)",
      server ? `Server: ${server}` : "Server banner hidden",
      poweredBy ? `Framework: ${poweredBy}` : "Framework version hidden",
      `${cookies.length} cookie(s)`,
      sourceMap ? "Source maps exposed" : "No source maps",
      csp ? "CSP present" : "CSP absent",
      hsts ? `HSTS ${hsts}` : "HSTS absent",
    ];

    const failed = findings.filter((finding) => !finding.passed && finding.severity !== "info");
    const score = Math.max(0, Math.min(100, 100 - failed.reduce((total, finding) => total + severityPenalty(finding.severity), 0)));

    return {
      ...base,
      reachable: true,
      httpStatus: response.status,
      score,
      grade: gradeFor(score),
      findings,
      headers,
      cookies,
      surface,
      notes: [
        ...base.notes,
        `HTTP ${response.status}${response.status >= 300 && response.status < 400 ? ` · redirect to ${headers.location ?? "unknown"}` : ""}`,
        `${findings.filter((finding) => finding.passed).length}/${findings.length} checks passed.`,
      ],
    };
  } catch (error) {
    clearTimeout(timer);
    return {
      ...base,
      error: error instanceof Error ? error.message : "Target did not answer.",
      score: 0,
      grade: "F",
    };
  }
}
