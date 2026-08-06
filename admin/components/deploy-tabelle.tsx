"use client";

// Deploy-Monitor: Statusliste + Redeploy. Client-Komponente, weil zwei Dinge
// Interaktivität brauchen: der Takt-Refresh und der Knopf.
//
// KEIN Realtime: die Daten liegen in Coolify, nicht in Supabase — es gibt
// keine Tabelle zum Abonnieren. Stattdessen wird im Takt neu geladen, und
// zwar enger, solange irgendwo gebaut wird (der Bau dauert Minuten, ein
// fertiger Stand ändert sich lange nicht).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { DeployApp } from "@/lib/backoffice";
import { deployAusloesen } from "@/lib/deploy-actions";
import { useRealtime } from "@/lib/use-realtime";

// REALTIME, kein Polling: der Worker spiegelt Coolifys Zustand nach
// public.deploy_spiegel (Migration 0294), diese Seite abonniert die Tabelle.
// Ein Push je Aenderung statt „jeder Browser fragt alle paar Sekunden".
//
// Die Sekundenanzeige der Dauer ist eine reine Uhr im Browser — sie erzeugt
// keine Anfrage, sondern laesst die bereits gelieferte Startzeit weiterlaufen.
const TICK_MS = 1_000;

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

function dauer(von: string | null, bis: string | null): string {
  if (!von) return "—";
  const start = new Date(von).getTime();
  const ende = bis ? new Date(bis).getTime() : Date.now();
  const sek = Math.max(0, Math.round((ende - start) / 1000));
  if (sek < 60) return `${sek}s`;
  return `${Math.floor(sek / 60)}m ${sek % 60}s`;
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

  // Push statt Polling: der Worker schreibt jede Aenderung nach
  // deploy_spiegel, das Abo holt die frischen Daten vom Server nach.
  useRealtime({
    table: "deploy_spiegel",
    onChange: () => router.refresh(),
    debounceMs: 250,
  });

  // Reine Browser-Uhr fuer die Dauer laufender Deploys — kein Netzverkehr.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!aktiv) return;
    const id = setInterval(() => tick((n) => n + 1), TICK_MS);
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
            <th className="pb-2 pr-4 font-semibold">Gestartet</th>
            <th className="pb-2 pr-4 font-semibold">Dauer</th>
            <th className="pb-2 pr-4 font-semibold">Ausgabe</th>
            <th className="pb-2 font-semibold">{darfDeployen ? "Aktion" : ""}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {apps.map((app) => (
            <tr key={app.uuid}>
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
              <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-muted-foreground">
                {app.letzter?.gestartet_at
                  ? new Date(app.letzter.gestartet_at).toLocaleString("de-DE")
                  : "—"}
              </td>
              <td className="whitespace-nowrap py-3 pr-4 text-muted-foreground">
                {app.letzter
                  ? dauer(app.letzter.gestartet_at, app.letzter.beendet_at)
                  : "—"}
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
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {gerade === app.uuid
                      ? "Wird gestartet…"
                      : app.laeuft
                        ? "Läuft"
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
