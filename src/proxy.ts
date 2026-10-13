import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: no cookie → back to the landing page. The real
 * checks happen in the data access layer (src/lib/server/dal.ts).
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    // A form saved after signing out gets an error it can show, rather than a redirect that loses the typing.
    if (request.headers.has("next-action")) return new NextResponse("Signed out.", { status: 401 });
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:path*", "/account/:path*"],
};
