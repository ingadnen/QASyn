import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge guard: private areas need a session cookie. The cookie itself is
 * validated server-side (lib/auth.ts) in every layout / route handler.
 */
/** Installers are fetched by curl / Invoke-RestMethod, which have no session. */
const PUBLIC_FILES = new Set(["/install.ps1", "/install.sh"]);
const MAIL_HOSTS = new Set(["mail.qasyn.com", "mail.qasyn.io"]);

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].trim().toLowerCase();
  if (MAIL_HOSTS.has(host) && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/super-admin";
    url.hash = "webmail-inbox";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // The public homepage must stay public; only the mail hosts are redirected above.
  if (request.nextUrl.pathname === "/") return NextResponse.next();
  if (PUBLIC_FILES.has(request.nextUrl.pathname)) return NextResponse.next();
  if (!request.cookies.get("qasyn_session")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/onboard/:path*",
    "/signup/verify",
    "/install.ps1",
    "/install.sh",
  ],
};
