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
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function SiteShell({
  branding,
  nav,
  aktiverSlug,
  jahr,
  sprache,
  flaeche = "oeffentlich",
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
      <Kundencode branding={branding} flaeche={flaeche} />
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
