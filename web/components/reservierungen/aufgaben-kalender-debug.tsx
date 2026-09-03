"use client";

// Debugging der Aufgaben-Zeitachse — warum eine Pille wo steht.
//
// WARUM DIESES PANEL (03.09.2026): Die Zeitachse zeigte Aufgaben „kreuz und
// quer" — der Anreisecheck links neben seiner Buchung, die Reinigung einen Tag
// dahinter. Die Ursache war NICHT eine, sondern drei voneinander unabhängige:
//
//   1. `engine._trigger_time` nahm `.date()` eines bereits nach UTC
//      gerechneten Ankers. Ohne gepflegte `checkin_time` ist das der VORTAG
//      (00:00 Kopenhagen = 22:00Z). Live: 25 Anreisechecks einen Tag zu früh,
//      und zwar ausnahmslos die ohne Anreisezeit (18 von 18 mit Uhrzeit
//      richtig, 25 von 25 ohne falsch).
//   2. Die Zeitachse las `due_at` als Startspalte. `due_at` ist aber das ENDE
//      (`engine.py`: `due_at = (end or start)`) — eine Aufgabe, die um 00:00
//      des Folgetags endet, landete damit eine Spalte hinter ihrer Buchung.
//      Live: 103 Aufgaben.
//   3. Der Kalendertag wurde in der Zone des BEDIENERS gerechnet, nicht in der
//      des OBJEKTS. Für eine Agentur, die Objekte in mehreren Zeitzonen
//      betreut, verschiebt das nur einen Teil der Aufgaben — es sieht aus wie
//      Zufall.
//
// Jede dieser drei ist für sich unsichtbar: die Pille steht einfach woanders,
// und niemand kann von außen sagen, ob die Daten oder die Darstellung schuld
// sind. Genau das hat die Diagnose dreimal in die falsche Richtung geschickt.
// Deshalb zeigt dieses Panel für JEDE Aufgabe die ganze Kette: welches Feld
// den Tag liefert, in welcher Zone gerechnet wurde, auf welcher Spalte sie
// landet — und ob dieser Tag innerhalb ihrer Buchung liegt.
//
// Zuschaltbar, nicht immer an: in der Entwicklung sichtbar, in Produktion nur
// mit `NEXT_PUBLIC_KALENDER_DEBUG=1`. Ein Diagnosewerkzeug, das die Bedienung
// verstellt, macht die Sitzung unbrauchbar, in der es helfen soll — deshalb
// unten links (Support-Chat und Realtime-Panel sitzen rechts).

import { useMemo, useState } from "react";

import type { CalendarBooking, TaskListItem } from "@/lib/tasks";

export type DebugZeile = {
  objekt: string;
  zone: string | null;
  aufgabe: TaskListItem;
  /** Welches Feld den Tag geliefert hat — `start_at` ist die Wahrheit,
   *  `due_at` nur der Notnagel für Altbestand ohne Start. */
  quelle: "start_at" | "due_at" | "keins";
  tag: string | null;
  /** Tag des Endes in der Objekt-Zone — muss dem Starttag gleichen. */
  endTag: string | null;
  spalte: number;
  /** Die Buchung, an der die Aufgabe hängt (falls sie eine hat). */
  buchung: CalendarBooking | null;
};

/** Eine Verschiebung per Drag & Drop — die ganze Kette von der Zelle bis zur
 *  Serverantwort. Damit ist nachprüfbar, ob ein falscher Tag aus der
 *  Rechnung (von/nach/delta), aus dem gesendeten Wert oder aus dem Server
 *  kommt. */
export type Verschiebung = {
  zeit: string;
  titel: string;
  zone: string | null;
  von: string;
  nach: string;
  delta: number;
  startVorher: string | null;
  endeVorher: string | null;
  dueVorher: string | null;
  startGesendet: string | null;
  endeGesendet: string | null;
  /** Was der Server zurückgab — muss dem Gesendeten gleichen. */
  startServer?: string | null;
  endeServer?: string | null;
  ergebnis: "offen" | "ok" | string;
};

type Befund = {
  art: "ok" | "warnung" | "fehler";
  text: string;
};

