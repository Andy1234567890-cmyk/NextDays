// Themen-Reihe für die Suchseite — Überschrift + horizontal scrollbares Band
// aus Inserat-Karten + Pfeil-Buttons zum Durchblättern + "Alle anzeigen".
// Eigenes myBestDays-Design.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRef } from "react";
import { useTranslations } from "next-intl";

import { type Reihe, type ReihenTitel } from "@/lib/listings";

import { ListingCard } from "./listing-card";
import { PhotoPlaceholder } from "./photo-placeholder";

// Seitenabstand der Seite (identisch in Kopfzeile, Reihen und Fuß) und dessen
// Ausgleich für das randlos scrollende Band.
const RAND_AUSGLEICH =
  "-mx-4 px-4 scroll-px-4 sm:-mx-6 sm:px-6 sm:scroll-px-6 md:-mx-10 md:px-10 md:scroll-px-10 2xl:-mx-20 2xl:px-20 2xl:scroll-px-20";

// Wie viele Karten nebeneinander passen — dieselbe Staffelung wie bei den
// großen Portalen: auf sehr breiten Bildschirmen sieben. Die Breite ist ein
// Anteil der Zeile abzüglich der Abstände (gap-5 = 1,25rem).
//
// Mobil bewusst KEIN glatter Anteil: bei exakt zwei Karten endet das Band
// bündig am Rand und sieht aus wie ein zweispaltiges Raster — nichts deutet an,
// dass es seitlich weitergeht. 43 % ergeben ZWEI vollständige Karten plus einen
// Anschnitt der dritten; genau diese Staffelung hat das Vorbild mobil (dort
// ~144 px Karte bei ~333 px Bildschirm). 78 % waren zu breit: eine Karte füllte
// die Zeile fast allein, und man sah pro Wisch nur ein Objekt.
const KARTE = [
  "w-[43%]",
  "sm:w-[calc((100%-2.5rem)/3)]",
  "md:w-[calc((100%-3.75rem)/4)]",
  "lg:w-[calc((100%-5rem)/5)]",
  "xl:w-[calc((100%-6.25rem)/6)]",
  "2xl:w-[calc((100%-7.5rem)/7)]",
].join(" ");

/** Überschrift einer Reihe in der Gast-Sprache. Objekttypen haben eigene
 *  Labels; ein unbekannter Typ (neuer Enum-Wert ohne Label) zeigt „Unterkünfte"
 *  statt des rohen Enum-Werts — der fehlende Key ist ein Datenfehler, keine
 *  Anzeige für den Gast. */
function useReihenTitel(): (titel: ReihenTitel) => string {
  const t = useTranslations("suche");
  return (titel) => {
    if (titel.art === "beliebt") return t("reiheBeliebt");
    if (titel.art === "stadt") return t("reiheStadt", { stadt: titel.stadt });
    const key = `objekttyp.${titel.typ}`;
    return t.has(key) ? t(key) : t("objekttypAllgemein");
  };
}

export function ListingReihe({
  reihe,
  eingeloggt = false,
}: {
  reihe: Reihe;
  eingeloggt?: boolean;
}) {
  const reihenTitel = useReihenTitel();
  const t = useTranslations("suche");
  const bandRef = useRef<HTMLDivElement>(null);
  // Foto-Stack der "Alle anzeigen"-Karte zeigt die ersten 3 Inserate der Reihe.
  const stapel = reihe.listings.slice(0, 3);
  // Ziel der „Alle anzeigen"-Karte: nur Stadt-Reihen lassen sich als Suche
  // ausdrücken (?q=<stadt>). Für „beliebt" und Objekttyp-Reihen kennt der
  // booking_engine-Endpoint keinen Filter — dort gibt es die Karte nicht,
  // statt sie ins Leere zeigen zu lassen (Wurzel 4: kein erfundenes Ziel).
  const alleZiel =
    reihe.titel.art === "stadt"
      ? `/?q=${encodeURIComponent(reihe.titel.stadt)}`
      : null;

  function scroll(richtung: -1 | 1) {
    const el = bandRef.current;
    if (!el) return;
    el.scrollBy({ left: richtung * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="group/reihe py-4 sm:py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="min-w-0 truncate font-display text-lg font-semibold tracking-tight sm:text-xl">
          {reihenTitel(reihe.titel)}
        </h2>
        <div className="flex items-center gap-3">
          {/* Pfeil-Buttons (erscheinen beim Hover über der Reihe) */}
          <div className="flex items-center gap-1 transition-opacity md:opacity-0 md:group-hover/reihe:opacity-100">
            <button
              type="button"
              aria-label="Zurück"
              onClick={() => scroll(-1)}
              className="flex size-10 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-secondary md:size-8"
            >
              <Icon icon="ph:caret-left" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Weiter"
              onClick={() => scroll(1)}
              className="flex size-10 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-secondary md:size-8"
            >
              <Icon icon="ph:caret-right" className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Das Band nutzt die volle Breite (Airbnb-Muster): die Kartenbreite ergibt
          sich aus der Zeilenbreite, nicht aus einem festen Wert — sonst bleibt
          auf großen Bildschirmen die halbe Fläche leer. Der negative Rand hebt
          den Seitenabstand auf, damit die Karten bis an die Kante scrollen und
          trotzdem bündig unter der Überschrift beginnen. */}
      <div
        ref={bandRef}
        className={`flex snap-x gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${RAND_AUSGLEICH}`}
      >
        {reihe.listings.map((listing) => (
          <div key={listing.id} className={`shrink-0 snap-start ${KARTE}`}>
            <ListingCard listing={listing} eingeloggt={eingeloggt} />
          </div>
        ))}

        {/* Letzte Karte: gleicher Aufbau wie eine Inserat-Karte (quadratisches
            Bildfeld oben), nur mit Foto-Stack statt Bild und freiem Textbereich.
            Sie erscheint NUR bei Stadt-Reihen, weil nur die ein echtes Ziel
            haben (?q=<stadt>). Vorher hing an ihr `href="#"` — mobil ein toter
            Block über 78 % der Zeilenbreite. */}
        {alleZiel && (
        <Link
          href={alleZiel}
          className={`group/alle flex shrink-0 snap-start flex-col gap-3 ${KARTE}`}
        >
          <div className="flex aspect-square flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-border bg-secondary">
            <div className="flex items-end justify-center">
              {stapel[0] && (
                <PhotoPlaceholder
                  hue={stapel[0].hue}
                  className="size-16 -rotate-6 rounded-xl border-2 border-card shadow-md"
                />
              )}
              {stapel[1] && (
                <PhotoPlaceholder
                  hue={stapel[1].hue}
                  className="-mx-3 size-20 rounded-xl border-2 border-card shadow-md transition-transform group-hover/alle:scale-105"
                />
              )}
              {stapel[2] && (
                <PhotoPlaceholder
                  hue={stapel[2].hue}
                  className="size-16 rotate-6 rounded-xl border-2 border-card shadow-md"
                />
              )}
            </div>
            <span className="font-semibold">{t("alleAnzeigen")}</span>
          </div>
        </Link>
        )}

        {/* Endabstand, damit die letzte Karte nicht hart an der Kante klebt */}
        <div className="w-2 shrink-0" aria-hidden />
      </div>
    </section>
  );
}
