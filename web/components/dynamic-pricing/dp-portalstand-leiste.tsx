"use client";

// Soll/Ist an den Portalen: was wir berechnet haben gegen das, was laut
// unserem Schatten (channex_ari_shadow) bei Airbnb und Booking steht.
//
// WARUM ES DIESE LEISTE GIBT
// Am 04.09.2026 zeigte der Kalender 541,45 DKK, Channex führte 433,16 DKK —
// 435 von 540 Tagen falsch, sichtbar erst im Extranet. Weder Hostaway noch
// SiteMinder zeigen diese Differenz; wir haben sie im Haus und zeigen sie.
//
// Die Leiste erscheint NUR bei Abweichung. Ein dauerhaft grüner Haken wird
// nach zwei Tagen übersehen — und mit ihm der rote, wenn er kommt.
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  getPortalstand,
  portalstandAngleichen,
  type Portalstand,
} from "@/lib/dynamic-pricing";

// Der Push-Horizont (settings_service._UMSCHALT_HORIZONT_TAGE): weiter reicht
// kein gesendeter Preis, weiter gibt es also nichts zu vergleichen.
const HORIZONT_TAGE = 365;
// Nach „Jetzt angleichen": der Job läuft im Worker (typisch 1–3 s). Wir laden
// den Stand in diesem Takt nach, bis die Abweichung weg ist — oder geben nach
// dieser Zahl Versuchen den Knopf zurück. Ein Zustand „eingereiht", der nie
// endet, war die Meldung vom 05.09.2026: „der Abgleich schließt nicht ab".
const NACHLADE_TAKT_MS = 5000;
const NACHLADE_VERSUCHE = 6;

function isoPlus(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

export function DpPortalstandLeiste({
  propertyId,
  onStand,
}: {
  propertyId: string;
  /** Der Kalender bekommt den Stand je Tag, um abweichende Tage zu markieren. */
  onStand?: (stand: Portalstand) => void;
}) {
  const [stand, setStand] = useState<Portalstand | null>(null);
  const [busy, setBusy] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  // Abgleich lief, es bleibt eine Abweichung: dann ist es keine Frage der
  // Zeit mehr — der Knopf kommt zurück und die Leiste sagt es.
  const [blieb, setBlieb] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await getPortalstand(propertyId, isoPlus(0), isoPlus(HORIZONT_TAGE));
    if (!res.ok) return; // Zusatzinformation — kein roter Kasten über dem Kalender
    setStand(res.data);
    onStand?.(res.data);
  }, [propertyId, onStand]);

  useEffect(() => {
    void laden();
  }, [laden]);

  useEffect(() => {
    if (!gesendet) return;
    let versuch = 0;
    let aktiv = true;
    const takt = setInterval(async () => {
      versuch += 1;
      const res = await getPortalstand(propertyId, isoPlus(0), isoPlus(HORIZONT_TAGE));
      if (!aktiv) return;
      if (res.ok) {
        setStand(res.data);
        onStand?.(res.data);
        if (res.data.abweichend === 0) {
          clearInterval(takt);
          setGesendet(false);
          return;
        }
        if (versuch >= NACHLADE_VERSUCHE) {
          clearInterval(takt);
          setGesendet(false);
          setBlieb(res.data.abweichend);
        }
      } else if (versuch >= NACHLADE_VERSUCHE) {
        clearInterval(takt);
        setGesendet(false);
      }
    }, NACHLADE_TAKT_MS);
    return () => {
      aktiv = false;
      clearInterval(takt);
    };
  }, [gesendet, propertyId, onStand]);

  async function angleichen() {
    setBusy(true);
    setFehler(null);
    setBlieb(null);
    const res = await portalstandAngleichen(propertyId);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setGesendet(true);
  }

  if (!stand || stand.abweichend === 0) return null;

  // Die größte Abweichung als Beispiel — eine Zahl, die man einordnen kann.
  const groesste = stand.tage
    .filter((t) => t.abweichung_pct !== null)
    .sort((a, b) => Math.abs(b.abweichung_pct!) - Math.abs(a.abweichung_pct!))[0];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius) border border-red-300 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950/40">
      <span aria-hidden className="shrink-0">⚠</span>
      <span className="min-w-0 flex-1 basis-64">
        <span className="font-semibold">Portale weichen ab:</span>{" "}
        {stand.abweichend} {stand.abweichend === 1 ? "Tag steht" : "Tage stehen"} bei
        Airbnb und Booking mit einem anderen Preis als hier berechnet
        {groesste && groesste.berechnet !== null && groesste.portal !== null && (
          <>
            {" "}
            (z. B. {new Date(groesste.date + "T00:00:00").toLocaleDateString("de-DE")}:
            hier {formatCurrency(groesste.berechnet, stand.waehrung)}, Portal{" "}
            {formatCurrency(groesste.portal, stand.waehrung)})
          </>
        )}
        .
      </span>
      {fehler && <span className="text-destructive">{fehler}</span>}
      {blieb !== null && !gesendet && (
        <span className="text-xs text-muted-foreground">
          Abgleich gelaufen — {blieb} {blieb === 1 ? "Tag weicht" : "Tage weichen"}{" "}
          weiterhin ab.
        </span>
      )}
      {gesendet ? (
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          Abgleich läuft — der Stand wird alle paar Sekunden nachgeladen.
        </span>
      ) : (
        <Button
          type="button"
          size="sm"
          className="ml-auto shrink-0"
          onClick={angleichen}
          disabled={busy}
        >
          {busy ? "sendet…" : "Jetzt angleichen"}
        </Button>
      )}
    </div>
  );
}
