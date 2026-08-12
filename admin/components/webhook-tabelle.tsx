"use client";

// Die Portal-Eingänge als Liste — live, filterbar, mit vollständiger Payload.
//
// WAS HIER ANDERS IST ALS IM WORKER-MONITOR: Dort steht, was WIR tun; hier, was
// ANDERE uns schicken. Getrennte Seiten, weil sonst 538 Eingänge in 1.400 Jobs
// am Tag untergehen — und mit ihnen die 18 Fehler, die niemand angefasst hat.
//
// REALTIME: Abonniert wird `reservations`, NICHT `channex_webhook_event`. Letztere
// ist für `authenticated` nur tenant-gescoped lesbar (Gastdaten, Preise in der
// Payload) und darf für ein Backoffice-Abo nicht geöffnet werden (Wurzel 6). Ein
// Abo darauf wäre eine stumme Attrappe: die UI sähe live aus und aktualisierte
// nie. `reservations` ist die erlaubte Quelle, die bei einem eingehenden
// booking_new mitzieht — der häufigste Grund für eine neue Zeile.
import { useCallback, useEffect, useState, useTransition } from "react";

import { useRealtime } from "@/lib/use-realtime";
import type { WebhookEreignis } from "@/lib/backoffice";
// Über Server Actions, NICHT direkt aus `lib/backoffice`: dessen `api()` liest
// den Bearer aus einem httpOnly-Cookie und ist aus dem Browser nicht
// erreichbar — der Direktaufruf lief in 401 („Details nicht ladbar.").
import {
  webhookDetailHolen,
  webhookEreignisseHolen,
} from "@/lib/monitor-actions";

// Die live wirklich vorkommenden Typen (12.08.2026, 7 Tage). Kein erfundener
// Katalog: ein Filter auf einen Wert, den es nicht gibt, sieht wie ein Defekt
// aus („keine Treffer", obwohl alles in Ordnung ist).
const EVENTS = [
  { wert: "", label: "Alle Ereignisse" },
  { wert: "booking_new", label: "Neue Buchung" },
  { wert: "booking_cancellation", label: "Storno" },
  { wert: "booking_unmapped_rate", label: "Rate nicht zugeordnet" },
  { wert: "disconnect_listing", label: "Inserat getrennt" },
  { wert: "deactivate_channel", label: "Kanal deaktiviert" },
  { wert: "activate_channel", label: "Kanal aktiviert" },
  { wert: "review", label: "Bewertung" },
  { wert: "message", label: "Nachricht" },
] as const;

const SEITE = 100;

