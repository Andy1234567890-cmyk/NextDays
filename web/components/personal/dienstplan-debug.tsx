"use client";

// Diagnose-Panel des Dienstplans (nur Entwicklung). Zeigt, was der Server
// zuletzt geliefert hat (Zone, Regeln bestätigt, Veröffentlichung) und jede
// eigene Aktion mit Antwort — bevor jemand aus Pixeln schließt, was passiert
// ist (Lehre aus dem Aufgabenkalender, memory: aufgaben-kalender-fuenf-wurzeln).
//
// Mit dem Ausbau (Vertrag §5) kommen die Größen dazu, die man sonst NICHT
// sehen kann: das sichtbare FENSTER (Ansicht/Darstellung/von/bis) — aus dem
// Raster allein ist nicht ablesbar, ob es 7 oder 42 Tage geholt hat —, die
// KENNZAHLEN-Antwort samt `currency`, `hinweise` und der Frage, welche
// Finanzfelder `null` sind (fehlendes Recht sieht wie „keine Daten" aus), die
// offenen TAUSCHE und der Zustand der KI-Läufe.
import { useState } from "react";

import type { Ansicht, Darstellung, Kennzahlen, Planungslauf, KiStatus, Tausch } from "@/lib/personal-planung-typen";
import type { Wochenplan } from "@/lib/personal-typen";

export type DebugEintrag = { zeit: string; art: string; text: string; daten?: unknown };

/** Das sichtbare Fenster — die eine Größe, die das Raster nicht verrät. */
export type DebugFenster = {
  ansicht: Ansicht;
  darstellung: Darstellung;
  von: string;
  bis: string;
  gruppiert: boolean;
};

export function DienstplanDebug({
  eintraege,
  plan,
  fenster,
  kennzahlen,
  tausche,
  kiStatus,
  planungslauf,
}: {
  eintraege: DebugEintrag[];
  plan: Wochenplan;
  fenster?: DebugFenster;
  kennzahlen?: Kennzahlen | null;
  tausche?: Tausch[];
  kiStatus?: KiStatus | null;
  planungslauf?: Planungslauf | null;
}) {
  const [offen, setOffen] = useState(false);
  if (process.env.NODE_ENV === "production") return null;

  // Welche Finanzfelder liefert der Server? Alles `null` heisst „kein
  // EXPORT_LOHN" (§2.1) und ist KEIN Datenfehler — genau diese Unterscheidung
  // ist aus der Oberflaeche nicht zu sehen.
  const geldfelder = kennzahlen
    ? (
        [
          ["umsatz", (k: Kennzahlen["tage"][number]) => k.umsatz_ist_minor ?? k.umsatz_plan_minor],
          [
            "kosten",
            (k: Kennzahlen["tage"][number]) =>
              k.personalkosten_ist_minor ?? k.personalkosten_plan_minor,
          ],
          ["quote", (k: Kennzahlen["tage"][number]) => k.personalkostenquote_pct],
          ["produktivitaet", (k: Kennzahlen["tage"][number]) => k.produktivitaet_minor_je_stunde],
          ["budget", (k: Kennzahlen["tage"][number]) => k.budget_minor ?? k.budget_stunden],
        ] as const
      )
        .filter(([, f]) => kennzahlen.tage.some((k) => f(k) !== null && f(k) !== undefined))
        .map(([name]) => name)
    : [];

  return (
    <div className="fixed bottom-3 right-3 z-40 max-w-md text-xs">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="rounded-full border bg-card px-3 py-1 shadow"
      >
        Dienstplan-Debug ({eintraege.length}) · {plan.zeitzone} ·{" "}
        {plan.regeln_bestaetigt ? "Regeln ✓" : "Regeln fehlen"}
      </button>
      {offen && (
        <div className="mt-2 max-h-80 overflow-auto rounded-xl border bg-card p-2 shadow-xl">
          <div className="mb-2 grid grid-cols-2 gap-1 text-muted-foreground">
            {fenster && (
              <>
                <span>Ansicht</span>
                <span>
                  {fenster.ansicht}/{fenster.darstellung}
                  {fenster.gruppiert ? " · gruppiert" : " · flach"}
                </span>
                <span>Fenster</span>
                <span>
                  {fenster.von} – {fenster.bis}
                </span>
              </>
            )}
            <span>Woche</span>
            <span>{plan.woche_start}</span>
            <span>Schichten</span>
            <span>
              {plan.schichten.length} ({plan.schichten.filter((s) => !s.user_id).length} offen)
            </span>
            <span>Abwesenheiten</span>
            <span>{plan.abwesenheiten.length}</span>
            <span>Veröffentlicht</span>
            <span>{plan.veroeffentlicht_am ?? "—"}</span>
            <span>Feiertage</span>
            <span>{Object.keys(plan.feiertage).length}</span>
            <span>Konflikte</span>
            <span>{plan.schichten.reduce((n, s) => n + s.konflikte.length, 0)}</span>
            <span>Kennzahlen</span>
            <span>
              {kennzahlen
                ? `${kennzahlen.tage.length} Tage · ${kennzahlen.bereiche.length} Bereiche · ${
                    kennzahlen.currency ?? "ohne Währung"
                  }`
                : "nicht geladen"}
            </span>
            <span>Geldfelder</span>
            <span>{kennzahlen ? (geldfelder.join(", ") || "keine (kein EXPORT_LOHN?)") : "—"}</span>
            {kennzahlen && kennzahlen.hinweise.length > 0 && (
              <>
                <span>Hinweise</span>
                <span>{kennzahlen.hinweise.join(" · ")}</span>
              </>
            )}
            <span>Tausche</span>
            <span>{tausche ? tausche.length : "—"}</span>
            <span>KI</span>
            <span>
              {kiStatus
                ? `${kiStatus.konfiguriert ? "an" : "aus"} · ${kiStatus.verbrauch_heute}/${
                    kiStatus.tageslimit
                  } · ${kiStatus.solver || "—"}`
                : "—"}
            </span>
            {planungslauf && (
              <>
                <span>Letzter Lauf</span>
                <span>
                  {planungslauf.id.slice(0, 8)} · {planungslauf.status} ·{" "}
                  {planungslauf.varianten.length} Varianten
                </span>
              </>
            )}
          </div>
          <ul className="divide-y">
            {eintraege.map((e, i) => (
              <li key={i} className="py-1">
                <span className="text-muted-foreground">{e.zeit.slice(11, 19)}</span>{" "}
                <b>{e.art}</b> {e.text}
                {e.daten !== undefined && (
                  <pre className="mt-0.5 max-h-24 overflow-auto rounded bg-secondary p-1">
                    {JSON.stringify(e.daten, null, 1)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
