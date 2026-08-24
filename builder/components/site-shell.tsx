// Rahmen jeder Kunden-Seite: Kopfzeile + Inhalt + Fußzeile im gewählten Theme.
//
// Genau EINE Stelle, an der das Skelett zusammengesetzt wird. Vorher baute jede
// Route (Startseite, Unterseite, Inserat) ihren Rahmen selbst zusammen — drei
// Kopien, die auseinanderlaufen, sobald eine sich ändert.
//
// Das Theme „seitlich" ist der einzige Fall mit waagerechter Aufteilung: die
// Leiste steht links, der Inhalt daneben. Alle anderen stapeln senkrecht.
import type { ReactNode } from "react";

import type { CodeFlaeche } from "@/lib/code-injection";
import type { SiteBranding, SiteNav } from "@/lib/site-context";
import { texte } from "@/lib/texte";
import { themeOf } from "@/lib/theme";

import { CookieHinweis } from "./cookie-hinweis";
import { Kundencode } from "./kundencode";
import { PopupFlaeche } from "./popup-flaeche";
import { SiteKopfdaten } from "./site-kopfdaten";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function SiteShell({
  branding,
  nav,
  aktiverSlug,
  jahr,
  sprache,
  flaeche = "oeffentlich",
  seitenHtml,
  tenantId,
  vorschau = false,
  children,
}: {
  branding: SiteBranding | null | undefined;
  nav: SiteNav;
  aktiverSlug?: string;
  jahr: number;
  /** Sprache, in der gerendert wird (lib/sprache.ts). */
  sprache: string;
  /** Welcher Kundencode hier läuft. `checkout` lässt head_html/head_css/
   *  custom_js aus und bindet nur das Conversion-Pixel ein — die Trennung
   *  steckt in lib/code-injection.ts, hier wird nur die Fläche benannt. */
  flaeche?: CodeFlaeche;
  /** Kopf-HTML NUR dieser Seite (0430) — siehe components/kundencode.tsx. */
  seitenHtml?: string | null;
  /** Für die Pop-ups (0437): ihre Abschnitte brauchen den Tenant, um Objekte
   *  und Bewertungen zu laden. Fehlt er, gibt es keine Pop-ups — dieselbe
   *  Regel wie bei jedem anderen Abschnitt. */
  tenantId?: string | null;
  /** Läuft dieser Rahmen im Editor-iframe (0430)?
   *
   *  Dann KEIN Google-Tag und keine strukturierten Daten. Beides ist im Entwurf
   *  nicht nur überflüssig, sondern schädlich: jeder Blick des Betriebs auf
   *  seine eigene Vorschau würde als Besuch gezählt und seine Statistik
   *  verfälschen — bei einer Seite, an der man arbeitet, sind das Dutzende
   *  Aufrufe am Tag. */
  vorschau?: boolean;
  children: ReactNode;
}) {
  const txt = texte(sprache);
  const kopf = (
    <SiteHeader
      branding={branding}
      nav={nav.header}
      aktiverSlug={aktiverSlug}
      sprache={sprache}
    />
  );
  const fuss = <SiteFooter branding={branding} nav={nav.footer} jahr={jahr} />;
  // Der eigene Code und der Cookie-Hinweis hängen am RAHMEN und nicht an den
  // Routen: sonst muss jede neue Seite daran denken, und eine vergisst es. Die
  // Fläche entscheidet, was davon greift.
  const beiwerk = (
    <>
      <Kundencode
        branding={branding}
        flaeche={flaeche}
        seitenHtml={seitenHtml}
      />
      {vorschau ? null : <SiteKopfdaten branding={branding} />}
      {/* Pop-ups hängen am RAHMEN und nicht an einer Route: sie erscheinen
          überall, wo ihr Auslöser greift. In der Vorschau bleiben sie aus —
          sonst legt sich beim Bearbeiten ein Fenster über den Editor. */}
      {vorschau || !tenantId ? null : (
        <PopupFlaeche tenantId={tenantId} sprache={sprache} />
      )}
      {branding?.cookie_banner ? (
        <CookieHinweis
          text={txt.cookieText}
          knopf={txt.cookieKnopf}
          linkText={txt.cookieLink}
          linkHref={
            branding.cookie_policy_slug
              ? `/${branding.cookie_policy_slug}`
              : null
          }
        />
      ) : null}
    </>
  );

  if (themeOf(branding) === "seitlich") {
    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        {kopf}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">{children}</main>
          {fuss}
        </div>
        {beiwerk}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {kopf}
      <main className="flex-1">{children}</main>
      {fuss}
      {beiwerk}
    </div>
  );
}