export function WebhookTabelle({
  anfangs,
  gesamt: gesamtAnfangs,
}: {
  anfangs: WebhookEreignis[];
  gesamt: number;
}) {
  const [items, setItems] = useState(anfangs);
  const [gesamt, setGesamt] = useState(gesamtAnfangs);
  const [event, setEvent] = useState("");
  const [nurOffen, setNurOffen] = useState(false);
  const [nurFehler, setNurFehler] = useState(false);
  const [offset, setOffset] = useState(0);
  const [laedt, starteLaden] = useTransition();

  // EINE Ladefunktion für Filter, Blättern und Realtime — der Filter-Zustand
  // steckt in den Abhängigkeiten, damit ein Realtime-Ereignis nicht mit dem
  // Stand von früher nachlädt und den Filter dabei verliert.
  const laden = useCallback(
    (neuerOffset = offset) => {
      starteLaden(async () => {
        const antwort = await webhookEreignisseHolen({
          limit: SEITE,
          offset: neuerOffset,
          event: event || undefined,
          severity: nurFehler ? "error" : undefined,
          nurOffen,
        });
        setItems(antwort.items);
        setGesamt(antwort.gesamt);
        setOffset(neuerOffset);
      });
    },
    [offset, event, nurOffen, nurFehler],
  );

  // Filterwechsel setzt aufs erste Blatt zurück: Seite 4 eines anderen Filters
  // wäre je nach Trefferzahl leer, und das sähe aus wie „keine Eingänge".
  useEffect(() => {
    starteLaden(async () => {
      const antwort = await webhookEreignisseHolen({
        limit: SEITE,
        offset: 0,
        event: event || undefined,
        severity: nurFehler ? "error" : undefined,
        nurOffen,
      });
      setItems(antwort.items);
      setGesamt(antwort.gesamt);
      setOffset(0);
    });
  }, [event, nurOffen, nurFehler]);

  useRealtime({
    table: "reservations",
    onChange: () => {
      if (offset === 0) laden(0);
    },
    debounceMs: 600,
  });

  const seite = Math.floor(offset / SEITE) + 1;
  const seiten = Math.max(1, Math.ceil(gesamt / SEITE));

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm"
        >
          {EVENTS.map((e) => (
            <option key={e.wert} value={e.wert}>
              {e.label}
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
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={nurOffen}
            onChange={(e) => setNurOffen(e.target.checked)}
          />
          Nur offene
        </label>
        <span className="text-sm text-muted-foreground">
          {gesamt} Eingänge · Seite {seite} von {seiten}
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
            {nurOffen || nurFehler || event
              ? "Kein Eingang passt zu diesem Filter."
              : "Noch kein Eingang aufgezeichnet."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                {/* ZWEI Spalten, weil es zwei verschiedene Zeitpunkte sind: was
                    das Portal meldet und wann es bei uns ankam. Live liegen sie
                    auseinander, und bei einem Rutsch-Import tragen alle Zeilen
                    dieselbe Eingangssekunde — eine gemeinsame Spalte hätte den
                    Unterschied verdeckt (Wurzel 5b). */}
                <th className="py-2 pr-4 font-medium">Beim Portal</th>
                <th className="py-2 pr-4 font-medium">Eingang bei uns</th>
                <th className="py-2 pr-4 font-medium">Ereignis</th>
                <th className="py-2 pr-4 font-medium">Was</th>
                <th className="py-2 pr-4 font-medium">Betrieb</th>
                <th className="py-2 pr-4 font-medium">Objekt</th>
                <th className="py-2 font-medium">Status</th>
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

function Zeile({ ereignis: e }: { ereignis: WebhookEreignis }) {
  const [offen, setOffen] = useState(false);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [resolution, setResolution] = useState<Record<string, unknown> | null>(
    null,
  );
  const [detailFehler, setDetailFehler] = useState<string | null>(null);
  const [holt, starteHolen] = useTransition();

  function aufklappen() {
    const neu = !offen;
    setOffen(neu);
    // Nur beim ersten Öffnen laden — ein eingetroffenes Ereignis ist
    // Vergangenheit, seine Payload ändert sich nicht mehr.
    if (neu && payload === null && detailFehler === null) {
      starteHolen(async () => {
        try {
          const antwort = await webhookDetailHolen(e.id);
          if (antwort.payload === null) {
            setDetailFehler("Dieser Eingang trug keine Payload.");
          } else {
            setPayload(antwort.payload);
            setResolution(antwort.resolution);
          }
        } catch {
          setDetailFehler("Payload nicht ladbar.");
        }
      });
    }
  }

  const fehler = e.severity === "error";
  return (
    <>
      <tr
        onClick={aufklappen}
        className={`cursor-pointer border-b border-border/50 hover:bg-accent/5 ${
          e.handlungsbedarf
            ? "bg-destructive/10"
            : fehler
              ? "bg-destructive/5"
              : ""
        }`}
      >
        <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs">
          {e.portal_at ? (
            new Date(e.portal_at).toLocaleString("de-DE")
          ) : (
            // Kein Rückfall auf unsere Uhr: das Portal hat keinen Zeitpunkt
            // mitgeschickt, und ein plausibler Ersatzwert wäre eine
            // Falschaussage, die niemand als Bug erkennt (Wurzel 5b).
            <span className="text-muted-foreground">nicht gemeldet</span>
          )}
        </td>
        <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
          {new Date(e.eingang_at).toLocaleString("de-DE")}
        </td>
        <td className="py-2 pr-4 font-mono text-xs">{e.event}</td>
        <td className="py-2 pr-4 min-w-[18rem] font-mono text-xs break-all">
          {e.zusammenfassung ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-2 pr-4">{e.betrieb ?? "—"}</td>
        <td className="py-2 pr-4">{e.objekt ?? "—"}</td>
        <td className="py-2 whitespace-nowrap">
          {e.handlungsbedarf ? (
            <span className="font-semibold text-destructive">
              Eingriff nötig
            </span>
          ) : fehler ? (
            <span className="text-destructive">Fehler</span>
          ) : e.resolved ? (
            <span className="text-muted-foreground">erledigt</span>
          ) : (
            <span className="text-muted-foreground">offen</span>
          )}
        </td>
      </tr>

      {offen ? (
        <tr className="border-b border-border/50 bg-muted/30">
          <td colSpan={7} className="px-4 py-4">
            {e.live_feed_event_id ? (
              <p className="mb-2 font-mono text-xs text-muted-foreground">
                Portal-Ereignis-ID: {e.live_feed_event_id}
              </p>
            ) : null}
            {holt ? (
              <p className="text-xs text-muted-foreground">lädt Payload …</p>
            ) : detailFehler ? (
              <p className="text-xs text-muted-foreground">{detailFehler}</p>
            ) : payload ? (
              <>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vom Portal geschickt
                </p>
                {/* Ungekürzt: genau dafür gibt es die Detail-Route. */}
                <pre className="max-h-[32rem] overflow-auto rounded-xl bg-card p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(payload, null, 2)}
                </pre>
                {resolution ? (
                  <>
                    <p className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Abgearbeitet
                    </p>
                    <pre className="max-h-64 overflow-auto rounded-xl bg-card p-3 text-xs whitespace-pre-wrap">
                      {JSON.stringify(resolution, null, 2)}
                    </pre>
                  </>
                ) : null}
              </>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
