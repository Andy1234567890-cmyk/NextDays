"use client";

// Ein Serverfehler, der SAGT, woher er kommt.
//
// WOFUER: Bei einem 500 sendet der Server bewusst nur
// `{"detail": "internal_error", "request_id": "..."}` — kein Stacktrace im
// Browser (Wurzel 5). In der Oberflaeche stand dadurch das nackte Wort
// „internal_error", und niemand — weder Betrieb noch Support — konnte sagen,
// woher es kam.
//
// Dabei lag die Ursache die ganze Zeit im Server bereit: `merke_ursache`
// hinterlegt Exception-Typ und die letzte EIGENE Codezeile unter der
// Request-ID. Gelesen wurde das nur im Backoffice. Diese Komponente holt es
// dorthin, wo der Fehler passiert.
//
// WAS SIE NICHT ZEIGT: die Exception-NACHRICHT. Die traegt regelmaessig
// Kundendaten oder Secrets (`KeyError: 'stripe_secret'`, Constraint-
// Verletzungen mit Klartextwerten). Typ plus Stelle genuegen zur Diagnose und
// sind unbedenklich.

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { getFehlerUrsache } from "@/lib/tasks";

type Ursache = {
  typ: string | null;
  datei: string | null;
  zeile: number | null;
};

export function FehlerHinweis({
  fehler,
  requestId,
}: {
  fehler: string;
  /** Aus der Fehlerantwort. Ohne sie gibt es nur die Meldung. */
  requestId?: string;
}) {
  const t = useTranslations("tasks");
  const [ursache, setUrsache] = useState<Ursache | null>(null);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    let abgebrochen = false;
    void (async () => {
      const res = await getFehlerUrsache(requestId);
      // Nur setzen, wenn wirklich etwas da ist: ein leerer Kasten „Ursache:"
      // ohne Inhalt waere schlechter als keiner (Wurzel 4).
      if (!abgebrochen && res.ok && res.data.typ) {
        setUrsache({
          typ: res.data.typ,
          datei: res.data.datei,
          zeile: res.data.zeile,
        });
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [requestId]);

  // Die Zeile, die man dem Support schickt. Alles in EINEM String, damit ein
  // Klick reicht — abgetippte IDs sind regelmaessig falsch.
  const kopierText = [
    fehler,
    requestId ? `request_id=${requestId}` : "",
    ursache?.typ ?? "",
    ursache?.datei ? `${ursache.datei}:${ursache.zeile ?? "?"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <Icon icon="ph:warning-circle" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{fehler}</p>

          {ursache?.typ && (
            <p className="mt-1 font-mono text-xs opacity-80">
              {ursache.typ}
              {ursache.datei ? ` · ${ursache.datei}:${ursache.zeile ?? "?"}` : ""}
            </p>
          )}

          {requestId && (
            <p className="mt-1 font-mono text-xs opacity-60">
              {t("fehler.requestId", { id: requestId })}
            </p>
          )}
        </div>

        {requestId && (
          <button
            type="button"
            className="shrink-0 rounded-full border border-destructive/40 px-2.5 py-1 text-xs hover:bg-destructive/10"
            onClick={() => {
              // `navigator.clipboard` fehlt ohne HTTPS und in aelteren
              // Browsern — dann still nichts tun statt die Seite mit einem
              // TypeError zu killen.
              void navigator.clipboard?.writeText(kopierText).then(() => {
                setKopiert(true);
                setTimeout(() => setKopiert(false), 2000);
              });
            }}
          >
            {kopiert ? t("fehler.kopiert") : t("fehler.kopieren")}
          </button>
        )}
      </div>
    </div>
  );
}
