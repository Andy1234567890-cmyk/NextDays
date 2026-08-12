// Webhook-Monitor: was die PORTALE uns schicken — Buchungen, Stornos,
// getrennte Inserate, deaktivierte Kanäle, Bewertungen, Nachrichten.
//
// Warum getrennt vom Worker-Monitor: dort steht, was WIR tun (Jobs, ausgehende
// Aufrufe). Beides in eine Liste zu werfen hiesse, 538 eingehende Ereignisse mit
// 1.400 Jobs am Tag zu vermischen — die Fehler der einen Seite gingen in der
// Menge der anderen unter. Genau das war live der Fall: 18 Fehler-Ereignisse,
// alle unbearbeitet, keines je gesehen.
//
// `channex_webhook_event.payload` trägt die vollständige Portal-Nutzlast und ist
// für `authenticated` nur tenant-gescoped lesbar (Wurzel 6). Die Daten holt
// deshalb der Server mit der Service-Role hinter `platform_admin` — dort ist
// alles sichtbar, ungekürzt.
import { ApiError } from "@nextdays/auth/errors";

import { WebhookTabelle } from "@/components/webhook-tabelle";
import {
  getWebhookEreignisse,
  getWebhookKennzahlen,
  type WebhookEreignis,
  type WebhookKennzahlen,
} from "@/lib/backoffice";

export default async function WebhookSeite() {
  // Beide Quellen getrennt fangen: die Liste ist wichtiger als die Kennzahlen.
  // Fällt eine aus, soll die andere trotzdem stehen — und der Grund sichtbar
  // sein, statt als „alles ruhig" durchzugehen (Wurzel 4).
  let ereignisse: WebhookEreignis[] = [];
  let gesamt = 0;
  let listeFehler: string | null = null;
  try {
    const antwort = await getWebhookEreignisse({ limit: 100 });
    ereignisse = antwort.items;
    gesamt = antwort.gesamt;
  } catch (exc) {
    listeFehler =
      exc instanceof ApiError ? exc.message : "Eingänge nicht ladbar.";
  }

  let kennzahlen: WebhookKennzahlen | null = null;
  let zahlenFehler: string | null = null;
  try {
    kennzahlen = await getWebhookKennzahlen(24);
  } catch (exc) {
    zahlenFehler =
      exc instanceof ApiError ? exc.message : "Kennzahlen nicht ladbar.";
  }

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Webhook-Monitor
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {kennzahlen
          ? `${kennzahlen.ereignisse} Eingänge in ${kennzahlen.stunden} h · ${kennzahlen.fehler_offen} offene Fehler`
          : "Was die Portale uns schicken"}
      </p>

      {/* „Eingriff nötig" steht oben und zählt ZEITFENSTER-UNABHÄNGIG: ein
          getrenntes Inserat vom 07.08. ist heute noch getrennt und verkauft
          nichts. Nur die letzten 24 h zu zählen liesse die Seite ruhig
          aussehen, während vier Inserate stillstehen. */}
      {kennzahlen ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Kachel
            wert={kennzahlen.handlungsbedarf}
            label="Eingriff nötig (offen, gesamt)"
            warnAb={1}
          />
          <Kachel
            wert={kennzahlen.fehler_offen}
            label="Fehler offen (gesamt)"
            warnAb={1}
          />
          <Kachel
            wert={kennzahlen.ereignisse}
            label={`Eingänge (${kennzahlen.stunden} h)`}
          />
        </div>
      ) : null}

      {zahlenFehler ? (
        <p className="mt-4 text-sm text-muted-foreground">{zahlenFehler}</p>
      ) : null}

      {kennzahlen && kennzahlen.items.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Je Ereignis · letzte {kennzahlen.stunden} h
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Ereignis</th>
                  <th className="py-2 pr-4 font-medium">Einstufung</th>
                  <th className="py-2 pr-4 text-right font-medium">Anzahl</th>
                  <th className="py-2 text-right font-medium">davon offen</th>
                </tr>
              </thead>
              <tbody>
                {kennzahlen.items.map((k) => (
                  <tr
                    key={`${k.event}-${k.severity}`}
                    className="border-b border-border/50"
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{k.event}</td>
                    <td
                      className={`py-2 pr-4 ${
                        k.severity === "error"
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {k.severity}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {k.anzahl}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        k.offen > 0 && k.severity === "error"
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {k.offen}
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
          <p className="text-sm font-medium">Eingänge nicht verfügbar</p>
          <p className="mt-2 text-sm text-muted-foreground">{listeFehler}</p>
        </div>
      ) : (
        <WebhookTabelle anfangs={ereignisse} gesamt={gesamt} />
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
