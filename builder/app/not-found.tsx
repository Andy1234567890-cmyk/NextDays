// Die Fehlerseite einer Kunden-Website (0433).
//
// Zwei Fälle in einer Datei, und die Reihenfolge ist der Punkt:
//
//   1. Der Betrieb hat eine EIGENE 404-Seite im Baukasten angelegt (Seitentyp
//      `error404`). Dann wird sie gerendert — mit Kopfzeile, Fußzeile und den
//      Abschnitten, die er dort zusammengestellt hat. Ein Gast, der sich
//      vertippt hat, landet dann auf einer Seite, die aussieht wie die Website
//      und ihn zurückführt.
//   2. Er hat keine. Dann steht hier eine schlichte, ehrliche Meldung — im
//      Rahmen seiner Website, nicht in einer fremden.
//
// Was NICHT passiert: eine erfundene Fehlerseite mit Marketing-Text („Ups, hier
// ist wohl der Wind durchgegangen!"). Das ist der Ton des Betriebs, nicht
// unserer (Wurzel 4).
import type { Metadata } from "next";
import Link from "next/link";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost } from "@/lib/host";
import { ladeFehlerseite } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";
import { texte } from "@/lib/texte";

/** Eine Fehlerseite gehört NIE in den Suchindex.
 *
 *  Ohne diese Angabe nimmt Google sie auf — und dann steht sie mit dem Titel
 *  der Website in den Ergebnissen, während die echte Startseite darunter
 *  konkurriert. `follow` bleibt an: die Links auf der Fehlerseite (zurück zur
 *  Startseite) soll er ruhig verfolgen. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function NichtGefunden() {
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  const sprache = spracheWaehlen(branding);

  const eigene = host ? await ladeFehlerseite(host) : null;

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={sprache}
    >
      {eigene ? (
        <BlockRenderer
          blocks={eigene.blocks}
          tenantId={eigene.tenant_id}
          modus={{ aktiv: false, locale: sprache }}
        />
      ) : (
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-24 text-center">
          {/* Die „404" bleibt als Zahl stehen und wird nicht übersetzt: sie ist
              ein Statuscode, kein Wort. */}
          <p className="font-display text-6xl font-extrabold tracking-tight">
            404
          </p>
          <h1 className="font-display text-2xl font-bold">
            {texte(sprache).nichtGefunden}
          </h1>
          <p className="text-muted-foreground">
            {texte(sprache).nichtGefundenHinweis}
          </p>
          <Link
            href="/"
            className="btn-marke btn-marke-primaer mt-2 inline-flex items-center bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            {texte(sprache).zurStartseite}
          </Link>
        </section>
      )}
    </SiteShell>
  );
}
