"use client";

// „Erledigt"-Geste für beide Monitore (Webhook + Worker).
//
// DER BEFUND (13.08.2026): Fehler-Ereignisse liessen sich nirgends abhaken.
// `resolved` stand bei allen 603 Webhook-Eingängen auf `false`, und die Konsole
// zeigte 18 Fehler dauerhaft als „Eingriff nötig" — darunter vier
// `deactivate_channel` vom Vortag, während live ALLE Booking-Kanäle wieder aktiv
// waren. Eine Warnung, die nie verschwindet, wird zur Tapete: Stehen achtzehn
// erledigte Einträge dauerhaft rot, übersieht man den einen, der heute zählt.
//
// EINE Komponente für beide Tabellen, weil es dieselbe Geste ist. Der
// Unterschied ist der Pfad („webhook" oder „worker"), nicht das Verhalten.
import { useState, useTransition } from "react";

// Der Typ kommt aus `backoffice.ts`, die Funktionen aus der Server-Action:
// ein `"use server"`-Modul darf ausschließlich async functions exportieren —
// ein Typ darin bricht erst spät im `next build` („Collecting page data").
import type { MonitorQuelle } from "@/lib/backoffice";
import {
  ereignisErledigen,
  ereignisWiederOeffnen,
} from "@/lib/monitor-actions";

export function ErledigtKnopf({
  quelle,
  id,
  resolved,
  notiz,
  onGeaendert,
}: {
  quelle: MonitorQuelle;
  id: string;
  resolved: boolean;
  /** Die beim Abhaken hinterlassene Notiz, falls es eine gibt. */
  notiz?: string | null;
  /** Der Aufrufer aktualisiert seine Zeile — die Liste lädt nicht neu. */
  onGeaendert: (resolved: boolean, notiz: string | null) => void;
}) {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  // Das Notizfeld erscheint erst auf Wunsch: Beim Aufräumen von achtzehn
  // Altlasten will niemand achtzehnmal etwas tippen, und ein Pflichtfeld
  // brächte achtzehnmal „ok" — also wertlos.
  const [schreibt, setSchreibt] = useState(false);
  const [text, setText] = useState("");

  function abhaken() {
    setFehler(null);
    starte(async () => {
      const res = await ereignisErledigen(quelle, id, text);
      if (res.ok) {
        setSchreibt(false);
        setText("");
        onGeaendert(true, res.data.notiz);
      } else {
        setFehler(res.fehler);
      }
    });
  }

  function wiederOeffnen() {
    setFehler(null);
    starte(async () => {
      const res = await ereignisWiederOeffnen(quelle, id);
      if (res.ok) onGeaendert(false, res.data.notiz);
      else setFehler(res.fehler);
    });
  }

  if (resolved) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">erledigt</span>
          <button
            type="button"
            onClick={wiederOeffnen}
            disabled={laeuft}
            className="text-xs underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            wieder öffnen
          </button>
        </div>
        {/* Die Notiz sagt, WARUM abgehakt wurde — ohne sie ist „erledigt" eine
            Behauptung ohne Begründung. */}
        {notiz ? (
          <p className="text-xs text-muted-foreground italic">„{notiz}"</p>
        ) : null}
        {fehler ? <p className="text-xs text-destructive">{fehler}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={abhaken}
          disabled={laeuft}
          className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-accent/10 disabled:opacity-50"
        >
          {laeuft ? "…" : "Erledigt"}
        </button>
        {!schreibt ? (
          <button
            type="button"
            onClick={() => setSchreibt(true)}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            mit Notiz
          </button>
        ) : null}
      </div>
      {schreibt ? (
        <input
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") abhaken();
            if (ev.key === "Escape") setSchreibt(false);
          }}
          maxLength={2000}
          autoFocus
          placeholder="Was wurde getan? (Enter)"
          className="w-56 rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
      ) : null}
      {fehler ? <p className="text-xs text-destructive">{fehler}</p> : null}
    </div>
  );
}
