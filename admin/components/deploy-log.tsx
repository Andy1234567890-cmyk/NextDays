"use client";

// Build-Log eines Deploys, direkt im Backoffice. Bewusst KEIN Link nach
// Coolify: dessen Oberfläche ist nur über einen SSH-Tunnel erreichbar, ein
// Link liefe für den Betreiber ins Leere.
//
// Client-Komponente, weil das Log während eines laufenden Baus nachwachsen
// muss — es wird im Takt nachgeladen und rollt ans Ende.
import { useCallback, useEffect, useRef, useState } from "react";

import type { DeployLog } from "@/lib/backoffice";
import { logHolen } from "@/lib/deploy-actions";

const TAKT_MS = 4_000;
const LAEUFT = new Set(["queued", "in_progress"]);

export function DeployLogAnsicht({
  deploymentUuid,
  start,
}: {
  deploymentUuid: string;
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

  useEffect(() => {
    if (!laeuft) return;
    const id = setInterval(nachladen, TAKT_MS);
    return () => clearInterval(id);
  }, [laeuft, nachladen]);

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
                    {new Date(z.zeit).toLocaleTimeString("de-DE")}
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
