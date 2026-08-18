"use client";

// Der Deploy-Verlauf: was WANN passiert ist — und bei einem Fehlschlag warum.
//
// Warum es diese Ansicht gibt: `deploy_spiegel` hält je Anwendung genau EINE
// Zeile, die fortgeschrieben wird. Ein fehlgeschlagener Deploy war damit weg,
// sobald derselbe Dienst erneut deployt — im Backoffice war nie zu sehen, dass
// er fehlschlug. Diese Liste liest `deploy_ereignis` (0378), das ansammelt.
//
// Realtime wie überall: dieselbe Tabelle, die die Ereignisse trägt, ist auch
// die Abo-Quelle — ein INSERT erscheint sofort, ohne Polling.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { DeployEreignis } from "@/lib/backoffice";
import { useRealtime } from "@/lib/use-realtime";
import { datumZeit } from "@/lib/datum";

/** Farbe UND Text — Status nie nur über Farbe (WCAG 1.4.1). */
const STATUS: Record<string, { label: string; stil: string }> = {
  finished: {
    label: "Erfolgreich",
    stil: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  in_progress: {
    label: "Läuft",
    stil: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  queued: {
    label: "Wartet",
    stil: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  failed: {
    label: "Fehlgeschlagen",
    stil: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  cancelled: { label: "Abgebrochen", stil: "bg-muted text-muted-foreground" },
  "cancelled-by-user": {
    label: "Abgebrochen",
    stil: "bg-muted text-muted-foreground",
  },
  unbekannt: { label: "Unbekannt", stil: "bg-muted text-muted-foreground" },
};

/** Woher die Fehlerursache stammt — als Text, damit die Aussage belastbar ist.
 *
 *  „kein_log"/„unbekannt" bedeuten ausdrücklich NICHT „kein Fehler", sondern
 *  „Grund nicht ermittelbar". Das muss dastehen, sonst liest man das Fehlen
 *  einer Meldung als Entwarnung. */
const QUELLE: Record<string, string> = {
  deployment_failed: "Coolify-Meldung",
  healthcheck: "Healthcheck fehlgeschlagen",
  stderr: "Fehlerausgabe",
  kein_log: "Kein Log verfügbar",
  unbekannt: "Grund im Log nicht erkennbar",
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? {
    label: status,
    stil: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.stil}`}
    >
      {s.label}
    </span>
  );
}

function seit(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  return `vor ${Math.floor(std / 24)} Tag(en)`;
}

/** Der Fehlerblock einer Zeile. Nur bei Fehlschlägen, und nie erfunden. */
function Fehler({ e }: { e: DeployEreignis }) {
  if (e.status_nach !== "failed") return null;
  const quelle = e.fehler_quelle ? QUELLE[e.fehler_quelle] : null;
  return (
    <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
      {e.fehler_text ? (
        <p className="font-mono text-xs leading-relaxed text-red-800 dark:text-red-300">
          {e.fehler_text}
        </p>
      ) : (
        // Wurzel 4: kein Grund ermittelbar → das sagen, nicht schweigen.
        <p className="text-xs text-red-800/80 dark:text-red-300/80">
          Der Grund ließ sich nicht aus dem Build-Log lesen.
        </p>
      )}
      {quelle ? (
        <p className="mt-1.5 text-[0.6875rem] uppercase tracking-wide text-red-700/70 dark:text-red-400/70">
          {quelle}
        </p>
      ) : null}
      {e.fehler_kontext ? (
        <details className="mt-2 group">
          <summary className="cursor-pointer list-none text-xs font-semibold text-red-700 transition hover:underline dark:text-red-400">
            Letzte Log-Zeilen anzeigen
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-background/60 p-2 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
            {e.fehler_kontext}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function DeployVerlaufListe({
  ereignisse,
}: {
  ereignisse: DeployEreignis[];
}) {
  const router = useRouter();
  const [nurFehler, setNurFehler] = useState(false);

  // Push statt Polling: jeder neue Zustandswechsel ist ein INSERT in
  // deploy_ereignis und erscheint sofort.
  useRealtime({
    table: "deploy_ereignis",
    onChange: () => router.refresh(),
    debounceMs: 250,
  });

  // Reine Browser-Uhr für „vor X Min." — kein Netzverkehr.
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setJetzt(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sichtbar = nurFehler
    ? ereignisse.filter((e) => e.status_nach === "failed")
    : ereignisse;
  const fehlerAnzahl = ereignisse.filter(
    (e) => e.status_nach === "failed",
  ).length;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-xl font-bold tracking-tight">Verlauf</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jeder Zustandswechsel, neueste zuerst · aktualisiert sich live
          </p>
        </div>
        {fehlerAnzahl > 0 ? (
          <button
            type="button"
            onClick={() => setNurFehler((v) => !v)}
            aria-pressed={nurFehler}
            className={
              nurFehler
                ? "rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90"
                : "rounded-full border border-border px-4 py-2 text-xs font-semibold transition hover:bg-muted"
            }
          >
            {nurFehler
              ? "Alle anzeigen"
              : `Nur Fehler (${fehlerAnzahl})`}
          </button>
        ) : null}
      </div>

      {sichtbar.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">
            {nurFehler ? "Kein Fehlschlag im Verlauf." : "Noch keine Ereignisse."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {nurFehler
              ? "Alle aufgezeichneten Deploys sind durchgelaufen."
              : "Sobald sich der Zustand einer Anwendung ändert, erscheint sie hier."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {sichtbar.map((e) => (
            <li
              key={e.id}
              className={`rounded-2xl border p-4 ${
                e.status_nach === "failed"
                  ? "border-red-500/30 bg-red-500/[0.03]"
                  : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <StatusChip status={e.status_nach} />
                <span className="font-medium">{e.name}</span>
                {/* Der Wechsel selbst — beim Erstbefund gibt es kein „von". */}
                {e.status_von ? (
                  <span className="text-xs text-muted-foreground">
                    {STATUS[e.status_von]?.label ?? e.status_von} →{" "}
                    {STATUS[e.status_nach]?.label ?? e.status_nach}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    erstmals gesehen
                  </span>
                )}
                {e.commit ? (
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    title={e.commit_nachricht ?? undefined}
                  >
                    {e.commit.slice(0, 8)}
                  </span>
                ) : null}
                <span className="ml-auto flex items-center gap-3">
                  {/* Wurzel 5b: „erkannt" ist UNSERE Uhr, nicht Coolifys
                      Ereigniszeit — die Beschriftung sagt das ausdrücklich. */}
                  {e.erkannt_at ? (
                    <span
                      className="text-xs text-muted-foreground"
                      title={`Vom Worker bemerkt: ${datumZeit(e.erkannt_at)}`}
                    >
                      erkannt {seit(jetzt - new Date(e.erkannt_at).getTime())}
                    </span>
                  ) : null}
                  {e.deployment_uuid ? (
                    <a
                      href={`/deploy/${e.anwendung_uuid}`}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted"
                    >
                      Ausgabe
                    </a>
                  ) : null}
                </span>
              </div>
              {e.commit_nachricht ? (
                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                  {e.commit_nachricht}
                </p>
              ) : null}
              <Fehler e={e} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
