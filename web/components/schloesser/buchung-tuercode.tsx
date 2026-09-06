"use client";

// Der Türcode einer Buchung — die Stelle, an der der Betrieb ihn im Alltag
// braucht (Buchungsdetail).
//
// DER ZWECK DIESER KOMPONENTE IST EHRLICHKEIT. Sie zeigt nicht nur den Code,
// sondern seinen ZUSTAND, und zwar auch die unangenehmen:
//
//   „Läuft weiter"  Die Buchung ist storniert, aber der Code öffnet bis zum
//                   Ablauf weiter die Tür (Offline-Schloss, algoPIN). Wer hier
//                   „zurückgezogen" schreibt, verkauft Sicherheit, die es
//                   nicht gibt — genau die stille Falschaussage, die niemand
//                   als Fehler erkennt, weil sie plausibel aussieht.
//   „Fehlgeschlagen" Der Code kam nicht aufs Schloss (Gerät ohne Netz,
//                   Speicher voll). Ohne Anzeige merkt es niemand, bis der
//                   Gast vor der Tür steht.
//   „Übermittelt"   An den Hersteller gegeben, aber noch nicht am Gerät
//                   bestätigt. Der Unterschied zu „Aktiv" ist echt: ein
//                   HTTP-200 beim Anlegen beweist nicht, dass das Schloss den
//                   Code kennt.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { ladeZugang, legeZugangAn, planeZugang } from "@/lib/schloesser-api";
import { ZUGANG_ZUSTAND, type SchlossZugang } from "@/lib/schloesser-typen";

const TON_KLASSEN: Record<string, string> = {
  gut: "text-emerald-600",
  warten: "text-muted-foreground",
  warnung: "text-amber-600",
  aus: "text-muted-foreground line-through",
};

function zeitpunkt(wert: string | null | undefined): string {
  if (!wert) return "—";
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return "—";
  // Anzeige in der Zone des Betrachters; die GÜLTIGKEIT richtet sich nach der
  // Zone des Objekts (das rechnet der Server). Beides zu vermischen war schon
  // einmal die Ursache eines Fehlers im Aufgaben-Kalender.
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BuchungTuercode({ reservationId }: { reservationId: string }) {
  const [zugang, setZugang] = useState<SchlossZugang | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [arbeitet, setArbeitet] = useState(false);

  const laden = useCallback(async () => {
    const res = await ladeZugang(reservationId);
    setZugang(res.ok ? res.data : null);
    setLaedt(false);
  }, [reservationId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  if (laedt) return null;

  // Kein Schloss für dieses Objekt — der Normalfall bei den meisten Betrieben.
  // Dann gar nichts anzeigen, statt einen leeren Abschnitt zu zeigen.
  if (!zugang || zugang.vorhanden === false) return null;

  const zustand =
    ZUGANG_ZUSTAND[zugang.status ?? ""] ?? {
      text: zugang.status ?? "Unbekannt",
      ton: "warten" as const,
    };
  const grund = zugang.status_grund || zugang.grund;

  async function jetztAnlegen() {
    if (!zugang?.id) return;
    setArbeitet(true);
    const res = await legeZugangAn(zugang.id);
    setArbeitet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Code an das Schloss übermittelt.");
    await laden();
  }

  async function neuErzeugen() {
    setArbeitet(true);
    const res = await planeZugang(reservationId);
    setArbeitet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Code neu erzeugt.");
    await laden();
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon icon="ph:lock-key" className="mt-0.5 size-5" />
          <div>
            <p className="text-sm font-semibold">Türcode</p>
            <p className={`text-xs ${TON_KLASSEN[zustand.ton]}`}>
              {zustand.text}
            </p>
          </div>
        </div>

        {zugang.code ? (
          <span className="rounded-xl bg-muted px-3 py-1.5 font-mono text-lg tracking-widest">
            {zugang.code}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {/* Kein Platzhalter, keine erfundene Zahl: der Code existiert
                schlicht noch nicht. */}
            Noch kein Code
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Gültig ab</dt>
        <dd>{zeitpunkt(zugang.starts_at)}</dd>
        <dt className="text-muted-foreground">Gültig bis</dt>
        <dd>{zeitpunkt(zugang.ends_at)}</dd>
      </dl>

      {/* Der Klartext zum Zustand. Bei „Läuft weiter" steht hier, bis wann der
          Code trotz Storno gilt — die wichtigste Information der ganzen
          Komponente. */}
      {grund && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
          <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0" />
          {grund}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {zugang.status === "geplant" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void jetztAnlegen()}
            disabled={arbeitet}
          >
            {arbeitet && (
              <Icon icon="svg-spinners:180-ring" className="size-4" />
            )}
            Jetzt an das Schloss senden
          </Button>
        )}
        {zugang.status === "fehlgeschlagen" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void neuErzeugen()}
            disabled={arbeitet}
          >
            {arbeitet && (
              <Icon icon="svg-spinners:180-ring" className="size-4" />
            )}
            Erneut versuchen
          </Button>
        )}
      </div>

      {zugang.status === "geplant" && (
        <p className="text-xs text-muted-foreground">
          Der Code wird automatisch 72 Stunden vor der Anreise an das Schloss
          gesendet. So bleibt Zeit für einen zweiten Versuch, falls das Schloss
          gerade nicht erreichbar ist.
        </p>
      )}
    </section>
  );
}
