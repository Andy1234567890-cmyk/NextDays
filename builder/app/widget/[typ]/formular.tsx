"use client";

// Das eigentliche Widget-Formular. Client-Komponente, weil es Eingaben hält —
// aber ohne jeden Netzaufruf: es baut eine Adresse und navigiert dorthin.
//
// Die Navigation verlässt den RAHMEN (`_top` oder `_blank`). Ohne das landete
// die Buchungsstrecke im eingebetteten iframe: ein paar Hundert Pixel hoch, in
// einer fremden Seite, mit einem Zahlungsformular darin. Genau das soll nicht
// passieren.
import { useState } from "react";

export type WidgetTexte = {
  von: string;
  bis: string;
  gaeste: string;
  suchen: string;
  buchen: string;
  reiseziel: string;
};

export function WidgetFormular({
  typ,
  zielHost,
  neuesFenster,
  randKlasse,
  texte,
}: {
  typ: "suche" | "buchen";
  /** Host der Kunden-Website — das Ziel der Navigation. */
  zielHost: string;
  neuesFenster: boolean;
  randKlasse: string;
  texte: WidgetTexte;
}) {
  const [q, setQ] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [gaeste, setGaeste] = useState("");

  const ziel = `https://${zielHost}/`;
  const params = new URLSearchParams();
  if (typ === "suche" && q.trim()) params.set("q", q.trim());
  if (von) params.set("start", von);
  if (bis) params.set("end", bis);
  if (gaeste) params.set("guests", gaeste);
  const qs = params.toString();

  return (
    <form
      action={ziel}
      method="get"
      // `_top` bricht aus dem iframe in das Fenster der Gastgeber-Seite aus,
      // `_blank` öffnet einen neuen Tab. Beide verlassen den Rahmen — was der
      // Kunde im Baukasten wählt, ist nur die Frage, ob seine Besucher die
      // fremde Seite behalten.
      target={neuesFenster ? "_blank" : "_top"}
      rel={neuesFenster ? "noopener" : undefined}
      onSubmit={(e) => {
        // Der Browser würde die Felder selbst als Query anhängen; hier wird die
        // Adresse übernommen, die oben zusammengesetzt ist — sonst hießen die
        // Parameter wie die Formularfelder und nicht wie die Website sie liest.
        e.preventDefault();
        const url = qs ? `${ziel}?${qs}` : ziel;
        if (neuesFenster) window.open(url, "_blank", "noopener");
        else window.top?.location.assign(url);
      }}
      className="flex flex-wrap items-end gap-2 p-3"
    >
      {typ === "suche" ? (
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
          <span className="sr-only">{texte.reiseziel}</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={texte.reiseziel}
            className={`w-full border border-border bg-transparent px-3 py-2 text-sm outline-none ${randKlasse}`}
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{texte.von}</span>
        <input
          type="date"
          value={von}
          onChange={(e) => setVon(e.target.value)}
          aria-label={texte.von}
          className={`border border-border bg-transparent px-3 py-2 text-sm outline-none ${randKlasse}`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{texte.bis}</span>
        <input
          type="date"
          value={bis}
          // Die Abreise kann nicht vor der Anreise liegen. Der Browser setzt das
          // durch, sobald `min` steht — eine eigene Prüfung im JavaScript wäre
          // dieselbe Regel an zweiter Stelle.
          min={von || undefined}
          onChange={(e) => setBis(e.target.value)}
          aria-label={texte.bis}
          className={`border border-border bg-transparent px-3 py-2 text-sm outline-none ${randKlasse}`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{texte.gaeste}</span>
        <input
          type="number"
          min={1}
          max={30}
          value={gaeste}
          onChange={(e) => setGaeste(e.target.value)}
          aria-label={texte.gaeste}
          className={`w-20 border border-border bg-transparent px-3 py-2 text-sm outline-none ${randKlasse}`}
        />
      </label>

      <button
        type="submit"
        className={`btn-marke btn-marke-primaer bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground ${randKlasse}`}
      >
        {typ === "suche" ? texte.suchen : texte.buchen}
      </button>
    </form>
  );
}
