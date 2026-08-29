// Leerzustand einer Liste oder Seite — der eine Baustein für alle Bereiche.
//
// WARUM GETEILT: vorher gab es drei lokale, nicht exportierte `EmptyState`-
// Funktionen (Objekte, Angebote, Kunden) und daneben nackte Textzeilen in
// Tabellen; Kalender und Aufgaben hatten gar nichts — ein Betrieb ohne Objekte
// sah dort ein leeres Raster ohne ein Wort Erklärung.
//
// ZWEI FORMEN, EINE KOMPONENTE:
//   ohne `vorschau`  → zentrierte Karte (die bisherige Form, unverändert)
//   mit  `vorschau`  → zweispaltig: links Text und Aktion, rechts eine
//                      Produktvorschau auf ruhiger Fläche
// Die zweite Form ist für Seiten, deren Nutzen man SIEHT (Kalender, Posteingang):
// ein Bild des gefüllten Zustands erklärt in einer Sekunde, was drei Sätze
// nicht schaffen. Für eine leere Kundenliste wäre sie Aufwand ohne Gewinn.
//
// Die Vorschau ist bewusst KEIN Bild-Prop mit Pfad, sondern beliebiger Inhalt:
// wir zeichnen sie als SVG in Token-Farben, damit sie dem Hell-/Dunkel-Modus
// folgt und bei jeder UI-Änderung nicht neu fotografiert werden muss.
import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

import { Card } from "./card";
import { cn } from "./utils";

export function EmptyState({
  icon,
  eyebrow,
  titel,
  text,
  aktion,
  fussnote,
  vorschau,
  className,
}: {
  /** Phosphor-Name, z. B. "ph:calendar-blank". */
  icon: string;
  /** Kurze Bereichsbezeichnung über dem Titel (nur in der Vorschau-Form). */
  eyebrow?: string;
  titel: string;
  text: string;
  /** Genau EINE Hauptaktion — mehr macht die Entscheidung schwerer, nicht leichter. */
  aktion?: ReactNode;
  /** Nebenweg für den Fall, dass die Hauptaktion nicht passt („kein Airbnb-Konto?"). */
  fussnote?: ReactNode;
  /** Produktvorschau; ist sie gesetzt, wird zweispaltig gerendert. */
  vorschau?: ReactNode;
  className?: string;
}) {
  if (!vorschau) {
    return (
      <Card
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-12 text-center",
          className,
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <Icon icon={icon} aria-hidden className="size-7 text-muted-foreground" />
        </span>
        <div>
          <p className="font-display text-lg font-extrabold">{titel}</p>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
        {aktion}
        {fussnote ? (
          <p className="text-sm text-muted-foreground">{fussnote}</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "grid items-center gap-8 p-8 lg:grid-cols-[1fr_1.15fr] lg:p-12",
        className,
      )}
    >
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon icon={icon} aria-hidden className="size-4" />
          {eyebrow ?? titel}
        </p>
        <p className="font-display text-2xl font-extrabold text-balance">
          {titel}
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">{text}</p>
        {aktion ? <div className="mt-5">{aktion}</div> : null}
        {fussnote ? (
          <p className="mt-3 text-sm text-muted-foreground">{fussnote}</p>
        ) : null}
      </div>
      {/* `aria-hidden`: die Vorschau zeigt erfundene Beispieldaten. Vorgelesen
          klänge sie wie echter Bestand des Betriebs. */}
      <div
        aria-hidden
        className="grid place-items-center rounded-(--radius) bg-secondary p-5"
      >
        {vorschau}
      </div>
    </Card>
  );
}
