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
//
// ZWEI Fälle, die vorher EINER waren, und der Unterschied ist der ganze Punkt:
//
//   · Der Resolver antwortet 404 → die Domain ist nicht eingerichtet. Das ist
//     eine Aussage über die Welt, sie stimmt auch morgen noch: neutraler
//     Hinweis, und die Seiten darunter dürfen 404 sein.
//   · Der Resolver antwortet gar nicht (Zeitüberschreitung, Netzfehler) oder
//     mit 5xx → wir wissen es NICHT. Daraus 404 zu machen ist eine
//     Falschaussage mit Folgen: Google liest 404 als „diese Seite gibt es
//     nicht" und nimmt sie aus dem Index. Ein Backend, das drei Minuten
//     hustet, kostet den Kunden dann seine Sichtbarkeit.
//
// Deshalb endet der zweite Fall hier: 503 mit `Retry-After`, ohne die Seite
// überhaupt zu rendern. Das ist das Signal für „später nochmal" — genau das,
// was Suchmaschinen und Uptime-Prüfer erwarten (Wurzel 5: nicht verschlucken,
// nicht das falsche Signal senden).
import { type NextRequest, NextResponse } from "next/server";

import { backendBasis } from "@/lib/backend-basis";

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

/** Antwort, wenn der Resolver nicht erreichbar war.
 *
 *  Reiner Text und kein gerendertes Layout: das Layout bräuchte wieder das
 *  Branding, das gerade nicht zu holen ist. `Retry-After` nennt die Wartezeit,
 *  `no-store` verhindert, dass ein Zwischenspeicher den Ausfall festhält. */
function nichtErreichbar(): NextResponse {
  return new NextResponse(
    "Diese Website ist gerade nicht erreichbar. Bitte in einem Moment erneut versuchen.",
    {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "30",
        "Cache-Control": "no-store",
      },
    },
  );
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
    // DIREKT an FastAPI und nicht über den eigenen Proxy `/api/v1/…`.
    //
    // Der Proxy ist für den BROWSER da. Ihn hier zu benutzen hieße: der Server
    // schickt für JEDEN Seitenaufruf eine HTTP-Anfrage an sich selbst, die dann
    // erst weitergeleitet wird — ein zusätzlicher Sprung pro Aufruf und, viel
    // schlimmer, eine Rückkopplung: ist der Node-Prozess ausgelastet, steht auch
    // diese Selbstanfrage in derselben Warteschlange, läuft in die
    // Zeitüberschreitung und macht aus einer langsamen Seite eine tote. Genau
    // davor warnt `lib/backend-basis.ts` in seinem eigenen Kopf.
    const resolverUrl = `${backendBasis()}/api/v1/site/by-domain?host=${encodeURIComponent(host)}`;
    const res = await fetch(resolverUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status >= 500) return nichtErreichbar();
    if (!res.ok) {
      // 404/4xx: die Domain ist nicht eingerichtet → neutraler Hinweis.
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
    // Zeitüberschreitung oder Netzfehler: Wir wissen NICHT, ob es die Domain
    // gibt. Siehe Kopf — das ist ein 503, kein 404.
    return nichtErreichbar();
  } finally {
    clearTimeout(timer);
  }
}
