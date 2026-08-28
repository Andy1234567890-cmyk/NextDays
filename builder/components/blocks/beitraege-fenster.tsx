"use client";

// Das Blättern der Beitragsliste (0457).
//
// Warum ein Client-Stück in einem Server-Abschnitt: der Gast soll weiterblättern
// können, ohne dass die Seite neu lädt — und die Karten sollen trotzdem
// serverseitig gerendert bleiben (Bilder, Datumsformat, Links). Deshalb kommen
// hier FERTIGE Kinder herein und werden nur ausgeschnitten. Diese Komponente
// holt nichts nach und weiß nichts über Beiträge.
//
// Warum nicht über die Adresse (`?seite=2`): dieser Abschnitt steht auf einer
// beliebigen Seite, oft mehrfach. Ein gemeinsamer Parameter würde zwei
// Abschnitte gleichzeitig weiterblättern, ein eigener je Abschnitt bräuchte
// eine Kennung in der Adresse — beides ist mehr Mechanik, als eine Kachel auf
// der Startseite wert ist. Die Blog-Seite `/blog` blättert dagegen über die
// Adresse, denn dort ist die Seitenzahl ein Ort, den man verschicken kann.
import { Children, useState } from "react";

export function BeitraegeFenster({
  children,
  proFenster,
  navigation,
  mehrText,
  listenKlasse,
  listenStil,
}: {
  children: React.ReactNode;
  /** Wie viele Beiträge gleichzeitig sichtbar sind. */
  proFenster: number;
  navigation: "none" | "button" | "pages";
  mehrText: string;
  listenKlasse: string;
  /** Stile, die sich nicht als Klasse ausdrücken lassen — der Spaltenabstand
   *  von `masonry` ist eine Länge, und Tailwind findet `gap-[2rem]` mit einem
   *  berechneten Wert beim Bauen nicht. */
  listenStil?: React.CSSProperties;
}) {
  const alle = Children.toArray(children);
  // `fenster` zählt die SICHTBAREN Fenster beim Knopf (kumulativ) und ist beim
  // Seitenzahl-Modus die aktuelle Seite. Ein Zustand für beides, weil immer nur
  // eine Betriebsart aktiv ist.
  const [fenster, setFenster] = useState(1);
  const seiten = Math.max(1, Math.ceil(alle.length / proFenster));

  const sichtbar =
    navigation === "none"
      ? alle.slice(0, proFenster)
      : navigation === "button"
        ? alle.slice(0, proFenster * fenster)
        : alle.slice((fenster - 1) * proFenster, fenster * proFenster);

  return (
    <>
      <ul className={listenKlasse} style={listenStil}>
        {sichtbar}
      </ul>

      {navigation === "button" && sichtbar.length < alle.length ? (
        <div className="flex justify-center pt-8">
          <button
            type="button"
            onClick={() => setFenster((f) => f + 1)}
            className="rounded-full border border-border px-5 py-2 text-sm font-semibold transition hover:bg-secondary"
          >
            {mehrText}
          </button>
        </div>
      ) : null}

      {navigation === "pages" && seiten > 1 ? (
        <div className="flex flex-wrap justify-center gap-2 pt-8">
          {Array.from({ length: seiten }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFenster(n)}
              aria-current={n === fenster ? "page" : undefined}
              className={
                "size-9 rounded-full border text-sm transition " +
                (n === fenster
                  ? "border-foreground bg-secondary font-semibold"
                  : "border-border hover:bg-secondary")
              }
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
