// Bindet den eigenen Code des Betriebs in seine Kunden-Website ein (0426).
//
// Server-Component ohne Interaktion: die Stücke stehen im Branding, das der
// Resolver ohnehin liefert. Was hier erlaubt ist und was schützt, steht in
// lib/code-injection.ts — inklusive der Begründung, warum es hier KEINE
// CSP-Nonce gibt.
import {
  type CodeFlaeche,
  codeStuecke,
  cssFuerElement,
  jsFuerElement,
} from "@/lib/code-injection";
import type { SiteBranding } from "@/lib/site-context";

export function Kundencode({
  branding,
  flaeche,
  seitenHtml,
}: {
  branding: SiteBranding | null | undefined;
  flaeche: CodeFlaeche;
  /** Kopf-HTML NUR dieser Seite (0430). Hostaway erwartet das Schema-Markup
   *  einer einzelnen Seite genau dort — „nur auf den Seiten, wo der Inhalt
   *  steht, sonst verwirrt es die Suchmaschinen". Dieselbe Allowlist wie
   *  site-weit (meta/link/title), geprüft beim Speichern.
   *
   *  Auf der Zahlungsseite wird es genauso ausgelassen wie das site-weite: dort
   *  läuft kein Kundencode, und ein <link> auf eine fremde Ressource ist auch
   *  Kundencode. */
  seitenHtml?: string | null;
}) {
  const { html, css, js } = codeStuecke(branding, flaeche);
  const seite = flaeche === "oeffentlich" ? (seitenHtml?.trim() || null) : null;
  if (!html && !css && !js && !seite) return null;

  return (
    <>
      {/* Das HTML ist serverseitig auf meta/link/title geprüft (nh3-Allowlist).
          React hebt <meta> und <link> im App Router selbst in den <head> — bei
          rohem HTML geht das nicht, deshalb steht es hier als unsichtbares
          <div>. Für Verifizierungs-Tags reicht das: Google liest den
          Dokumentinhalt, nicht die DOM-Position. */}
      {html ? (
        <div hidden dangerouslySetInnerHTML={{ __html: html }} />
      ) : null}
      {seite ? (
        <div hidden dangerouslySetInnerHTML={{ __html: seite }} />
      ) : null}
      {css ? (
        <style dangerouslySetInnerHTML={{ __html: cssFuerElement(css) }} />
      ) : null}
      {js ? (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script dangerouslySetInnerHTML={{ __html: jsFuerElement(js) }} />
      ) : null}
    </>
  );
}
