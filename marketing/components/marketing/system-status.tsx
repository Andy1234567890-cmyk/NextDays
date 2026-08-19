"use client";

// Statuspunkt im Footer — derselbe Gedanke wie bei status.claude.com,
// status.stripe.com oder status.slack.com: der Besucher soll nicht erst eine
// zweite Seite öffnen müssen, um zu sehen, ob es gerade läuft.
//
// WARUM NICHT NUR EIN LINK: Ein Link beantwortet die Frage „läuft es?" nicht.
// Genau die stellt sich aber, wenn jemand während einer Störung auf der Seite
// landet — und dann ist ein Textlink „Systemstatus" so hilfreich wie eine
// verschlossene Tür mit Klingelschild.
//
// WARUM FAIL-QUIET: Antwortet die Status-API nicht, wird KEIN Punkt gezeigt und
// der Link bleibt ein normaler Link. Ein roter Punkt, weil unser eigener
// Abruf scheiterte, wäre eine Falschaussage über den Betrieb (Wurzel 4/5b:
// unsere Messung ist nicht der Zustand des fremden Dienstes). Ein grüner Punkt
// bei unbekanntem Zustand wäre schlimmer.
import { useEffect, useState } from "react";

import { STATUS_URL } from "@/lib/app-url";

// Die Auswertung der Heartbeats liegt serverseitig in `app/api/status`; hier
// kommt nur noch die fertige Lage an. Das hält die Monitor-Namen und internen
// Adressen aus dem Browser heraus.
type Lage = "oben" | "gestoert" | "unten" | "wartung";

type Antwort = { lage?: Lage };

const FARBE: Record<Lage, string> = {
  oben: "bg-emerald-400",
  gestoert: "bg-amber-400",
  unten: "bg-red-500",
  wartung: "bg-sky-400",
};

export function SystemStatus({ label }: { label: string }) {
  const [lage, setLage] = useState<Lage | null>(null);

  useEffect(() => {
    if (!STATUS_URL) return;
    const abbruch = new AbortController();

    // Über die EIGENE Route, nicht direkt zu Kuma: dessen API sendet kein
    // `Access-Control-Allow-Origin`, ein Direktabruf aus dem Browser wird von
    // der Same-Origin-Policy geblockt (live geprüft). Die Route verdichtet
    // ausserdem auf die Lage — Monitor-Namen und interne Adressen bleiben
    // serverseitig.
    //
    // Kein Polling-Intervall: der Footer ist nicht das Dashboard. Ein Abruf
    // beim Rendern genügt; wer den Verlauf braucht, klickt auf die Statusseite.
    fetch("/api/status", { signal: abbruch.signal })
      .then((r) => (r.ok && r.status !== 204 ? (r.json() as Promise<Antwort>) : null))
      .then((d) => {
        if (d?.lage) setLage(d.lage);
      })
      .catch(() => {
        // Fail-quiet: kein Punkt statt eines erfundenen Zustands.
      });

    return () => abbruch.abort();
  }, []);

  if (!STATUS_URL) return null;

  return (
    <a
      href={STATUS_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-2 text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
    >
      {lage && (
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${FARBE[lage]}`}
        />
      )}
      {label}
    </a>
  );
}
