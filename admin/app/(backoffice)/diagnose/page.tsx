// Technische Diagnose: laufende Freigaben der Kunden.
//
// Hier erscheinen NUR Konten, die dem Support aktiv Einsicht gewährt haben.
// Es gibt keinen Weg, sich diese Einsicht selbst zu verschaffen — die Freigabe
// startet ausschließlich der Kunde, zeitlich begrenzt und widerrufbar.
import Link from "next/link";

import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getDebugSessions } from "@/lib/backoffice";

export default async function DiagnoseSeite() {
  const sessions = await getDebugSessions();

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      {/* Erteilt ein Kunde die Freigabe, wartet der Support gerade darauf —
          die Liste muss von selbst erscheinen, nicht erst nach Neuladen. */}
      <RealtimeRefresh table="support_debug_sessions" />
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Technische Diagnose
      </h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
        Kunden können uns befristet Einblick in ihre Fehlermeldungen geben.
        Hier stehen nur laufende Freigaben — jeder Zugriff wird protokolliert.
      </p>

      {sessions.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-semibold">Keine aktiven Freigaben</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Bitte den Kunden, die Diagnose unter
            <span className="font-medium"> Konto → Datenschutz → Support-Diagnose </span>
            freizugeben.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/diagnose/${s.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {s.note || "Ohne Angabe"}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    Seit {new Date(s.started_at).toLocaleString("de-DE")} · endet{" "}
                    {new Date(s.expires_at).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                  Freigegeben
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
