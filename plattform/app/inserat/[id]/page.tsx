// Inserat-Detailseite — Galerie, Eckdaten, Beschreibung, Bewertungen, Karte
// und seitliches Buchungs-Widget. Eigenes myNextDays-Design; Daten sind
// Platzhalter bis zur Backend-Anbindung.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BuchungsWidget } from "@/components/buchungs-widget";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getListing } from "@/lib/listings";

const HIGHLIGHTS = [
  { icon: "ph:medal", titel: "Erfahrener Gastgeber", text: "Mit viel Erfahrung und durchweg guten Bewertungen." },
  { icon: "ph:map-pin", titel: "Top-Lage", text: "Frühere Gäste lobten die zentrale Lage." },
  { icon: "ph:calendar-x", titel: "Kostenlose Stornierung", text: "Stornierung bis 48 Std. vor Anreise möglich." },
];

const AUSSTATTUNG = [
  { icon: "ph:wifi-high", label: "WLAN" },
  { icon: "ph:cooking-pot", label: "Küche" },
  { icon: "ph:car", label: "Parkplatz" },
  { icon: "ph:television", label: "Smart-TV" },
  { icon: "ph:thermometer", label: "Heizung" },
  { icon: "ph:washing-machine", label: "Waschmaschine" },
];

const BEWERTUNGEN = [
  { name: "Emma", datum: "März 2026", text: "Wunderschöne Wohnung, genau wie beschrieben. Sehr zentral und ruhig zugleich. Gerne wieder!" },
  { name: "Lukas", datum: "Februar 2026", text: "Tolle Gastgeberin, schnelle Kommunikation und ein makelloses Apartment. Klare Empfehlung." },
  { name: "Sophie", datum: "Januar 2026", text: "Die Lage ist unschlagbar, alles fußläufig erreichbar. Sehr sauber und gemütlich eingerichtet." },
  { name: "Noah", datum: "Dezember 2025", text: "Perfekter Aufenthalt. Check-in reibungslos, Ausstattung lässt keine Wünsche offen." },
];

export default async function InseratPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getListing(id);
  if (!listing) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader compact />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        {/* Titelzeile */}
        <div className="mb-4">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {listing.titel}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="flex items-center gap-1 font-medium">
              <Icon icon="ph:star-fill" className="size-3.5" />
              {listing.bewertung.toLocaleString("de-DE")}
            </span>
            <span aria-hidden>·</span>
            <span className="underline">{listing.anzahlBewertungen} Bewertungen</span>
            {listing.istFavorit && (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium">Gäste-Favorit</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="text-muted-foreground underline">{listing.ort}</span>
          </div>
        </div>

        {/* Galerie */}
        <div className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl" style={{ height: "26rem" }}>
          <PhotoPlaceholder hue={listing.hue} className="col-span-2 row-span-2" />
          <PhotoPlaceholder hue={(listing.hue + 20) % 360} className="size-full" />
          <PhotoPlaceholder hue={(listing.hue + 40) % 360} className="size-full" />
          <PhotoPlaceholder hue={(listing.hue + 60) % 360} className="size-full" />
          <PhotoPlaceholder hue={(listing.hue + 80) % 360} className="size-full" label="Alle Fotos anzeigen" />
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
                {listing.gaeste} Gäste · {listing.schlafzimmer} Schlafzimmer ·{" "}
                {listing.baeder} Bad{listing.baeder > 1 ? "er" : ""}
              </p>
            </div>

            {/* Highlights */}
            <div className="flex flex-col gap-5 border-b border-border py-6">
              {HIGHLIGHTS.map((h) => (
                <div key={h.titel} className="flex gap-4">
                  <Icon icon={h.icon} className="mt-0.5 size-6 shrink-0" />
                  <div>
                    <p className="font-medium">{h.titel}</p>
                    <p className="text-sm text-muted-foreground">{h.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Beschreibung */}
            <div className="border-b border-border py-6">
              <p className="leading-relaxed text-foreground">
                Diese stilvoll eingerichtete Unterkunft liegt in zentraler Lage
                von {listing.ort} und bietet alles für einen erholsamen
                Aufenthalt. Helle Räume, eine voll ausgestattete Küche und ein
                gemütlicher Wohnbereich laden zum Wohlfühlen ein. Restaurants,
                Cafés und Sehenswürdigkeiten sind bequem zu Fuß erreichbar.
              </p>
              <button type="button" className="mt-4 font-medium underline">
                Mehr anzeigen
              </button>
            </div>

            {/* Ausstattung */}
            <div className="border-b border-border py-6">
              <h2 className="font-display text-xl font-semibold">
                Das bietet dir diese Unterkunft
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {AUSSTATTUNG.map((a) => (
                  <div key={a.label} className="flex items-center gap-3">
                    <Icon icon={a.icon} className="size-5" />
                    <span>{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bewertungen */}
            <div className="py-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Icon icon="ph:star-fill" className="size-5" />
                {listing.bewertung.toLocaleString("de-DE")} ·{" "}
                {listing.anzahlBewertungen} Bewertungen
              </h2>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                {BEWERTUNGEN.map((b) => (
                  <div key={b.name}>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                        {b.name[0]}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.datum}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-foreground">{b.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Karte (Platzhalter) */}
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
