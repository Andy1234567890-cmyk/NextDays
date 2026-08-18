// "Inspirationen für zukünftige Reisen" — Tab-Filter + Raster aus Reiseziel-
// Vorschlägen (Ort + Unterkunftstyp). Struktur angelehnt an gängige Plattform-
// Sektionen, Design = myBestDays. Daten sind Platzhalter bis Backend.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const TABS = ["Beliebt", "An der Küste", "Historisch", "Seenähe", "Berge", "Aktivitäten"];

const ZIELE: Record<string, { ort: string; typ: string }[]> = {
  Beliebt: [
    { ort: "Berlin", typ: "Wohnungen" },
    { ort: "Wien", typ: "Ferienunterkünfte" },
    { ort: "Hamburg", typ: "Häuser" },
    { ort: "München", typ: "Villen" },
    { ort: "Zürich", typ: "Wohnungen" },
    { ort: "Salzburg", typ: "Häuser" },
    { ort: "Köln", typ: "Ferienunterkünfte" },
    { ort: "Frankfurt", typ: "Wohnungen" },
    { ort: "Dresden", typ: "Häuser" },
    { ort: "Leipzig", typ: "Wohnungen" },
    { ort: "Stuttgart", typ: "Villen" },
    { ort: "Bremen", typ: "Wohnungen" },
  ],
  "An der Küste": [
    { ort: "Sylt", typ: "Ferienhäuser" },
    { ort: "Rügen", typ: "Wohnungen" },
    { ort: "Usedom", typ: "Häuser" },
    { ort: "Norderney", typ: "Ferienunterkünfte" },
    { ort: "Timmendorf", typ: "Wohnungen" },
    { ort: "Cuxhaven", typ: "Häuser" },
  ],
  Historisch: [
    { ort: "Rothenburg", typ: "Häuser" },
    { ort: "Bamberg", typ: "Wohnungen" },
    { ort: "Quedlinburg", typ: "Ferienunterkünfte" },
    { ort: "Heidelberg", typ: "Wohnungen" },
    { ort: "Regensburg", typ: "Häuser" },
    { ort: "Görlitz", typ: "Wohnungen" },
  ],
  Seenähe: [
    { ort: "Tegernsee", typ: "Ferienhäuser" },
    { ort: "Bodensee", typ: "Wohnungen" },
    { ort: "Chiemsee", typ: "Häuser" },
    { ort: "Wörthersee", typ: "Villen" },
    { ort: "Starnberger See", typ: "Häuser" },
    { ort: "Königssee", typ: "Ferienunterkünfte" },
  ],
  Berge: [
    { ort: "Zermatt", typ: "Chalets" },
    { ort: "Garmisch", typ: "Ferienhäuser" },
    { ort: "Innsbruck", typ: "Wohnungen" },
    { ort: "Berchtesgaden", typ: "Häuser" },
    { ort: "Oberstdorf", typ: "Ferienunterkünfte" },
    { ort: "Davos", typ: "Wohnungen" },
  ],
  Aktivitäten: [
    { ort: "Willingen", typ: "Ferienhäuser" },
    { ort: "Winterberg", typ: "Wohnungen" },
    { ort: "Saalbach", typ: "Häuser" },
    { ort: "Ischgl", typ: "Wohnungen" },
    { ort: "Kitzbühel", typ: "Villen" },
    { ort: "Sölden", typ: "Ferienunterkünfte" },
  ],
};

// Mobil erst sechs Ziele: 12 Städte in zwei Spalten sind dort zwei
// Bildschirmlängen, bevor die Fußzeilen-Links überhaupt anfangen.
const MOBIL_LIMIT = 6;

export function ReiseInspirationen() {
  const t = useTranslations("mobil");
  const [aktiv, setAktiv] = useState(TABS[0]);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const ziele = ZIELE[aktiv] ?? [];
  const mehrVorhanden = ziele.length > MOBIL_LIMIT;

  return (
    <section>
      <div className="w-full px-4 py-8 sm:px-6 sm:py-12 md:px-10 2xl:px-20">
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          Inspirationen für zukünftige Reisen
        </h2>

        {/* Tab-Filter — Unterstreichung nur beim aktiven Tab. Mobil wischbar
            mit Schnapp-Punkten und ohne sichtbaren Scrollbalken (der lief
            vorher als grauer Streifen quer unter den Tabs durch). */}
        <div className="band-scroll -mx-4 mt-4 flex snap-x gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setAktiv(tab);
                setAlleZeigen(false);
              }}
              className={
                "min-h-11 min-w-11 shrink-0 snap-start border-b-2 pb-3 text-center text-sm font-medium transition-colors " +
                (aktiv === tab
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Ziel-Raster. Die Ziele sind Platzhalter bis zum Backend, deshalb
            bewusst OHNE Link-Ziel: ein `href="#"` sähe wie Navigation aus und
            täte nichts. */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 sm:gap-y-5 lg:grid-cols-6">
          {ziele.map((ziel, i) => (
            <div
              key={`${ziel.ort}-${ziel.typ}`}
              className={
                !alleZeigen && i >= MOBIL_LIMIT ? "hidden sm:block" : ""
              }
            >
              <p className="text-sm font-semibold">{ziel.ort}</p>
              <p className="text-sm text-muted-foreground">{ziel.typ}</p>
            </div>
          ))}
        </div>

        {mehrVorhanden && (
          <button
            type="button"
            onClick={() => setAlleZeigen((v) => !v)}
            className="mt-4 flex min-h-11 items-center gap-1 text-sm font-medium underline sm:hidden"
          >
            {alleZeigen ? t("wenigerAnzeigen") : t("mehrAnzeigen")}
          </button>
        )}
      </div>
    </section>
  );
}
