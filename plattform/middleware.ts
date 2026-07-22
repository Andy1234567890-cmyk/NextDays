// Route-Guard für die geschützten Gast-Bereiche. Ohne nd_access-Cookie
// (Portal-Gast nicht eingeloggt) → Redirect nach /anmelden. Die eigentliche
// Autorisierung passiert serverseitig in FastAPI (Signaturprüfung); dieser
// Guard verhindert nur, dass ausgeloggte Nutzer leere Dashboard-Shells sehen.
import { type NextRequest, NextResponse } from "next/server";

const GESCHUETZT = [
  "/konto",
  "/buchungen",
  "/aufenthalt",
  "/nachrichten",
  "/merkzettel",
  "/bewertungen",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const geschuetzt = GESCHUETZT.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!geschuetzt) return NextResponse.next();

  const token = req.cookies.get("nd_access")?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/anmelden";
  url.searchParams.set("weiter", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/konto/:path*",
    "/buchungen/:path*",
    "/aufenthalt/:path*",
    "/nachrichten/:path*",
    "/merkzettel/:path*",
    "/bewertungen/:path*",
  ],
};
