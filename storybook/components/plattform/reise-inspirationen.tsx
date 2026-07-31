// "Inspirationen für zukünftige Reisen" — Tab-Filter + Raster aus Reiseziel-
// Vorschlägen (Ort + Unterkunftstyp). Struktur angelehnt an gängige Plattform-
// Sektionen, Design = myBestDays. Daten sind Platzhalter bis Backend.
"use client";

import { useState } from "react";

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

export function ReiseInspirationen() {
  const [aktiv, setAktiv] = useState(TABS[0]);
  const ziele = ZIELE[aktiv] ?? [];

  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Inspirationen für zukünftige Reisen
        </h2>

        {/* Tab-Filter — Unterstreichung nur beim aktiven Tab */}
        <div className="mt-4 flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setAktiv(tab)}
              className={
                "shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors " +
                (aktiv === tab
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Ziel-Raster */}
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          {ziele.map((ziel) => (
            <a key={`${ziel.ort}-${ziel.typ}`} href="#" className="group">
              <p className="text-sm font-semibold group-hover:underline">
                {ziel.ort}
              </p>
              <p className="text-sm text-muted-foreground">{ziel.typ}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
