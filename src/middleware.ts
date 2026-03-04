import { NextRequest, NextResponse } from "next/server";

const COMING_SOON = ["/mint", "/collection", "/battle", "/arena", "/leaderboard"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (COMING_SOON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/buy-gndm", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/mint", "/collection", "/battle", "/arena", "/leaderboard"],
};
