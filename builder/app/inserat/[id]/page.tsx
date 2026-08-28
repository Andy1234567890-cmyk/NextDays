// Inserat-Detailseite — Galerie, Eckdaten, Beschreibung, Ausstattung, Lage
// und seitliches Buchungs-Widget. Daten aus dem Backend (booking_engine,
// nur active Objekte). Keine erfundenen Bewertungen/Texte.
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BuchungsWidget } from "@/components/buchungs-widget";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteShell } from "@/components/site-shell";
import { ObjektStrukturierteDaten } from "@/components/strukturierte-daten";
import { aktuellerHost, spracheAusPfad } from "@/lib/host";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { ladeInserat } from "@/lib/inserate";
import { hreflangKarte } from "@/lib/metadaten";
import { basisUrl } from "@/lib/seo";
import { ladeObjektVorlage } from "@/lib/site";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

// Ausstattungs-Icons (Mapping bekannter amenity-Codes → Icon + Label).
const AMENITY_META: Record<string, { icon: string; label: string }> = {
  wifi: { icon: "ph:wifi-high", label: "WLAN" },
  kitchen: { icon: "ph:cooking-pot", label: "Küche" },
  parking: { icon: "ph:car", label: "Parkplatz" },
  tv: { icon: "ph:television", label: "Smart-TV" },
  heating: { icon: "ph:thermometer", label: "Heizung" },
  washer: { icon: "ph:washing-machine", label: "Waschmaschine" },
  pool: { icon: "ph:swimming-pool", label: "Pool" },
  pets: { icon: "ph:paw-print", label: "Haustiere erlaubt" },
};

