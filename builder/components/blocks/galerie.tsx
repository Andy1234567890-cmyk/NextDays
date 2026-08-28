"use client";

// Bildergalerie mit Lightbox (0087, erweitert 0451).
//
// Die Galerie lag bis 0451 in `simple-blocks.tsx` und war eine reine
// Server-Komponente. Sie ist HIERHER GEZOGEN und nicht kopiert worden: zwei
// Galerien im Katalog wären eine Frage gewesen, die niemand beantworten kann,
// und eine zweite Fassung derselben Daten wäre irgendwann auseinandergelaufen.
//
// Warum jetzt eine Client-Komponente: die Lightbox ist Zustand im Browser
// (welches Bild ist offen). Ein `<dialog>` allein täte es fast — aber es
// braucht `showModal()`, also ohnehin JavaScript, und der Wechsel zum
// nächsten/vorherigen Bild mit den Pfeiltasten kommt nur so zustande.
//
// Was die Lightbox ABSICHTLICH mitbringt und was oft fehlt:
//   · Escape schließt (bringt `<dialog>` von selbst mit)
//   · Klick auf den Hintergrund schließt
//   · Pfeiltasten blättern
//   · der Fokus liegt beim Öffnen im Dialog und kehrt beim Schließen zurück
//     (ebenfalls `<dialog>`)
//   · `alt` und Beschriftung wandern mit — ein vergrößertes Bild ohne
//     Beschreibung ist für einen Screenreader-Nutzer eine leere Fläche
import { useState } from "react";

import { Icon } from "@iconify/react";

import type { BildLaden } from "@/lib/bilder";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";
import { BildNachweis } from "./bildnachweis";
import { Lichtkasten } from "./lichtkasten";

type Bild = {
  url: string;
  alt: string;
  titel: string;
  text: string;
  href: string | null;
};

/** Spaltenzahl → feste Tailwind-Klasse.
 *
 *  Feste Namen und keine Zusammensetzung: Tailwind erkennt `md:grid-cols-${n}`
 *  beim Bauen nicht, und die Klasse fehlt dann im CSS — der Abschnitt sähe
 *  einspaltig aus, ohne dass im Code ein Fehler steht. Genau derselbe Grund
 *  wie bei den Abstands-Klassen im Block-Renderer. */
const SPALTEN: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-5",
};

export function GalerieBlock({
  content,
  modus = NICHT_EDITIERBAR,
  laden = "lazy",
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  laden?: BildLaden;
}) {
  // Hooks stehen VOR jedem frühen Return — ein Hook hinter einer Bedingung ist
  // der Fehler, den ESLint hier zu Recht meldet (rules-of-hooks).
  const [offen, setOffen] = useState<number | null>(null);

  const roh = Array.isArray(content.images)
    ? (content.images as Array<Record<string, unknown>>)
    : [];
  const bilder: Bild[] = roh
    .filter((b) => typeof b.url === "string" && b.url)
    .map((b) => ({
      url: b.url as string,
      alt: pickText(b.alt, modus.locale),
      titel: pickText(b.title, modus.locale).trim(),
      text: pickText(b.description, modus.locale).trim(),
      href: typeof b.href === "string" ? b.href : null,
    }));

  // Bild-Links und Lightbox schließen einander aus: ein Bild kann nicht
  // gleichzeitig vergrößern und woandershin führen. Hostaway löst denselben
  // Konflikt mit demselben Vorrang („This disables the lightbox feature").
  const alsLinks = content.enable_links === true;
  const mitLightbox = !alsLinks && content.lightbox !== false;

  if (bilder.length === 0) {
    return (
      <AbschnittLeer modus={modus} grund={texte(modus.locale).leerGalerie} />
    );
  }

  const spalten =
    typeof content.columns === "number" && SPALTEN[content.columns]
      ? SPALTEN[content.columns]!
      : SPALTEN[3]!;
  const zeigeText = content.show_captions === true;
  const t = texte(modus.locale);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className={`grid gap-4 ${spalten}`}>
        {bilder.map((b, i) => {
          const kachel = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.url}
                alt={b.alt}
                // Nur das ERSTE Bild folgt der Ladeeinstellung der Website; alle
                // weiteren laden beim Scrollen. Eine Galerie mit 100 Bildern
                // sofort zu laden wäre der eine Fall, in dem der Schalter nichts
                // retten könnte.
                loading={i === 0 ? laden : "lazy"}
                fetchPriority={i === 0 && laden === "eager" ? "high" : undefined}
                className="aspect-square size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {mitLightbox ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <Icon icon="ph:magnifying-glass-plus" className="size-4" />
                </span>
              ) : null}
            </>
          );
          return (
            <figure key={`${b.url}-${i}`} className="flex flex-col gap-2">
              {alsLinks && b.href ? (
                <a
                  href={b.href}
                  className="group relative overflow-hidden rounded-2xl"
                >
                  {kachel}
                </a>
              ) : mitLightbox ? (
                <button
                  type="button"
                  onClick={() => setOffen(i)}
                  aria-label={b.alt || b.titel || t.galerieVergroessern}
                  className="group relative cursor-zoom-in overflow-hidden rounded-2xl"
                >
                  {kachel}
                </button>
              ) : (
                <span className="group relative block overflow-hidden rounded-2xl">
                  {kachel}
                </span>
              )}
              {/* Beschriftungen erscheinen nur, wenn der Betrieb sie
                  eingeschaltet hat — sonst hinterließe der Textbereich unter
                  jedem Bild Luft, auch wenn nichts drinsteht (genau das
                  beschreibt Hostaway: „space will remain in the widget"). */}
              {zeigeText && (b.titel || b.text) ? (
                <figcaption className="px-1">
                  {b.titel ? (
                    <span className="block text-sm font-semibold">
                      {b.titel}
                    </span>
                  ) : null}
                  {b.text ? (
                    <span className="block text-sm text-muted-foreground">
                      {b.text}
                    </span>
                  ) : null}
                </figcaption>
              ) : null}
              {/* Pflicht-Nachweis der Stock-Quelle, unter der Kachel. Nicht als
                  Auflage IM Bild: die Kacheln sind quadratisch beschnitten und
                  oft klein, ein Balken darin waere unlesbar. */}
              <BildNachweis src={b.url} variante="zeile" />
            </figure>
          );
        })}
      </div>

      {/* Die Lightbox liegt seit 0474 in `lichtkasten.tsx` — dieselbe, die
          die Objektseite nutzt. Vorher stand ihr Markup hier, und die
          Objektseite hatte gar keine (Wurzel 2: die zweite Fassung ist die,
          die beim nächsten Fehler niemand findet). */}
      {mitLightbox ? (
        <Lichtkasten
          bilder={bilder}
          offen={offen}
          onOffen={setOffen}
          sprache={modus.locale}
        />
      ) : null}
    </div>
  );
}
