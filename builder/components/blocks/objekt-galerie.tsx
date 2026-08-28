"use client";

// Das Fotoraster der Objektseite, mit Weg zu ALLEN Fotos (0474).
//
// DER BEFUND
// Das Raster zeigte, was `max_images` erlaubte, und schnitt den Rest ab. Bei der
// Vorlage „klassisch" sind das fünf Bilder — ein Objekt hat aber oft zwanzig,
// und die übrigen fünfzehn waren auf der Website nicht erreichbar. Für einen
// Gast ist „alle Fotos ansehen" die häufigste Handlung auf einer Objektseite;
// ohne sie fehlt der halbe Eindruck, und niemand sieht, DASS etwas fehlt.
//
// EIGENE DATEI, WEIL CLIENT
// `objekt-blocks.tsx` ist eine Server-Komponente. Die Lightbox ist Zustand im
// Browser (welches Bild, offen/zu, Tastatur) und braucht `"use client"`. Die
// ganze Datei umzustellen hieße, vier Bausteine ohne Not in den Browser zu
// schicken, die dort nichts zu tun haben.
//
// DIE LIGHTBOX IST GETEILT
// `lichtkasten.tsx` — dieselbe, die der Galerie-Baustein nutzt. Eine zweite
// Fassung hier wäre die Doppelung, gegen die Wurzel 2 steht.
//
// WAS `max_images` JETZT BEDEUTET
// Es begrenzt das RASTER, nicht die Galerie. Vorher begrenzte es beides — die
// Einstellung „zeige 5 Bilder" hieß also „lösche 15 Bilder von der Website".
// Das war nie gemeint: Hostaway nennt dasselbe Feld „images in grid".
import { Icon } from "@iconify/react";
import { useState } from "react";

import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import type { Listing } from "@/lib/listings";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";
import { Lichtkasten } from "./lichtkasten";

function zahl(v: unknown, standard: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : standard;
}

export function ObjektGalerieBlock({
  content,
  modus = NICHT_EDITIERBAR,
  objekt = null,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  objekt?: Listing | null;
}) {
  const t = texte(modus.locale);
  const [offen, setOffen] = useState<number | null>(null);

  // ALLE Fotos des Objekts — sie füllen die Lightbox.
  const alle = objekt?.fotos ?? [];
  if (alle.length === 0) {
    return <AbschnittLeer modus={modus} grund={t.leerObjektGalerie} />;
  }

  const imRaster = zahl(content.max_images, 12);
  const fotos = alle.slice(0, imRaster);
  // Nur wenn wirklich mehr da ist. Ein „Alle Fotos (5)"-Knopf neben fünf
  // sichtbaren Bildern führt ins selbe Bild und ist eine Attrappe.
  const weitere = alle.length - fotos.length;
  const schieber = content.layout === "slider";
  const mitLightbox = content.lightbox !== false;

  const bilder = alle.map((url, i) => ({
    url,
    // Der Alt-Text ist der Objektname mit Zählung. Ein leerer Alt-Text wäre für
    // einen Vorleser eine Reihe stummer Bilder; ein erfundener Bildinhalt
    // („Wohnzimmer") wäre eine Behauptung über etwas, das niemand geprüft hat.
    alt: `${objekt?.titel ?? ""} ${i + 1}`.trim(),
  }));

  return (
    <section className="relative mx-auto max-w-6xl px-6 py-10">
      <div
        className={
          schieber
            ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
            : "grid grid-cols-2 gap-3 md:grid-cols-3"
        }
      >
        {fotos.map((url, i) => {
          const kachel = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={bilder[i]!.alt}
              loading={i < 3 ? "eager" : "lazy"}
              className={
                "h-56 w-full rounded-(--radius) object-cover " +
                (schieber ? "min-w-72 snap-start" : "")
              }
            />
          );
          if (!mitLightbox) return <div key={url}>{kachel}</div>;
          return (
            <button
              key={url}
              type="button"
              onClick={() => setOffen(i)}
              aria-label={t.galerieVergroessern}
              className={
                "group relative overflow-hidden rounded-(--radius) " +
                (schieber ? "min-w-72 shrink-0 snap-start" : "")
              }
            >
              {kachel}
            </button>
          );
        })}

        {/* Der Weg zu den übrigen Fotos — als KACHEL im Raster, nicht als
            Knopf darunter.
            Der Grund ist die letzte Reihe: bei fünf Bildern in drei Spalten
            bleibt rechts ein Loch, und ein Knopf unter dem Raster lässt es
            offen stehen. In der Lücke sitzt er dort, wo der Gast ohnehin
            hinsieht, und das Raster ist vollständig — dasselbe, was Airbnb und
            Booking an dieser Stelle tun.
            Er trägt die ZAHL: „Alle anzeigen" allein sagt nicht, ob zwei oder
            vierzig folgen. */}
        {mitLightbox && weitere > 0 ? (
          <button
            type="button"
            onClick={() => setOffen(0)}
            // KEIN `btn-marke`: die Klasse setzt `border-radius: 9999px`
            // (Repo-Vorgabe „Buttons oval") und machte aus der Kachel einen
            // Kreis. Sie ist hier auch fachlich falsch — dieses Element ist
            // eine BILDFLÄCHE, die sich anklicken lässt, kein Button in einer
            // Textzeile. Es folgt deshalb der Form der Bilder daneben
            // (`rounded-(--radius)`, dieselbe Ecke wie jede Kachel).
            className={
              "flex h-56 w-full flex-col items-center justify-center gap-2 " +
              "rounded-(--radius) border border-border bg-secondary text-sm font-medium " +
              "transition hover:bg-secondary/70 " +
              (schieber ? "min-w-72 shrink-0 snap-start" : "")
            }
          >
            <Icon icon="ph:images-square" className="size-7" />
            {t.objektAlleFotos.replace("{anzahl}", String(alle.length))}
          </button>
        ) : null}
      </div>


      {mitLightbox ? (
        <Lichtkasten
          bilder={bilder}
          offen={offen}
          onOffen={setOffen}
          sprache={modus.locale}
        />
      ) : null}
    </section>
  );
}
