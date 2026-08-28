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
import { istSprache } from "@/lib/sprache";

export const config = {
  matcher: ["/((?!_next/|api/|healthz|favicon.ico|.*\\.[\\w]+$).*)"],
};

// Auflösung max. so lange blockieren — danach neutral rendern statt hängen.
//
// 1500 ms waren zu knapp. Der Resolver braucht lokal 0,44–0,88 s, und bei
// mehreren gleichzeitigen Anfragen — genau das passiert, wenn der Baukasten
// seine Vorschau lädt — gemessen bis 1,17 s. Jede Spitze darüber wurde zu
// einem 503, und im Editor stand statt der Seite „Diese Website ist gerade
// nicht erreichbar" (gesehen am 26.08.2026). Der Kunde sieht dann einen
// Ausfall, obwohl nur eine Anfrage 100 ms zu lang gebraucht hat.
//
// 5000 ms, weil das die Grenze zwischen „langsam" und „wirklich weg" trifft:
// ein gesunder Resolver bleibt weit darunter, ein toter antwortet gar nicht
// und läuft ins Limit. Höher zu gehen hieße, den Besucher minutenlang auf eine
// weiße Seite zu setzen — das Limit soll ja gerade verhindern, dass die Seite
// hängt.
const RESOLVE_TIMEOUT_MS = 5000;

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

/** Erstes Pfadsegment, wenn es ein Sprachkürzel ist.
 *
 *  DAS SPRACHPRÄFIX IST DER GRUND, WARUM ÜBERSETZUNGEN ÜBERHAUPT RANKEN.
 *
 *  Vorher reiste die Sprache als `?lang=da`. Für einen Besucher, der den
 *  Umschalter anklickt, reicht das — für Google nicht: URL-Parameter listet es
 *  ausdrücklich als nicht empfohlene Variante für Sprachfassungen
 *  (Search Central, „Managing multi-regional and multilingual sites"), und
 *  eine Fassung ohne eigene, crawlbare Adresse kann es nicht als eigene Seite
 *  indexieren. Damit war die dänische Fassung für die dänische Suche
 *  unsichtbar, obwohl der Text da war.
 *
 *  Ein Unterordner (`/da/kontakt`) ist die von Google empfohlene und von den
 *  Anbietern (Weglot, Shopify, WPML) durchgängig gewählte Form. Für ein
 *  White-Label-Produkt ist er zusätzlich die EINZIGE tragbare: eine Subdomain
 *  je Sprache bräuchte pro Betrieb und Sprache einen DNS-Eintrag.
 *
 *  Die Standardsprache bekommt KEIN Präfix. `/kontakt` bleibt `/kontakt` —
 *  sonst hätte jede bestehende Adresse sich geändert, und alle eingehenden
 *  Links wären auf eine Weiterleitung angewiesen. */
