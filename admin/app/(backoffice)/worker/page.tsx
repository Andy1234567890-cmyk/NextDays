// Worker-Monitor: was der Hintergrund-Prozess gerade tut — Jobs, Aufrufe an die
// Portale, eingehende Webhooks. Live über `worker_ereignis` (0379).
//
// Warum eine eigene Tabelle abonniert wird und nicht `jobs` bzw.
// `channex_debug_log`: die tragen vollständige Nutzlasten (Gastdaten, Preise)
// und sind für `authenticated` gesperrt (Wurzel 6). `worker_ereignis` trägt nur
// Metadaten; die Details holt die Tabelle über den Server nach, der
// `platform_admin` prüft — dort ist dann alles sichtbar, ungekürzt.
import { ApiError } from "@nextdays/auth/errors";

import { WorkerTabelle } from "@/components/worker-tabelle";
import {
  getWorkerEreignisse,
  getWorkerKennzahlen,
  type WorkerEreignis,
  type WorkerKennzahlen,
} from "@/lib/backoffice";

export default async function WorkerSeite() {
  // Beide Quellen getrennt fangen: die Liste ist wichtiger als die Kennzahlen.
  // Fällt eine aus, soll die andere trotzdem stehen — und der Grund sichtbar
  // sein, statt als „alles ruhig" durchzugehen (Wurzel 4).
  let ereignisse: WorkerEreignis[] = [];
  let gesamt = 0;
  let listeFehler: string | null = null;
  try {
    const antwort = await getWorkerEreignisse({ limit: 100 });
    ereignisse = antwort.items;
    gesamt = antwort.gesamt;
  } catch (exc) {
    listeFehler =
      exc instanceof ApiError ? exc.message : "Verlauf nicht ladbar.";
  }

  let kennzahlen: WorkerKennzahlen | null = null;
  let zahlenFehler: string | null = null;
  try {
    kennzahlen = await getWorkerKennzahlen(24);
  } catch (exc) {
    zahlenFehler =
      exc instanceof ApiError ? exc.message : "Kennzahlen nicht ladbar.";
  }

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Worker-Monitor
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {kennzahlen
          ? `${kennzahlen.ereignisse} Vorgänge in ${kennzahlen.stunden} h · ${kennzahlen.fehler} Fehler`
          : "Jobs, Portal-Aufrufe und eingehende Webhooks"}
      </p>

      {/* Die Warteschlange steht oben, weil sie der Grund ist, aus dem jemand
          diese Seite öffnet: „hängt etwas?". Sie kommt aus `jobs` und nicht aus
          dem Verlauf — der sagt, was passiert IST, nicht was ansteht. */}
      {kennzahlen ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Kachel
            wert={kennzahlen.warteschlange}
            label="in der Warteschlange"
            warnAb={50}
          />
          <Kachel
            wert={kennzahlen.aufgegeben}
            label="aufgegeben"
            warnAb={1}
          />
          <Kachel
            wert={kennzahlen.fehler}
            label={`Fehler (${kennzahlen.stunden} h)`}
            warnAb={1}
          />
          <Kachel
            wert={kennzahlen.ereignisse}
            label={`Vorgänge (${kennzahlen.stunden} h)`}
          />
        </div>
      ) : null}

      {zahlenFehler ? (
        <p className="mt-4 text-sm text-muted-foreground">{zahlenFehler}</p>
      ) : null}

      {kennzahlen && kennzahlen.items.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Je Vorgang · letzte {kennzahlen.stunden} h
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Richtung</th>
                  <th className="py-2 pr-4 font-medium">Vorgang</th>
                  <th className="py-2 pr-4 text-right font-medium">Anzahl</th>
                  <th className="py-2 pr-4 text-right font-medium">Fehler</th>
                  <th className="py-2 pr-4 text-right font-medium">⌀ ms</th>
                  <th className="py-2 text-right font-medium">max ms</th>
                </tr>
              </thead>
              <tbody>
                {kennzahlen.items.map((k) => (
                  <tr
                    key={`${k.richtung}-${k.vorgang}`}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4 text-muted-foreground">
                      {k.richtung}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{k.vorgang}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {k.anzahl}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right tabular-nums ${
                        k.fehler > 0
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {k.fehler}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {k.dauer_avg_ms ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {k.dauer_max_ms ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {listeFehler ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">Verlauf nicht verfügbar</p>
          <p className="mt-2 text-sm text-muted-foreground">{listeFehler}</p>
        </div>
      ) : (
        <WorkerTabelle anfangs={ereignisse} gesamt={gesamt} />
      )}
    </div>
  );
}

function Kachel({
  wert,
  label,
  warnAb,
}: {
  wert: number;
  label: string;
  /** Ab diesem Wert rot. Ohne Angabe ist die Zahl neutral — nicht jede Zahl ist
   *  eine Warnung, und wenn alles warnt, warnt nichts. */
  warnAb?: number;
}) {
  const warnt = warnAb !== undefined && wert >= warnAb;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        warnt
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card"
      }`}
    >
      <p
        className={`text-2xl font-bold tabular-nums ${
          warnt ? "text-destructive" : ""
        }`}
      >
        {wert}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
