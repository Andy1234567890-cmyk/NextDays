"use client";

// Build-Log eines Deploys, direkt im Backoffice. Bewusst KEIN Link nach
// Coolify: dessen Oberfläche ist nur über einen SSH-Tunnel erreichbar, ein
// Link liefe für den Betreiber ins Leere.
//
// Client-Komponente, weil das Log während eines laufenden Baus nachwächst.
import { useCallback, useEffect, useRef, useState } from "react";

import type { DeployLog } from "@/lib/backoffice";
import { logHolen } from "@/lib/deploy-actions";
import { type RealtimePayload, useRealtime } from "@/lib/use-realtime";
import { uhrzeit } from "@/lib/datum";

const LAEUFT = new Set(["queued", "in_progress"]);

export function DeployLogAnsicht({
  deploymentUuid,
  anwendungUuid,
  start,
}: {
  deploymentUuid: string;
  /** Anwendung, zu der dieser Deploy gehört — Primärschlüssel im Spiegel. */
  anwendungUuid: string;
  start: DeployLog;
}) {
  const [log, setLog] = useState<DeployLog>(start);
  const [fehler, setFehler] = useState<string | null>(null);
  const endeRef = useRef<HTMLDivElement>(null);
  const laeuft = LAEUFT.has(log.status);

  const nachladen = useCallback(async () => {
    const r = await logHolen(deploymentUuid);
    if (r.ok) {
      setLog(r.data);
      setFehler(null);
    } else {
      setFehler(r.fehler);
    }
  }, [deploymentUuid]);

  // Beim Uebergang „laeuft" -> „fertig" GENAU EINMAL final nachladen.
  //
  // Ohne das fehlten dauerhaft die letzten Zeilen: der Realtime-Auslöser unten
  // holt nur nach, solange `laeuft` true ist — und `laeuft` stammt aus genau
  // dem Log, das er nachlädt. Sobald der Deploy fertig war, kippte `laeuft` auf
  // false und die Ansicht lud NIE WIEDER nach; der Abschluss des Builds war nur
  // über den manuellen Knopf zu sehen.
  const warLaeuft = useRef(laeuft);
  useEffect(() => {
    const vorher = warLaeuft.current;
    warLaeuft.current = laeuft;
    if (vorher && !laeuft) void nachladen();
  }, [laeuft, nachladen]);

  // Das LOG selbst wird nicht gespiegelt (50 KB je Deploy, selten gebraucht).
  // Der AUSLOESER ist trotzdem Realtime: schreibt der Worker den Fortschritt
  // nach deploy_spiegel, holt diese Ansicht die neuen Zeilen nach.
  //
  // Bewusst OHNE Server-Filter, dafuer mit Pruefung auf die eigene Anwendung im
  // Callback: `deploy_spiegel` hat REPLICA IDENTITY DEFAULT (angelegt in 0294,
  // lange nach dem projektweiten `replica identity full` aus 0054). Ein
  // serverseitiger Filter waere damit nicht fuer jede Ereignisart verlaesslich
  // — und ein Filter, der zu viel wegfiltert, ist wieder eine stumme Attrappe.
  // Die Pruefung hier haengt nicht daran: sie nimmt `new` ODER `old`.
  //
  // onEvent statt onChange, weil nur der Payload verraet, WELCHE Anwendung
  // gemeint ist. Der Debounce, den onChange mitbraechte, wird deshalb unten
  // selbst gehalten — sonst zieht jeder Worker-Tick 50 KB Log.
  const nachladeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (nachladeTimer.current) clearTimeout(nachladeTimer.current);
    },
    [],
  );

  useRealtime<{ anwendung_uuid?: string }>({
    table: "deploy_spiegel",
    onEvent: (payload: RealtimePayload<{ anwendung_uuid?: string }>) => {
      const betroffen =
        payload.new?.anwendung_uuid ?? payload.old?.anwendung_uuid;
      if (betroffen !== anwendungUuid) return;
      if (!laeuft) return;
      if (nachladeTimer.current) clearTimeout(nachladeTimer.current);
      nachladeTimer.current = setTimeout(() => void nachladen(), 250);
    },
  });

  // Während des Baus am Ende bleiben, wie in einem Terminal.
  useEffect(() => {
    if (laeuft) endeRef.current?.scrollIntoView({ block: "end" });
  }, [log.zeilen.length, laeuft]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-lg font-semibold">
          Build-Ausgabe
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {log.zeilen.length} Zeilen
            {laeuft ? " · läuft" : ""}
          </span>
        </h2>
        {!laeuft ? (
          <button
            type="button"
            onClick={nachladen}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold transition hover:bg-muted"
          >
            Neu laden
          </button>
        ) : null}
      </div>

      {fehler ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-400">{fehler}</p>
      ) : null}

      {log.zeilen.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {laeuft
            ? "Der Bau ist gestartet, es gibt noch keine Ausgabe."
            : "Für diesen Deploy liegt keine Ausgabe vor."}
        </p>
      ) : (
        <div className="mt-4 max-h-[32rem] overflow-auto rounded-2xl border border-border bg-muted/30 p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
            {log.zeilen.map((z, i) => (
              <div
                key={`${i}-${z.zeit ?? ""}`}
                className={
                  z.art === "stderr"
                    ? "text-red-700 dark:text-red-400"
                    : undefined
                }
              >
                {z.zeit ? (
                  <span className="mr-3 select-none text-muted-foreground">
                    {uhrzeit(z.zeit)}
                  </span>
                ) : null}
                {z.text}
              </div>
            ))}
          </pre>
          <div ref={endeRef} />
        </div>
      )}
    </div>
  );
}