function spracheAusPfad(pfad: string): { sprache: string | null; rest: string } {
  const teile = pfad.split("/").filter(Boolean);
  const erstes = (teile[0] ?? "").toLowerCase();
  if (!istSprache(erstes)) return { sprache: null, rest: pfad };
  const rest = "/" + teile.slice(1).join("/");
  return { sprache: erstes, rest };
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = hostOf(req);
  const headers = new Headers(req.headers);
  headers.delete("x-tenant-id");
  headers.delete("x-site-branding");
  headers.delete("x-site-unknown");
  headers.delete("x-site-sprache");

  // Das Sprachsegment wird HIER abgeschnitten und als Header weitergegeben.
  //
  // Warum nicht als eigenes Routen-Segment `app/[lang]/[slug]`: dann gäbe es
  // jede Route zweimal (mit und ohne Sprache), und die Standardsprache müsste
  // in beiden Bäumen gepflegt werden. Ein Rewrite hält den Routenbaum bei
  // einer Fassung — `/da/kontakt` und `/kontakt` landen in derselben
  // `app/[slug]/page.tsx`, die den Header liest.
  const { sprache, rest } = spracheAusPfad(req.nextUrl.pathname);
  if (sprache) headers.set("x-site-sprache", sprache);

  /** Weiter — mit abgeschnittenem Sprachpräfix.
   *
   *  Ohne den Rewrite landete `/da/kontakt` in `app/[slug]` als Slug „da", und
   *  die eigentliche Seite wäre ein 404. Der Rewrite ist INTERN: die Adresse in
   *  der Leiste bleibt `/da/kontakt`, und genau die indexiert Google. */
  const weiter = (): NextResponse => {
    if (!sprache) return NextResponse.next({ request: { headers } });
    const ziel = req.nextUrl.clone();
    ziel.pathname = rest;
    return NextResponse.rewrite(ziel, { request: { headers } });
  };

  if (!host) {
    headers.set("x-site-unknown", "1");
    return weiter();
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
      return weiter();
    }
    const site = (await res.json()) as {
      tenant_id?: string;
      languages?: string[] | null;
      default_language?: string | null;
    };
    if (!site.tenant_id) {
      headers.set("x-site-unknown", "1");
      return weiter();
    }

    // ÜBERZÄHLIGE SPRACHADRESSEN WEGLEITEN, statt sie mit 200 zu beantworten.
    //
    // Ohne das gäbe es dieselbe Seite unter bis zu 24 Adressen: die Middleware
    // erkennt jedes der 24 Kürzel, `spracheWaehlen` filtert eine nicht
    // geführte Sprache für die Textwahl heraus — aber die ROUTE bliebe
    // bestehen und lieferte 200 mit identischem Inhalt. Für eine Website mit
    // drei Sprachen wären das 21 undeklarierte Dubletten je Seite, also genau
    // der Duplicate Content, den hreflang und Canonical an anderer Stelle
    // sorgfältig vermeiden.
    //
    // 301 und nicht 302: die Adresse ohne Präfix (bzw. die der Standardsprache)
    // IST die richtige, dauerhaft. Ein 302 würde die Suchmaschinen-Bewertung
    // bei der falschen Adresse belassen.
    //
    // Zwei Fälle, beide führen auf denselben Pfad ohne Präfix:
    //   · die STANDARDSPRACHE (`/de/kontakt` bei default_language=de) — sie
    //     bekommt bewusst kein Präfix, sonst gäbe es die Startseite zweimal;
    //   · eine NICHT GEFÜHRTE Sprache (`/fr/kontakt`, wenn nur da/en gepflegt
    //     sind) — für sie gibt es keine Fassung, und eine Adresse, hinter der
    //     nichts Eigenes steht, gehört nicht in den Index.
    if (sprache) {
      const gefuehrt = (site.languages ?? []).filter((l) =>
        typeof l === "string" && istSprache(l),
      );
      // DIESELBE Standard-Regel wie in `mitSprache`: ohne gesetzte
      // `default_language` gilt der Notnagel „de". Beide Seiten müssen sie
      // teilen — sonst erzeugt `mitSprache` für eine unkonfigurierte Website
      // `/kontakt` (kein Präfix für de), während die Middleware `/de/kontakt`
      // mit 200 beantwortet: zwei Adressen, von denen eine niemand verlinkt.
      const standard = site.default_language || "de";
      const ueberfluessig =
        sprache === standard ||
        (gefuehrt.length > 0 && !gefuehrt.includes(sprache)) ||
        // Gar keine Sprachen eingerichtet: dann gibt es KEINE Fassung außer
        // der Standardsprache, und jede Präfix-Adresse ist eine Dublette.
        gefuehrt.length === 0;
      if (ueberfluessig) {
        const ziel = req.nextUrl.clone();
        ziel.pathname = rest;
        return NextResponse.redirect(ziel, 301);
      }
    }

    headers.set("x-tenant-id", site.tenant_id);
    headers.set("x-site-branding", JSON.stringify(site));
    return weiter();
  } catch {
    // Zeitüberschreitung oder Netzfehler: Wir wissen NICHT, ob es die Domain
    // gibt. Siehe Kopf — das ist ein 503, kein 404.
    return nichtErreichbar();
  } finally {
    clearTimeout(timer);
  }
}
