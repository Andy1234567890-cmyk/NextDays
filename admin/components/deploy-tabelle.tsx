"use client";

// Deploy-Monitor: Statusliste + Redeploy.
//
// Realtime statt Polling: der Worker spiegelt Coolifys Zustand nach
// public.deploy_spiegel (Migration 0294/0345), diese Tabelle abonniert ihn.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { DeployApp } from "@/lib/backoffice";
import { deployAusloesen } from "@/lib/deploy-actions";
import { useRealtime } from "@/lib/use-realtime";

// Treibt nur die Sekundenanzeige der Dauer — kein Netzverkehr.
const TICK_MS = 1_000;

// Ab wann gilt der Spiegel als stehengeblieben. Der Worker stempelt geprueft_at
// auch ohne fachliche Aenderung alle 5 Minuten (Heartbeat,
// GEPRUEFT_HEARTBEAT_SECONDS) — die Schwelle muss deutlich darueber liegen,
// sonst meldet die Anzeige einen gesunden Worker als tot. Drei verpasste
// Heartbeats sind eindeutig. Exportiert, damit die Seite fuer ihren Banner
// dieselbe Schwelle benutzt und beide nicht auseinanderlaufen.
export const SPIEGEL_STILL_MS = 15 * 60 * 1000;

/** Farbe UND Text — Status darf nie nur über Farbe erkennbar sein (WCAG 1.4.1). */
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
  cancelled: {
    label: "Abgebrochen",
    stil: "bg-muted text-muted-foreground",
  },
  unbekannt: { label: "Unbekannt", stil: "bg-muted text-muted-foreground" },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? {
    label: status,
    stil: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${s.stil}`}
    >
      {s.label}
    </span>
  );
}

function dauer(von: string | null, bis: string | null, jetzt: number): string {
  if (!von) return "—";
  const start = new Date(von).getTime();
  const ende = bis ? new Date(bis).getTime() : jetzt;
  const sek = Math.max(0, Math.round((ende - start) / 1000));
  if (sek < 60) return `${sek}s`;
  return `${Math.floor(sek / 60)}m ${sek % 60}s`;
}

/** „vor 3 Min." — grobe Angabe, die Zeile hat keinen Platz für mehr. */
function seit(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  return `vor ${Math.floor(std / 24)} Tag(en)`;
}

/**
 * Wie frisch ist der Blick des Workers auf DIESE App?
 *
 * Wurzel 5b: `geprueft_at` ist UNSERE Uhr — wann WIR zuletzt bei Coolify
 * nachgesehen haben. Es ist ausdrücklich NICHT der Zeitpunkt eines
 * Coolify-Ereignisses und wird auch nirgends so beschriftet.
 *
 * Wurzel 4/5: fehlt das Feld (älterer Lesepfad), wird nichts behauptet — weder
 * „aktuell" noch „veraltet". Steht es still, sagt die Zeile das sichtbar,
 * statt alte Daten stillschweigend als aktuellen Stand auszugeben.
 */
function SpiegelZelle({ app, jetzt }: { app: DeployApp; jetzt: number }) {
  if (!app.geprueft_at) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="Der Worker hat für diese Anwendung noch nichts in den Spiegel geschrieben."
      >
        —
      </span>
    );
  }
  const alter = jetzt - new Date(app.geprueft_at).getTime();
  const still = alter >= SPIEGEL_STILL_MS;
  if (!still) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={`Zuletzt bei Coolify nachgesehen: ${new Date(app.geprueft_at).toLocaleString("de-DE")}`}
      >
        {seit(alter)}
      </span>
    );
  }
  return (
    <span
      className="inline-flex whitespace-nowrap rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
      title={
        `Wir haben zuletzt am ${new Date(app.geprueft_at).toLocaleString("de-DE")} bei Coolify nachgesehen. ` +
        "Der angezeigte Stand kann veraltet sein — vermutlich läuft der Spiegel-Job im Worker nicht."
      }
    >
      Spiegel steht still ({seit(alter)})
    </span>
  );
}

/** Was der Rückstand für DIESE App bedeutet — eine Zelle, drei Zustände. */
function RueckstandZelle({ app }: { app: DeployApp }) {
  const r = app.rueckstand;
  // Nicht ermittelbar: das sagen, statt „aktuell" zu behaupten (Wurzel 4).
  if (!r || r.commits_relevant === null) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={r?.fehler ?? undefined}
      >
        nicht abrufbar
      </span>
    );
  }
  if (!r.betrifft_mich) {
    // Es kann Commits geben, die diese App nicht berühren — dann ist sie
    // trotzdem aktuell. Die Gesamtzahl steht im Titel, damit der Unterschied
    // nachvollziehbar bleibt.
    return (
      <span
        className="text-xs text-emerald-700 dark:text-emerald-400"
        title={
          r.commits_gesamt
            ? `${r.commits_gesamt} Commit(s) auf main, keiner betrifft diese Anwendung`
            : undefined
        }
      >
        aktuell
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
      {r.commits_relevant} offen
    </span>
  );
}

/** Die offenen Commits einer App — aufklappbar, damit die Zeile schmal bleibt. */
function AenderungenZelle({ app }: { app: DeployApp }) {
  const offene = app.rueckstand?.offene ?? [];
  if (offene.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs font-semibold text-muted-foreground transition hover:text-foreground">
        {offene.length} anzeigen
      </summary>
      <ul className="mt-2 flex max-w-md flex-col gap-2">
        {offene.map((c) => (
          <li key={c.sha} className="text-xs">
            <div className="flex gap-2">
              <span className="shrink-0 font-mono text-muted-foreground">
                {c.kurz_sha}
              </span>
              <span className="min-w-0">{c.nachricht}</span>
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {c.autor ?? "unbekannt"}
              {c.zeitpunkt
                ? ` · ${new Date(c.zeitpunkt).toLocaleString("de-DE")}`
                : ""}
              {c.dateien.length > 0
                ? ` · ${c.dateien.length} Datei(en)`
                : ""}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Handlungsbedarf zuerst: was deployt werden muss, steht oben. */
function nachDringlichkeit(a: DeployApp, b: DeployApp): number {
  const rang = (x: DeployApp) =>
    x.rueckstand?.betrifft_mich ? 0 : x.laeuft ? 1 : 2;
  const d = rang(a) - rang(b);
  return d !== 0 ? d : a.name.localeCompare(b.name);
}

export function DeployTabelle({
  apps,
  aktiv,
  darfDeployen,
}: {
  apps: DeployApp[];
  aktiv: boolean;
  darfDeployen: boolean;
}) {
  const router = useRouter();
  const [laeuftAktion, starteAktion] = useTransition();
  const [gerade, setGerade] = useState<string | null>(null);
  // Kopie sortieren: `apps` ist Server-Prop und darf nicht mutiert werden.
  const sortiert = [...apps].sort(nachDringlichkeit);

  // Push statt Polling: der Worker schreibt jede Aenderung nach
  // deploy_spiegel, das Abo holt die frischen Daten vom Server nach.
  useRealtime({
    table: "deploy_spiegel",
    onChange: () => router.refresh(),
    debounceMs: 250,
  });

  // Reine Browser-Uhr — kein Netzverkehr. Sie treibt zwei Anzeigen: die Dauer
  // laufender Deploys (sekundengenau) und das Alter des Spiegels.
  //
  // Sie laeuft deshalb AUCH ohne laufenden Deploy, nur langsamer. Ein
  // stehengebliebener Spiegel zeigt sich gerade dann, wenn nichts mehr passiert
  // — haetten wir die Uhr wie bisher an `aktiv` gehaengt, waere der Hinweis
  // „Spiegel steht still" nie von selbst erschienen.
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(
      () => setJetzt(Date.now()),
      aktiv ? TICK_MS : 30_000,
    );
    return () => clearInterval(id);
  }, [aktiv]);

  function ausloesen(app: DeployApp) {
    setGerade(app.uuid);
    starteAktion(async () => {
      const r = await deployAusloesen(app.uuid);
      setGerade(null);
      if (r.ok) {
        toast.success(`Deploy für ${app.name} gestartet.`);
        router.refresh();
      } else {
        toast.error(r.fehler);
      }
    });
  }

  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-4 font-semibold">Anwendung</th>
            <th className="pb-2 pr-4 font-semibold">Status</th>
            <th className="pb-2 pr-4 font-semibold">Commit</th>
            <th className="pb-2 pr-4 font-semibold">Rückstand</th>
            <th className="pb-2 pr-4 font-semibold">Änderungen</th>
            <th className="pb-2 pr-4 font-semibold">Gestartet</th>
            <th className="pb-2 pr-4 font-semibold">Dauer</th>
            {/* UNSERE Uhr, nicht Coolifys — die Spalte heisst deshalb
                „Nachgesehen" und nicht etwa „Aktualisiert" (Wurzel 5b). */}
            <th className="pb-2 pr-4 font-semibold">Nachgesehen</th>
            <th className="pb-2 pr-4 font-semibold">Ausgabe</th>
            <th className="pb-2 font-semibold">{darfDeployen ? "Aktion" : ""}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortiert.map((app) => (
            <tr
              key={app.uuid}
              // Was ausgerollt werden muss, hebt sich ab — die Zeile ist die
              // Antwort auf „welche App deploye ich jetzt".
              className={
                app.rueckstand?.betrifft_mich ? "bg-amber-500/[0.04]" : undefined
              }
            >
              <td className="py-3 pr-4 font-medium">
                <Link
                  href={`/deploy/${app.uuid}`}
                  className="transition hover:underline"
                >
                  {app.name}
                </Link>
              </td>
              <td className="py-3 pr-4">
                {app.letzter ? (
                  <StatusChip status={app.letzter.status} />
                ) : (
                  <span className="text-muted-foreground">Kein Deploy bekannt</span>
                )}
              </td>
              <td className="py-3 pr-4">
                {app.letzter?.commit ? (
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    title={app.letzter.commit_nachricht ?? undefined}
                  >
                    {app.letzter.commit.slice(0, 8)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="whitespace-nowrap py-3 pr-4">
                <RueckstandZelle app={app} />
              </td>
              <td className="py-3 pr-4 align-top">
                <AenderungenZelle app={app} />
              </td>
              <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-muted-foreground">
                {app.letzter?.gestartet_at
                  ? new Date(app.letzter.gestartet_at).toLocaleString("de-DE")
                  : "—"}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">
                {app.letzter
                  ? dauer(
                      app.letzter.gestartet_at,
                      app.letzter.beendet_at,
                      jetzt,
                    )
                  : "—"}
              </td>
              <td className="whitespace-nowrap py-3 pr-4">
                <SpiegelZelle app={app} jetzt={jetzt} />
              </td>
              <td className="py-3 pr-4">
                <Link
                  href={`/deploy/${app.uuid}`}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold transition hover:bg-muted"
                >
                  Ausgabe
                </Link>
              </td>
              <td className="py-3">
                {darfDeployen ? (
                  <button
                    type="button"
                    onClick={() => ausloesen(app)}
                    disabled={laeuftAktion || app.laeuft}
                    // Steht etwas an, ist der Knopf die Hauptaktion der Zeile
                    // und sieht auch so aus. Sonst bleibt er zurückhaltend —
                    // ein Redeploy ohne Änderung ist selten gewollt.
                    className={
                      app.rueckstand?.betrifft_mich && !app.laeuft
                        ? "whitespace-nowrap rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        : "whitespace-nowrap rounded-full border border-border px-4 py-2 text-xs font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    {gerade === app.uuid
                      ? "Wird gestartet…"
                      : app.laeuft
                        ? "Läuft"
                        : app.rueckstand?.betrifft_mich
                          ? `Deployen (${app.rueckstand.commits_relevant})`
                          : "Neu deployen"}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
