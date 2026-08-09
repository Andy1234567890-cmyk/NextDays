// Deploy-Verlauf EINER Anwendung samt Build-Ausgabe. Das Log kommt aus
// Coolify über unsere API — Coolify selbst ist nur per SSH-Tunnel erreichbar,
// deshalb wird hier alles im Backoffice gezeigt statt verlinkt.
//
// `uuid` aus dem Pfad ist die Coolify-Anwendungs-UUID und zugleich der
// Primärschlüssel im Spiegel — die Log-Ansicht filtert damit ihr Realtime-Abo.
import Link from "next/link";

import { ApiError } from "@nextdays/auth/errors";

import { DeployLogAnsicht } from "@/components/deploy-log";
import {
  getDeployLog,
  getDeployUebersicht,
  getDeployVerlauf,
  type DeployLog,
} from "@/lib/backoffice";

const STATUS_TEXT: Record<string, string> = {
  finished: "Erfolgreich",
  in_progress: "Läuft",
  queued: "Wartet",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
};

function dauer(von: string | null, bis: string | null): string {
  if (!von) return "—";
  const start = new Date(von).getTime();
  const ende = bis ? new Date(bis).getTime() : Date.now();
  const sek = Math.max(0, Math.round((ende - start) / 1000));
  return sek < 60 ? `${sek}s` : `${Math.floor(sek / 60)}m ${sek % 60}s`;
}

export default async function DeployDetailSeite({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<{ log?: string }>;
}) {
  const { uuid } = await params;
  const { log: gewaehltesLog } = await searchParams;

  let fehler: string | null = null;
  let verlauf;
  let name = uuid;
  try {
    const [uebersicht, v] = await Promise.all([
      getDeployUebersicht(),
      getDeployVerlauf(uuid, 20),
    ]);
    verlauf = v;
    name = uebersicht.apps.find((a) => a.uuid === uuid)?.name ?? uuid;
  } catch (exc) {
    fehler =
      exc instanceof ApiError
        ? exc.message
        : "Deploy-Verlauf konnte nicht geladen werden.";
  }

  // Ohne ausdrückliche Wahl das Log des neuesten Deploys zeigen.
  const zielUuid =
    gewaehltesLog ?? verlauf?.items[0]?.deployment_uuid ?? null;
  let log: DeployLog | null = null;
  let logFehler: string | null = null;
  if (zielUuid) {
    try {
      log = await getDeployLog(zielUuid);
    } catch (exc) {
      logFehler =
        exc instanceof ApiError
          ? exc.message
          : "Build-Ausgabe konnte nicht geladen werden.";
    }
  }

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <Link
        href="/deploy"
        className="text-sm text-muted-foreground transition hover:text-foreground"
      >
        ← Deploy-Monitor
      </Link>
      <h1 className="mt-2 font-sans text-[2rem] font-bold tracking-tight">
        {name}
      </h1>

      {fehler ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">{fehler}</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            Die letzten {verlauf?.items.length ?? 0} Deploys
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-semibold">Status</th>
                  <th className="pb-2 pr-4 font-semibold">Commit</th>
                  <th className="pb-2 pr-4 font-semibold">Nachricht</th>
                  <th className="pb-2 pr-4 font-semibold">Gestartet</th>
                  <th className="pb-2 pr-4 font-semibold">Dauer</th>
                  <th className="pb-2 font-semibold">Ausgabe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {verlauf?.items.map((e) => (
                  <tr
                    key={e.deployment_uuid ?? e.id}
                    className={
                      e.deployment_uuid === zielUuid ? "bg-muted/40" : undefined
                    }
                  >
                    <td className="py-3 pr-4 font-medium">
                      {STATUS_TEXT[e.status] ?? e.status}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {e.commit ? e.commit.slice(0, 8) : "—"}
                    </td>
                    <td className="max-w-[22rem] truncate py-3 pr-4 text-muted-foreground">
                      {e.commit_nachricht ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {e.gestartet_at
                        ? new Date(e.gestartet_at).toLocaleString("de-DE")
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">
                      {dauer(e.gestartet_at, e.beendet_at)}
                    </td>
                    <td className="py-3">
                      {e.deployment_uuid ? (
                        <Link
                          href={`/deploy/${uuid}?log=${e.deployment_uuid}`}
                          className="rounded-full border border-border px-4 py-2 text-xs font-semibold transition hover:bg-muted"
                        >
                          Ansehen
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logFehler ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">{logFehler}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Die Build-Ausgabe braucht COOLIFY_LOG_TOKEN in der
                Server-Konfiguration von nextdays-api.
              </p>
            </div>
          ) : log && zielUuid ? (
            <DeployLogAnsicht
              deploymentUuid={zielUuid}
              anwendungUuid={uuid}
              start={log}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