/** Der fachliche Test: liegt der Tag der Aufgabe in ihrer Buchung? */
function befundeVon(z: DebugZeile): Befund[] {
  const out: Befund[] = [];

  if (z.quelle === "keins" || !z.tag) {
    out.push({
      art: "fehler",
      text: "Kein Datum — Aufgabe wird auf Spalte 0 gezeichnet",
    });
    return out;
  }

  // FEHLER, nicht Hinweis (03.09.2026, „hinweise sind auch fehler"): eine
  // Aufgabe ohne Start hat kein Zeitfenster — niemand weiss, WANN sie zu tun
  // ist. Jeder Schreibpfad setzt seit heute ein Fenster; was hier auftaucht,
  // ist ein Weg, der es nicht tut.
  if (z.quelle === "due_at") {
    out.push({
      art: "fehler",
      text: "Keine Startzeit — Tag kommt aus due_at (= Ende der Aufgabe)",
    });
  }

  if (!z.zone) {
    out.push({
      art: "warnung",
      text: "Objekt ohne Zeitzone — Tag in UTC gerechnet",
    });
  }

  // FEHLER, nicht Hinweis: ein Ende an einem anderen Tag als der Start heisst
  // „02:00 bis 02:00 am Folgetag" — eine Reinigung dauert keine 24 Stunden.
  // 233 Aufgaben live so; vorher stand hier „unschädlich, solange start_at den
  // Tag setzt". Das war eine Bewertung, keine Messung.
  if (z.endTag && z.tag && z.endTag !== z.tag) {
    out.push({
      art: "fehler",
      text: `Zeitfenster läuft über Mitternacht (Ende am ${z.endTag})`,
    });
  }

  const b = z.buchung;
  if (!b) {
    if (z.aufgabe.reservation_id) {
      out.push({
        art: "warnung",
        text: "Buchung nicht in dieser Zeile — Zuordnung nicht prüfbar",
      });
    }
    return out;
  }

  const tage = (a: string, c: string) =>
    Math.round((Date.parse(c) - Date.parse(a)) / 86_400_000);

  if (z.tag < b.check_in) {
    out.push({
      art: "fehler",
      text: `${tage(b.check_in, z.tag)} Tage VOR der Anreise (${b.check_in})`,
    });
  } else if (z.tag > b.check_out) {
    out.push({
      art: "fehler",
      text: `+${tage(b.check_out, z.tag)} Tage NACH der Abreise (${b.check_out})`,
    });
  } else {
    out.push({
      art: "ok",
      text: `im Zeitraum ${b.check_in} – ${b.check_out}`,
    });
  }

  return out;
}

const FARBE: Record<Befund["art"], string> = {
  ok: "text-emerald-600",
  warnung: "text-amber-600",
  fehler: "text-red-600",
};

const ZEICHEN: Record<Befund["art"], string> = {
  ok: "✓",
  warnung: "!",
  fehler: "✕",
};

