// Unterseite einer Kunden-Site (z. B. /ueber-uns, /kontakt) = die im Baukasten
// komponierte Seite mit diesem Slug, gerendert pro Custom-Domain.
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { SeitenSchloss } from "@/components/seiten-schloss";
import { SiteShell } from "@/components/site-shell";
import { BrotkrumenDaten } from "@/components/strukturierte-daten";
import { aktuellerHost, spracheAusPfad } from "@/lib/host";
import { seitenMetadaten } from "@/lib/metadaten";
import { basisUrl, ladeWeiterleitung, seitenPfad } from "@/lib/seo";
import { ladeSeite, ladeSeitenErgebnis } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

/** Die <head>-Angaben dieser Seite (0430).
 *
 *  Next ruft das VOR der Komponente auf. Beide holen dieselbe Seite, aber
 *  `ladeSeite` ist in `cache()` gewickelt — es wird pro Request nur einmal
 *  wirklich abgerufen.
 *
 *  Findet sich keine Seite, bleiben die Metadaten leer statt eine erfundene
 *  Beschreibung zu tragen. Die Komponente entscheidet danach, ob weitergeleitet
 *  oder 404 gezeigt wird; das hier ist kein guter Ort dafür, weil Next
 *  Metadaten auch für Fehlerseiten auswertet. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!host) return {};
  // Die Sprache MUSS auch hier bestimmt werden, nicht nur in der Komponente:
  // `<title>`, `description` und der Canonical entstehen HIER. Ohne sie trug
  // die dänische Adresse einen deutschen Titel — und der Titel ist das, was in
  // der Trefferliste steht.
  const sprache = spracheWaehlen(branding, await spracheAusPfad());
  const site = await ladeSeite(host, slug, null, sprache);
  if (!site) return {};
  return seitenMetadaten({ branding, host, page: site.page, sprache });
}

export default async function SlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  // ZWEI Quellen für die Sprache, und die Reihenfolge ist Absicht:
  //
  //   1. Das Pfad-Präfix (`/da/kontakt`) — die Adresse, die Google indexiert.
  //   2. `?lang=` — der alte Weg. Er bleibt gültig, weil verschickte Links und
  //      Lesezeichen ihn tragen; er ist nur nicht mehr der, den wir erzeugen.
  //
  // Das Präfix gewinnt: es steht in der Adresse, und wenn beide etwas anderes
  // sagen, ist das, was der Nutzer sieht, die Wahrheit.
  const { lang } = await searchParams;
  const pfadSprache = await spracheAusPfad();
  const { branding, unknown } = await getSiteContext();
  const host = await aktuellerHost();
  const sprache = spracheWaehlen(branding, pfadSprache ?? lang);

  if (unknown || !host) notFound();

  // Das Ticket einer geschützten Seite (0442) steht im Cookie und nicht im
  // localStorage: diese Seite wird SERVERSEITIG gerendert, und der Server sieht
  // nur Cookies. Aus dem localStorage müsste der Inhalt im Browser nachgeladen
  // werden — dann stünde er für einen Moment nicht im HTML und ohne JavaScript
  // nie.
  const kekse = await cookies();
  const ticket = kekse.get(`nd-seite-${slug || "home"}`)?.value ?? null;
  const ergebnis = await ladeSeitenErgebnis(host, slug, ticket, sprache);

  // Gesperrt ist NICHT dasselbe wie nicht vorhanden. Als 404 behandelt hätte
  // der Gast mit dem richtigen Passwort in der Hand nie erfahren, dass er nur
  // danach gefragt werden muss.
  if (ergebnis.art === "gesperrt") {
    return (
      <SeitenSchloss
        host={host}
        slug={slug}
        sprache={sprache}
      />
    );
  }

  const site = ergebnis.art === "seite" ? ergebnis.seite : null;
  if (!site) {
    // Keine Seite unter diesem Pfad — jetzt und NUR jetzt zählt eine
    // Weiterleitung (0430). Die Reihenfolge ist unverhandelbar: eine
    // existierende Seite hat Vorrang, sonst wäre sie über ihre eigene Adresse
    // unerreichbar, sobald jemand versehentlich eine Weiterleitung darauf legt.
    const ziel = await ladeWeiterleitung(host, `/${slug}`);
    if (ziel) {
      // 301 gibt die Suchmaschinen-Platzierung der alten Adresse an die neue
      // weiter, 302 behält sie bei der alten. Der Unterschied ist der ganze
      // Grund, warum der Kunde zwischen beiden wählen kann — ihn hier
      // einzuebnen würde die Einstellung zur Attrappe machen.
      //
      // Beide Funktionen werfen (Next signalisiert die Weiterleitung als
      // Ausnahme), deshalb steht danach kein `return`.
      if (ziel.redirect_type === 301) permanentRedirect(ziel.target);
      redirect(ziel.target);
    }
    notFound();
  }

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      aktiverSlug={slug}
      jahr={new Date().getFullYear()}
      sprache={sprache}
      seitenHtml={site.page.head_html}
      tenantId={site.tenant_id}
    >
      <BrotkrumenDaten
        branding={branding}
        basisUrl={basisUrl(host)}
        titel={site.page.title}
        pfad={seitenPfad(site.page.slug)}
        trail={site.page.trail}
      />
      <BlockRenderer
        blocks={site.blocks}
        tenantId={site.tenant_id}
        modus={{ aktiv: false, locale: sprache }}
        seite={site.page}
      />
    </SiteShell>
  );
}
