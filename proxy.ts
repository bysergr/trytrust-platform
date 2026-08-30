import { NextResponse, type NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authConfigured = Boolean(process.env.NEXT_PUBLIC_HANKO_API_URL)
  const hasSession = Boolean(request.cookies.get("hanko")?.value)
  const isPublic = pathname === "/login" || pathname.startsWith("/s/") || pathname.startsWith("/api/public/")
  const isHankoCallback = pathname === "/login" && (
    request.nextUrl.searchParams.has("hanko_token") || request.nextUrl.searchParams.has("error")
  )

  if (authConfigured && !hasSession && !isPublic) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }
  if (hasSession && pathname === "/login" && !isHankoCallback) return NextResponse.redirect(new URL("/", request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