export function AufgabenKalenderDebug({
  zeilen,
  verschiebungen = [],
  rasterAn,
  onRasterAn,
}: {
  zeilen: DebugZeile[];
  verschiebungen?: Verschiebung[];
  rasterAn: boolean;
  onRasterAn: (an: boolean) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [nurProbleme, setNurProbleme] = useState(true);

  const bewertet = useMemo(
    () => zeilen.map((z) => ({ z, befunde: befundeVon(z) })),
    [zeilen],
  );

  const fehler = bewertet.filter((b) =>
    b.befunde.some((f) => f.art === "fehler"),
  );
  const warnungen = bewertet.filter(
    (b) =>
      !b.befunde.some((f) => f.art === "fehler") &&
      b.befunde.some((f) => f.art === "warnung"),
  );
  const sichtbar = nurProbleme ? [...fehler, ...warnungen] : bewertet;

  const ton =
    fehler.length > 0
      ? "bg-red-500"
      : warnungen.length > 0
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col items-start gap-2">
      {offen && (
        <div className="max-h-[70vh] w-[34rem] overflow-auto rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Kalender-Diagnose</span>
            <span className="text-xs text-muted-foreground">
              {zeilen.length} Aufgaben · {fehler.length} Fehler ·{" "}
              {warnungen.length} Hinweise
            </span>
          </div>

          <label className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={nurProbleme}
              onChange={(e) => setNurProbleme(e.target.checked)}
            />
            nur Auffälligkeiten
          </label>

          {/* Das Messgitter: Spaltennummer und Tagesziffer je Tag, direkt über
              den Balken. Damit ist ohne Rechnen ablesbar, auf welchem TAG eine
              Pille sitzt — die Frage, die sich aus der Pixelposition allein
              nicht beantworten liess. */}
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={rasterAn}
              onChange={(e) => onRasterAn(e.target.checked)}
            />
            Messgitter über dem Kalender
          </label>

          {/* Drag & Drop: jede Verschiebung dieser Sitzung. Ein Server-Wert,
              der vom gesendeten abweicht, ist ein Befund — dann rechnet der
              Server anders als die Oberfläche. */}
          {verschiebungen.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-semibold">
                Verschiebungen ({verschiebungen.length})
              </p>
              <ul className="flex flex-col gap-1">
                {verschiebungen.map((v) => {
                  // Als ZEITPUNKT vergleichen, nicht als Text: der Browser
                  // schreibt `08:00:00.000Z`, der Server `08:00:00Z` — derselbe
                  // Augenblick, zwei Schreibweisen. Der Textvergleich meldete
                  // beim ersten Live-Test jede korrekte Verschiebung als Fehler.
                  const gleich = (a?: string | null, b?: string | null) =>
                    (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null);
                  const abweichung =
                    v.ergebnis === "ok" &&
                    (!gleich(v.startServer, v.startGesendet) ||
                      !gleich(v.endeServer, v.endeGesendet));
                  const farbe =
                    v.ergebnis === "offen"
                      ? "text-muted-foreground"
                      : v.ergebnis === "ok" && !abweichung
                        ? "text-emerald-600"
                        : "text-red-600";
                  return (
                    <li
                      key={v.zeit + v.titel}
                      className="rounded-lg border border-border/60 p-2 font-mono text-[0.65rem] leading-relaxed"
                    >
                      <div className="flex gap-2">
                        <span className={`font-semibold ${farbe}`}>
                          {v.ergebnis === "offen"
                            ? "…"
                            : v.ergebnis === "ok"
                              ? abweichung
                                ? "✕ Server antwortet anders"
                                : "✓"
                              : `✕ ${v.ergebnis}`}
                        </span>
                        <span className="font-sans font-semibold">{v.titel}</span>
                        <span className="ml-auto text-muted-foreground">
                          {new Date(v.zeit).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {v.von} → {v.nach} ({v.delta > 0 ? "+" : ""}
                        {v.delta} Tage) in Zone {v.zone ?? "UTC"}
                      </div>
                      <div className="text-muted-foreground">
                        vorher: {v.startVorher ?? "—"} / {v.endeVorher ?? "—"} /
                        due {v.dueVorher ?? "—"}
                      </div>
                      <div className="text-muted-foreground">
                        gesendet: {v.startGesendet ?? "—"} /{" "}
                        {v.endeGesendet ?? "—"}
                      </div>
                      {v.ergebnis === "ok" && (
                        <div className={abweichung ? "text-red-600" : "text-muted-foreground"}>
                          server: {v.startServer ?? "—"} / {v.endeServer ?? "—"}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {sichtbar.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Keine Auffälligkeit — jede Aufgabe liegt im Zeitraum ihrer
              Buchung.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sichtbar.map(({ z, befunde }) => (
                <li
                  key={z.aufgabe.id}
                  className="rounded-lg border border-border/60 p-2 text-xs"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{z.aufgabe.title}</span>
                    <span className="text-muted-foreground">{z.objekt}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      Spalte {z.spalte}
                    </span>
                  </div>

                  {/* Die Rechenkette, damit man nicht raten muss, woher der
                      Tag kommt. Genau diese Information fehlte bei der
                      Fehlersuche am 03.09.2026. */}
                  <div className="mt-1 font-mono text-[0.65rem] leading-relaxed text-muted-foreground">
                    <div>
                      start_at: {z.aufgabe.start_at ?? "—"} · end_at:{" "}
                      {z.aufgabe.end_at ?? "—"} · due_at:{" "}
                      {z.aufgabe.due_at ?? "—"}
                    </div>
                    <div>
                      Tag {z.tag ?? "—"} aus <b>{z.quelle}</b> in Zone{" "}
                      <b>{z.zone ?? "UTC (keine gepflegt)"}</b>
                      {z.buchung
                        ? ` · Buchung ${z.buchung.check_in} – ${z.buchung.check_out}`
                        : " · keine Buchung"}
                    </div>
                  </div>

                  <ul className="mt-1 flex flex-col gap-0.5">
                    {befunde.map((f, i) => (
                      <li key={i} className={FARBE[f.art]}>
                        {ZEICHEN[f.art]} {f.text}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs font-semibold text-popover-foreground shadow-lg"
      >
        <span className={`size-2 rounded-full ${ton}`} />
        Kalender-Diagnose
        {fehler.length > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 text-[0.65rem] text-white">
            {fehler.length}
          </span>
        )}
      </button>
    </div>
  );
}
