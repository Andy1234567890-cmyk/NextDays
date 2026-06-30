// Inserat-Detailseite — Galerie, Eckdaten, Beschreibung, Ausstattung, Lage
// und seitliches Buchungs-Widget. Daten aus dem Backend (booking_engine,
// nur active Objekte). Keine erfundenen Bewertungen/Texte.
import { Icon } from "@iconify/react";
import { notFound } from "next/navigation";

import { BuchungsWidget } from "@/components/buchungs-widget";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ladeInserat } from "@/lib/inserate";
import { getSiteContext } from "@/lib/site-context";

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

export default async function InseratPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // tenant-gescoped: ein fremdes Inserat liefert mit ?tenant= aus dem Backend
  // 404 → notFound (kein Cross-Tenant-Zugriff über die Direkt-URL).
  const { tenantId, branding, unknown } = await getSiteContext();
  if (unknown || !tenantId) notFound();
  const listing = await ladeInserat(id, {}, tenantId);
  if (!listing) notFound();

  const galerieHues = [0, 20, 40, 60, 80].map((d) => (listing.hue + d) % 360);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        logoSrc={branding?.logo_url}
        logoAlt={branding?.site_name}
        siteName={branding?.site_name}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
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
              <BuchungsWidget listing={listing} />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
