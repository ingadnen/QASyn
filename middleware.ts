import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge guard: private areas need a session cookie. The cookie itself is
 * validated server-side (lib/auth.ts) in every layout / route handler.
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.get("qasyn_session")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/onboard/:path*", "/signup/verify"],
};
