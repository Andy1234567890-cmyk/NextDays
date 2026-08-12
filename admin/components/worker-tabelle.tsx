"use client";

// Der Worker-Verlauf als Liste — live, filterbar, mit vollständigen Details.
//
// REALTIME STATT POLLING: Die Tabelle abonniert `worker_ereignis` (0379). Der
// Worker schreibt dort je Vorgang eine Zeile; das Abo holt die frischen Daten
// vom Server nach. Ein Intervall wäre hier besonders falsch, weil der Worker in
// Schüben arbeitet: 1.400 Jobs am Tag, aber gebündelt in Ticks.
//
// WARUM DIE DETAILS NACHGELADEN WERDEN: Ein einzelner ARI-Request-Body trägt
// Hunderte Zeilen. In einer Liste von 100 Ereignissen wären das Megabyte für
// Daten, die man erst beim Aufklappen sieht — und sie dürfen ohnehin nicht in
// der abonnierten Tabelle stehen (Wurzel 6: sie ist für `authenticated`
// lesbar). Der Server prüft `platform_admin` und liefert dann ALLES.
import { useCallback, useEffect, useState, useTransition } from "react";

import { useRealtime } from "@/lib/use-realtime";
import {
  getWorkerDetail,
  getWorkerEreignisse,
  type WorkerEreignis,
} from "@/lib/backoffice";

const RICHTUNGEN = [
  { wert: "", label: "Alle Richtungen" },
  { wert: "job", label: "Jobs" },
  { wert: "gesendet", label: "Gesendet" },
  { wert: "empfangen", label: "Empfangen" },
  { wert: "tick", label: "Wartung" },
] as const;

const SEITE = 100;

