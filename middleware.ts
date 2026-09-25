import { NextResponse, type NextRequest } from "next/server";

// Redirige vers /login les visiteurs sans cookie de session (vérification complète côté serveur ensuite).
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("progenis_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/taches/:path*", "/reflexion/:path*", "/projet/:path*", "/gestion/:path*"],
};
