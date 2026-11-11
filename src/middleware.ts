import { NextResponse, type NextRequest } from "next/server";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth/session";

/** Everything is private: no valid session → /login. */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = await isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!signedIn) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