export function WorkerTabelle({
  anfangs,
  gesamt: gesamtAnfangs,
}: {
  anfangs: WorkerEreignis[];
  gesamt: number;
}) {
  const [items, setItems] = useState(anfangs);
  const [gesamt, setGesamt] = useState(gesamtAnfangs);
  const [richtung, setRichtung] = useState("");
  const [nurFehler, setNurFehler] = useState(false);
  const [offset, setOffset] = useState(0);
  const [laedt, starteLaden] = useTransition();

  // EINE Ladefunktion für Filter, Blättern und Realtime — nicht drei. Der
  // Filter-Zustand steckt in den Abhängigkeiten, damit ein Realtime-Ereignis
  // nicht mit dem STAND VON FRÜHER nachlädt und den Filter dabei verliert.
  const laden = useCallback(
    (neuerOffset = offset) => {
      starteLaden(async () => {
        const antwort = await getWorkerEreignisse({
          limit: SEITE,
          offset: neuerOffset,
          richtung: richtung || undefined,
          nurFehler,
        });
        setItems(antwort.items);
        setGesamt(antwort.gesamt);
        setOffset(neuerOffset);
      });
    },
    [offset, richtung, nurFehler],
  );

  // Filterwechsel setzt aufs erste Blatt zurück: Seite 4 eines anderen Filters
  // wäre je nach Trefferzahl leer, und das sähe aus wie „keine Vorgänge".
  useEffect(() => {
    starteLaden(async () => {
      const antwort = await getWorkerEreignisse({
        limit: SEITE,
        offset: 0,
        richtung: richtung || undefined,
        nurFehler,
      });
      setItems(antwort.items);
      setGesamt(antwort.gesamt);
      setOffset(0);
    });
  }, [richtung, nurFehler]);

  // Neue Zeilen nur auf dem ERSTEN Blatt einspielen. Wer auf Seite 3 liest,
  // will nicht, dass ihm die Liste unter dem Finger wegläuft.
  useRealtime({
    table: "worker_ereignis",
    onChange: () => {
      if (offset === 0) laden(0);
    },
    debounceMs: 400,
  });

  const seite = Math.floor(offset / SEITE) + 1;
  const seiten = Math.max(1, Math.ceil(gesamt / SEITE));

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={richtung}
          onChange={(e) => setRichtung(e.target.value)}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm"
        >
          {RICHTUNGEN.map((r) => (
            <option key={r.wert} value={r.wert}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={nurFehler}
            onChange={(e) => setNurFehler(e.target.checked)}
          />
          Nur Fehler
        </label>
        <span className="text-sm text-muted-foreground">
          {gesamt} Vorgänge · Seite {seite} von {seiten}
          {laedt ? " · lädt …" : ""}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={offset === 0 || laedt}
            onClick={() => laden(Math.max(0, offset - SEITE))}
            className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-40"
          >
            Neuer
          </button>
          <button
            type="button"
            disabled={offset + SEITE >= gesamt || laedt}
            onClick={() => laden(offset + SEITE)}
            className="rounded-full border border-border px-4 py-2 text-sm disabled:opacity-40"
          >
            Älter
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {nurFehler || richtung
              ? "Kein Vorgang passt zu diesem Filter."
              : "Noch kein Vorgang aufgezeichnet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Zeit</th>
                <th className="py-2 pr-4 font-medium">Richtung</th>
                <th className="py-2 pr-4 font-medium">Vorgang</th>
                {/* Die wichtigste Spalte: WAS gesendet/getan wurde. Ohne sie
                    stand hier nur, DASS etwas lief. */}
                <th className="py-2 pr-4 font-medium">Was</th>
                <th className="py-2 pr-4 font-medium">Objekt</th>
                <th className="py-2 pr-4 font-medium">HTTP</th>
                <th className="py-2 pr-4 text-right font-medium">ms</th>
                <th className="py-2 font-medium">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <Zeile key={e.id} ereignis={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Was genau an das Portal ging, und was zurückkam — getrennt statt als ein
// JSON-Klumpen. Der Request ist die Frage „was haben WIR gesendet", die
// Response die Antwort des Portals; sie zusammen in einen Block zu werfen macht
// genau die Unterscheidung kaputt, um die es bei der Fehlersuche geht.
function QuelleAnsicht({
  tabelle,
  quelle,
}: {
  tabelle: string | null;
  quelle: Record<string, unknown>;
}) {
  // Namen wie in der Quelltabelle (channex_debug_log / jobs). Absichtlich nicht
  // übersetzt: sie sollen gegen die Channex-Doku haltbar sein.
  const bloecke: { titel: string; wert: unknown }[] = [];
  for (const [schluessel, titel] of [
    ["request_body", "Gesendet (Request)"],
    ["response_body", "Antwort des Portals (Response)"],
    ["payload", "Job-Nutzlast"],
  ] as const) {
    if (quelle[schluessel] !== undefined && quelle[schluessel] !== null) {
      bloecke.push({ titel, wert: quelle[schluessel] });
    }
  }
  // Alles Übrige als Rest-Block, damit nichts verschwindet, was der Server
  // liefert — die Route ist bewusst vollständig.
  const rest = Object.fromEntries(
    Object.entries(quelle).filter(
      ([k]) => !["request_body", "response_body", "payload"].includes(k),
    ),
  );

  return (
    <>
      {bloecke.map((b) => (
        <div key={b.titel} className="mb-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {b.titel}
          </p>
          {/* Ungekürzt: genau dafür gibt es die Detail-Route. Ein
              abgeschnittener Body wäre in der Fehlersuche wertlos. */}
          <pre className="max-h-[32rem] overflow-auto rounded-xl bg-card p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(b.wert, null, 2)}
          </pre>
        </div>
      ))}
      {Object.keys(rest).length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tabelle ?? "Quelle"}
          </p>
          <pre className="max-h-[32rem] overflow-auto rounded-xl bg-card p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(rest, null, 2)}
          </pre>
        </div>
      ) : null}
    </>
  );
}

function Zeile({ ereignis: e }: { ereignis: WorkerEreignis }) {
  const [offen, setOffen] = useState(false);
  const [quelle, setQuelle] = useState<Record<string, unknown> | null>(null);
  const [detailFehler, setDetailFehler] = useState<string | null>(null);
  const [holt, starteHolen] = useTransition();

  function aufklappen() {
    const neu = !offen;
    setOffen(neu);
    // Nur beim ersten Öffnen laden — danach steht die Nutzlast im Zustand. Sie
    // ändert sich nicht mehr: ein abgeschlossener Vorgang ist Vergangenheit.
    if (neu && quelle === null && detailFehler === null) {
      starteHolen(async () => {
        try {
          const antwort = await getWorkerDetail(e.id);
          if (antwort.quelle === null) {
            setDetailFehler(
              "Keine Quellzeile — der Vorgang trug keine oder sie wurde aufgeräumt.",
            );
          } else {
            setQuelle(antwort.quelle);
          }
        } catch {
          setDetailFehler("Details nicht ladbar.");
        }
      });
    }
  }

  const fehler = e.ergebnis === "fehler";
  return (
    <>
      <tr
        onClick={aufklappen}
        className={`cursor-pointer border-b border-border/50 hover:bg-accent/5 ${
          fehler ? "bg-destructive/5" : ""
        }`}
      >
        <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
          {new Date(e.erfasst_at).toLocaleString("de-DE")}
        </td>
        <td className="py-2 pr-4 text-muted-foreground">{e.richtung}</td>
        <td className="py-2 pr-4 font-mono text-xs">{e.vorgang}</td>
        {/* Was gesendet/getan wurde. Nicht abgeschnitten: „Reinigungsgebühr ·
            795,00 DKK · pro Buchung" muss ganz lesbar sein, sonst ist genau
            der Betrag weg, den man sehen wollte. */}
        <td className="py-2 pr-4 min-w-[20rem]">
          {e.zusammenfassung ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-2 pr-4">{e.objekt ?? "—"}</td>
        <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
          {e.http_methode ? (
            <>
              {e.http_methode} {e.http_status ?? ""}
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
          {e.dauer_ms ?? "—"}
        </td>
        <td className="py-2">
          {fehler ? (
            <span className="font-semibold text-destructive">Fehler</span>
          ) : (
            <span className="text-muted-foreground">ok</span>
          )}
          {e.versuche && e.versuche > 1 ? (
            <span className="ml-2 text-xs text-muted-foreground">
              {e.versuche}. Versuch
            </span>
          ) : null}
        </td>
      </tr>

      {offen ? (
        <tr className="border-b border-border/50 bg-muted/30">
          <td colSpan={8} className="px-4 py-4">
            {e.http_pfad ? (
              <p className="mb-2 font-mono text-xs break-all text-muted-foreground">
                {e.http_methode} {e.http_pfad}
              </p>
            ) : null}
            {e.fehler_text ? (
              <pre className="mb-3 max-h-64 overflow-auto rounded-xl bg-destructive/10 p-3 text-xs whitespace-pre-wrap text-destructive">
                {e.fehler_text}
              </pre>
            ) : null}
            {holt ? (
              <p className="text-xs text-muted-foreground">lädt Details …</p>
            ) : detailFehler ? (
              <p className="text-xs text-muted-foreground">{detailFehler}</p>
            ) : quelle ? (
              <QuelleAnsicht tabelle={e.quelle_tabelle} quelle={quelle} />
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
