// Merkmale-Abschnitt einer Kunden-Website (0432) — „Was wir bieten".
//
// Symbol + Überschrift + Text in zwei bis vier Spalten. Ersetzt den Fall, für
// den der Betrieb heute drei Rich-Text-Blöcke nebeneinander legen musste.
//
// Das Symbol kommt aus einer festen AUSWAHL und nicht aus einem freien Feld:
// ein beliebiger Wert würde entweder nichts anzeigen (und niemand wüsste,
// warum) oder — als URL — zum Tracking-Pixel auf der Gästeseite. Die Liste
// unten ist die eine Wahrheit; die Oberfläche im Dashboard bietet genau diese
// Schlüssel an.
import { Icon } from "@iconify/react";

import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

/** Erlaubte Symbole und ihr Iconify-Name.
 *
 *  Muss mit `MERKMAL_SYMBOLE` in
 *  `web/components/website/editor/symbol-feld.tsx` deckungsgleich sein — ein
 *  Schlüssel, den nur die Oberfläche kennt, bleibt hier unsichtbar, und einer,
 *  den nur der Renderer kennt, ist unerreichbar.
 *
 *  Die Auswahl ist auf Unterkünfte zugeschnitten: was ein Ferienobjekt oder ein
 *  Hotel wirklich auszeichnet. Ein Katalog mit 200 000 Iconify-Symbolen wäre
 *  keine Auswahl, sondern eine Suchaufgabe. */
const SYMBOLE: Record<string, string> = {
  wlan: "ph:wifi-high",
  parken: "ph:car",
  kueche: "ph:cooking-pot",
  fruehstueck: "ph:coffee",
  pool: "ph:swimming-pool",
  sauna: "ph:thermometer-hot",
  haustiere: "ph:paw-print",
  familie: "ph:users-three",
  fahrrad: "ph:person-simple-bike",
  strand: "ph:umbrella",
  berge: "ph:mountains",
  garten: "ph:tree",
  kamin: "ph:fire",
  waschmaschine: "ph:washing-machine",
  klimaanlage: "ph:wind",
  barrierefrei: "ph:wheelchair",
  schluessel: "ph:key",
  uhr: "ph:clock",
  herz: "ph:heart",
  stern: "ph:star",
  haus: "ph:house-line",
  karte: "ph:map-trifold",
};

/** Iconify-Name zu einem Schlüssel, oder `null`.
 *
 *  `null` heißt: kein Symbol anzeigen. Kein Ersatzsymbol (Wurzel 4) — ein
 *  Fragezeichen oder ein Standard-Stern würde eine Aussage treffen, die der
 *  Betrieb nicht getroffen hat. */
function symbolFuer(wert: unknown): string | null {
  if (typeof wert !== "string") return null;
  return SYMBOLE[wert] ?? null;
}

type Merkmal = { icon?: unknown; title?: unknown; text?: unknown };

export function MerkmaleBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
}) {
  const headline = pickText(content.headline, modus.locale);
  const roh = Array.isArray(content.items) ? (content.items as Merkmal[]) : [];
  // Ein Merkmal braucht mindestens eine Überschrift ODER einen Text. Nur ein
  // Symbol ohne Wort ist keine Aussage.
  const liste = roh
    .map((m) => ({
      symbol: symbolFuer(m.icon),
      titel: pickText(m.title, modus.locale).trim(),
      text: pickText(m.text, modus.locale).trim(),
    }))
    .filter((m) => m.titel || m.text);

  if (liste.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={texte(modus.locale).leerMerkmale}
      />
    );
  }

  const spalten =
    typeof content.columns === "number" &&
    content.columns >= 2 &&
    content.columns <= 4
      ? content.columns
      : 3;
  // Feste Klassen statt eines zusammengesetzten Strings: Tailwind erkennt
  // `grid-cols-${n}` beim Bauen nicht und die Klasse fehlt dann im CSS.
  const rasterKlasse =
    spalten === 2
      ? "sm:grid-cols-2"
      : spalten === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      {headline ? (
        <h2
          {...editierbar(modus, "headline")}
          className="pb-10 text-center font-display text-3xl font-extrabold tracking-tight"
        >
          {headline}
        </h2>
      ) : null}
      <ul className={`grid gap-8 ${rasterKlasse}`}>
        {liste.map((m, i) => (
          <li key={`${m.titel}-${i}`} className="flex flex-col gap-2">
            {m.symbol ? (
              // `aria-hidden`: das Symbol wiederholt die Überschrift daneben.
              // Ohne diese Zeile liest ein Screenreader den Icon-Namen vor.
              <Icon
                icon={m.symbol}
                aria-hidden
                className="size-8 text-primary"
              />
            ) : null}
            {m.titel ? (
              <p className="font-display text-lg font-bold">{m.titel}</p>
            ) : null}
            {m.text ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {m.text}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Die Symbol-Schlüssel für die Prüfskripte und die Oberfläche. */
export const MERKMAL_SYMBOL_SCHLUESSEL = Object.keys(SYMBOLE);
