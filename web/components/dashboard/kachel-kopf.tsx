"use client";

// Die Kopfzeile JEDER Dashboard-Kachel: links Icon + Titel (+ optional der
// Info-Punkt), rechts der Zeitraum-Selektor oder ein festes Abzeichen.
//
// WARUM EINE GEMEINSAME KOMPONENTE (03.09.2026)
// =============================================
// Dieselben zwölf Klassen standen fünfmal kopiert (kpi-kachel, listen-karte,
// ungelesen-karte, eigentuemer-kachel, objekt-kachel) — und mit ihnen fünfmal
// derselbe Layout-Fehler: die linke Gruppe war nicht schrumpfbar und der
// Titel trug `whitespace-nowrap`. Auf schmalen Karten schob der Titel damit
// den Selektor aus der Karte HERAUS statt selbst zu kürzen. Gemessen an der
// echten Kopfzeile: bei 260 rem/16 Kartenbreite standen sechs von zehn Pillen
// 13-67 px ausserhalb des Kartenrands, "Umsatz je Buchung" schon ab 300 px.
//
// Der Fix gehoert an EINE Stelle, sonst faellt beim naechsten Kachel-Zuwachs
// die sechste Kopie durch: `min-w-0` auf der linken Gruppe macht sie
// schrumpfbar (ohne das ist die flex-Mindestbreite der Inhalt selbst), und
// `truncate` auf dem Titel kuerzt IHN statt den Nachbarn zu verdraengen.
// Der volle Titel bleibt ueber `title=` und den Info-Punkt erreichbar.
import { Icon } from "@iconify/react";
import type { ReactNode } from "react";

/** Fester Zustands-Hinweis auf einer Karte, die keinen Zeitraum kennt. Wo es
 *  einen Zeitraum GIBT, steht an dieser Stelle ein Selektor, kein Text. */
export function PeriodBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

export function KachelKopf({
  icon,
  title,
  /** Groesse des Icons und des Titels. Die Kennzahl-Kacheln tragen den
   *  kleineren Satz, die Listen-/Bestandskacheln den groesseren. */
  gross = false,
  /** Der Info-Punkt (`InfoHinweis`) — als Knoten uebergeben, damit diese
   *  Komponente nichts ueber Popover-Texte wissen muss. */
  info,
  /** Rechte Seite: Selektor oder Abzeichen. Beide sind bereits `shrink-0`. */
  rechts,
}: {
  icon: string;
  title: string;
  gross?: boolean;
  info?: ReactNode;
  rechts?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      {/* `min-w-0` ist der Kern: ohne das kann diese Gruppe nicht unter ihre
          Inhaltsbreite schrumpfen und schiebt `rechts` aus der Karte. */}
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <Icon
          icon={icon}
          className={`${gross ? "size-5" : "size-4"} shrink-0`}
        />
        {/* `truncate` statt `whitespace-nowrap`: der Titel kuerzt sich selbst,
            bleibt einzeilig (kein Umbruch, sonst werden die Karten einer Reihe
            unterschiedlich hoch) und gibt den vollen Text im `title` zurueck. */}
        <h3
          className={`truncate font-semibold text-foreground ${
            gross ? "" : "text-sm"
          }`}
          title={title}
        >
          {title}
        </h3>
        {info}
      </div>
      {rechts}
    </div>
  );
}
