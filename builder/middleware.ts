// Host→Tenant-Middleware der white-label Builder-App.
//
// Diese App liefert pro Agentur eine eigene gebrandete Buchungs-Site unter deren
// eigener Custom-Domain. Aus dem Host-Header wird der Tenant + dessen öffentliches
// Branding aufgelöst (Backend-Resolver /api/v1/site/by-domain) und beides als
// Request-Header an die Server-Components weitergereicht (x-tenant-id /
// x-site-branding). app/layout.tsx + lib/inserate.ts lesen diese Header.
//
// Anders als der globale Marktplatz (plattform/) MUSS hier immer ein Tenant
// aufgelöst werden — jede Domain gehört genau einer Agentur. Ein unbekannter Host
// ist hier kein „global", sondern „nicht eingerichtet": x-site-unknown=1, die
// Seite zeigt einen neutralen Hinweis (kein Crash, kein fremder Inhalt).
import { type NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/|api/|healthz|favicon.ico|.*\\.[\\w]+$).*)"],
};

// Auflösung max. so lange blockieren — danach neutral rendern statt hängen.
const RESOLVE_TIMEOUT_MS = 1500;

function hostOf(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return raw.split(":")[0]!.trim().toLowerCase();
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = hostOf(req);
  const headers = new Headers(req.headers);
  headers.delete("x-tenant-id");
  headers.delete("x-site-branding");
  headers.delete("x-site-unknown");

  if (!host) {
    headers.set("x-site-unknown", "1");
    return NextResponse.next({ request: { headers } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const url = new URL(req.url);
    const resolverUrl = `${url.origin}/api/v1/site/by-domain?host=${encodeURIComponent(host)}`;
    const res = await fetch(resolverUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // 404 (Domain nicht eingerichtet) oder Backend-Fehler → neutraler Hinweis.
      headers.set("x-site-unknown", "1");
      return NextResponse.next({ request: { headers } });
    }
    const site = (await res.json()) as { tenant_id?: string };
    if (!site.tenant_id) {
      headers.set("x-site-unknown", "1");
      return NextResponse.next({ request: { headers } });
    }
    headers.set("x-tenant-id", site.tenant_id);
    headers.set("x-site-branding", JSON.stringify(site));
    return NextResponse.next({ request: { headers } });
  } catch {
    // Timeout/Netzfehler → neutraler Hinweis, kein 500.
    headers.set("x-site-unknown", "1");
    return NextResponse.next({ request: { headers } });
  } finally {
    clearTimeout(timer);
  }
}