/** Die <head>-Angaben einer Objektseite (0430).
 *
 *  Sie fehlten vollständig: jede Objektseite trug den Titel der Website und die
 *  Beschreibung aus dem Root-Layout. Damit hatten zwanzig Objekte im
 *  Suchergebnis zwanzigmal dieselbe Zeile — für Google das Kennzeichen
 *  austauschbarer Seiten, und für den Gast kein Hinweis, welche Unterkunft er
 *  anklickt.
 *
 *  Der Titel ist der Objektname, die Beschreibung ihr Anfang. Beides sind echte
 *  Daten des Objekts, kein erfundener Text: der Auszug ist eine Kürzung, keine
 *  Erfindung (Wurzel 4). Fehlt die Beschreibung, fehlt auch die Meta-Angabe —
 *  dann schreibt Google sich selbst eine aus dem Seiteninhalt, und die ist
 *  besser als ein generischer Satz. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { tenantId, branding } = await getSiteContext();
  const host = await aktuellerHost();
  if (!tenantId || !host) return {};
  const listing = await ladeInserat(id, {}, tenantId);
  if (!listing) return {};

  const marke = branding?.site_name?.trim();
  const titel = marke ? `${listing.titel} — ${marke}` : listing.titel;
  const absolut = `${basisUrl(host)}/inserat/${listing.id}`;
  // Auf 300 Zeichen kürzen und am letzten Satzende abschneiden: ein Auszug, der
  // mitten im Wort endet, liest sich in einem Suchergebnis wie ein Fehler.
  const roh = listing.beschreibung?.trim();
  let auszug: string | null = null;
  if (roh) {
    const kurz = roh.slice(0, 300);
    const ende = Math.max(
      kurz.lastIndexOf(". "),
      kurz.lastIndexOf("! "),
      kurz.lastIndexOf("? "),
    );
    auszug = roh.length > 300 && ende > 80 ? kurz.slice(0, ende + 1) : kurz;
  }
  const bild = listing.fotos[0];

  return {
    metadataBase: new URL(basisUrl(host)),
    title: titel,
    ...(auszug ? { description: auszug } : {}),
    alternates: {
      canonical: absolut,
      languages: hreflangKarte(branding, host, `/inserat/${id}`),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    openGraph: {
      type: "website",
      url: absolut,
      title: titel,
      ...(marke ? { siteName: marke } : {}),
      ...(auszug ? { description: auszug } : {}),
      ...(bild ? { images: [{ url: bild }] } : {}),
    },
    twitter: {
      card: bild ? "summary_large_image" : "summary",
      title: titel,
      ...(auszug ? { description: auszug } : {}),
      ...(bild ? { images: [bild] } : {}),
    },
  };
}

export default async function InseratPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // `?lang=` — die Objektseite ist die Seite, auf der ein Gast am längsten
  // liest. Sie ignorierte die Sprachwahl bisher ganz: der Wähler in der
  // Kopfzeile stellte die Startseite um, und ein Klick auf ein Objekt fiel
  // zurück in die Standardsprache.
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  // tenant-gescoped: ein fremdes Inserat liefert mit ?tenant= aus dem Backend
  // 404 → notFound (kein Cross-Tenant-Zugriff über die Direkt-URL).
  const { tenantId, branding, unknown } = await getSiteContext();
  if (unknown || !tenantId) notFound();
  // Die Sprache der Website mitgeben (0474): sie bestimmt, in welcher Sprache
  // der Server die Ausstattungs-Bezeichnungen liefert. Ohne sie antwortet er
  // auf Englisch — und ein dänischer Gast läse englische Merkmale.
  // Das Pfad-Präfix ZUERST, `?lang=` als Altbestand (0476). Ohne diese Zeile
  // lieferte `/da/...` deutschen Inhalt mit Status 200 — der schlimmste Fall,
  // weil er wie ein Erfolg aussieht.
  const sprache = spracheWaehlen(
    branding,
    (await spracheAusPfad()) ?? lang,
  );
  const listing = await ladeInserat(id, { locale: sprache }, tenantId);
  if (!listing) notFound();

  const galerieHues = [0, 20, 40, 60, 80].map((d) => (listing.hue + d) % 360);
  // Für die strukturierten Daten braucht es absolute Adressen — ein relativer
  // Wert in einem JSON-LD ist für Google wertlos.
  const host = await aktuellerHost();

  // Hat der Betrieb eine eigene Objekt-Vorlage gebaut (0468), gilt sie. Sonst
  // bleibt es beim eingebauten Layout darunter.
  //
  // Die Reihenfolge ist Absicht: eine Vorlage ERSETZT das eingebaute Layout,
  // sie ergänzt es nicht. Beides untereinander hieße Galerie, Beschreibung und
  // Buchungsfeld doppelt — und zwar ohne dass jemand sähe, warum.
  const vorlage = host ? await ladeObjektVorlage(host) : null;

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={sprache}
    >
      {host ? (
        <ObjektStrukturierteDaten
          branding={branding}
          basisUrl={basisUrl(host)}
          objekt={listing}
        />
      ) : null}
      {vorlage ? (
        <BlockRenderer
          // Siehe checkout: ohne `modus` fällt der Inhalt auf Deutsch zurück,
          // während Kopf- und Fußzeile in der Gastsprache stehen.
          modus={{ aktiv: false, locale: sprache }}
          blocks={vorlage.blocks}
          tenantId={tenantId}
          objekt={listing}
        />
      ) : (
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {/* Titelzeile */}
        <div className="mb-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {listing.titel}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {listing.bewertung != null && (
              <>
                <span className="flex items-center gap-1 font-medium">
                  <Icon icon="ph:star-fill" className="size-3.5" />
                  {listing.bewertung.toLocaleString("de-DE")}
                </span>
                {listing.anzahlBewertungen != null && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="underline">
                      {listing.anzahlBewertungen} Bewertungen
                    </span>
                  </>
                )}
                <span aria-hidden>·</span>
              </>
            )}
            <span className="text-muted-foreground underline">{listing.ort}</span>
          </div>
        </div>

        {/* Galerie: echte Fotos, sonst Platzhalter */}
        <div
          className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl"
          style={{ height: "26rem" }}
        >
          {listing.fotos.length > 0
            ? listing.fotos.slice(0, 5).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`${listing.titel} – Foto ${i + 1}`}
                  className={`size-full object-cover ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                />
              ))
            : galerieHues.map((hue, i) => (
                <PhotoPlaceholder
                  key={hue}
                  hue={hue}
                  className={i === 0 ? "col-span-2 row-span-2" : "size-full"}
                />
              ))}
        </div>

        {/* Zweispaltig: Inhalt + Buchungs-Widget */}
        <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div className="min-w-0">
            {/* Eckdaten */}
            <div className="border-b border-border pb-6">
              <h2 className="font-display text-xl font-semibold">
                Unterkunft in {listing.ort}
              </h2>
              <p className="mt-1 text-muted-foreground">
                {listing.gaeste} Gäste
                {listing.schlafzimmer != null &&
                  ` · ${listing.schlafzimmer} Schlafzimmer`}
                {listing.baeder != null &&
                  ` · ${listing.baeder} Bad${listing.baeder > 1 ? "er" : ""}`}
              </p>
            </div>

            {/* Beschreibung — nur wenn vorhanden */}
            {listing.beschreibung && (
              <div className="border-b border-border py-6">
                <p className="whitespace-pre-line leading-relaxed text-foreground">
                  {listing.beschreibung}
                </p>
              </div>
            )}

            {/* Ausstattung — nur echte amenities */}
            {listing.ausstattung.length > 0 && (
              <div className="border-b border-border py-6">
                <h2 className="font-display text-xl font-semibold">
                  Das bietet dir diese Unterkunft
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {listing.ausstattung.map((a) => {
                    const meta = AMENITY_META[a];
                    return (
                      <div key={a} className="flex items-center gap-3">
                        <Icon
                          icon={meta?.icon ?? "ph:check-circle"}
                          className="size-5"
                        />
                        <span>{meta?.label ?? a}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lage (ungefähr) */}
            <div className="border-t border-border py-6">
              <h2 className="font-display text-xl font-semibold">Wo du sein wirst</h2>
              <p className="mt-1 text-sm text-muted-foreground">{listing.ort}</p>
              <div className="mt-4 flex h-72 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <Icon icon="ph:map-trifold" className="size-10" />
              </div>
            </div>
          </div>

          {/* Buchungs-Widget */}
          <div className="lg:relative">
            <div className="lg:sticky lg:top-28">
              <BuchungsWidget
                listing={listing}
                sprache={spracheWaehlen(branding, lang)}
                datenschutzPflicht={branding?.privacy_consent === true}
                datenschutzHref={
                  branding?.privacy_policy_slug
                    ? `/${branding.privacy_policy_slug}`
                    : null
                }
                // Kann der Betrieb überhaupt kassieren? Ohne diese Angabe
                // durchlief der Gast die ganze Strecke und scheiterte am
                // Zahlungsschritt mit einem 409.
                zahlungenBereit={branding?.payments_ready === true}
              />
            </div>
          </div>
        </div>
      </div>
      )}
    </SiteShell>
  );
}
