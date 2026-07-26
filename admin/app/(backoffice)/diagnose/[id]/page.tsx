// Technische Ereignisse einer Freigabe.
//
// Der Server begrenzt auf das Freigabefenster (plus kurzen Rückblick) und
// liefert nichts, sobald die Freigabe abgelaufen oder widerrufen ist. Dieser
// Zugriff wird im Backoffice-Protokoll festgehalten.
import Link from "next/link";

import { AufrufDetails } from "@/components/aufruf-details";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getSessionEvents } from "@/lib/backoffice";

// Ereignisart als Badge: Farbe UND Text (WCAG 1.4.1).
const ART: Record<string, { label: string; stil: string }> = {
  error: { label: "Fehler", stil: "bg-destructive text-background" },
  api_error: { label: "API-Fehler", stil: "bg-foreground text-background" },
  slow_request: { label: "Langsam", stil: "bg-muted text-foreground" },
  client_info: { label: "Umgebung", stil: "bg-muted text-muted-foreground" },
  // Ablauf-Ereignisse — nur während einer Freigabe erfasst.
  navigation: { label: "Seite", stil: "bg-muted text-muted-foreground" },
  aktion: { label: "Klick", stil: "bg-muted text-muted-foreground" },
  aufruf: { label: "Aufruf", stil: "bg-foreground text-background" },
};

export default async function DiagnoseDetailSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const liste = await getSessionEvents(id);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      {/* Ereignisse laufen während einer Freigabe laufend ein — ohne Abo
          müsste der Support die Seite von Hand neu laden und hielte die
          Diagnose für tot. */}
      <RealtimeRefresh table="support_diagnostics" />
      <Link
        href="/diagnose"
        className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Freigaben
      </Link>
      <h1 className="mt-4 font-sans text-[2rem] font-bold tracking-tight">
        Ereignisse
      </h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
        {liste.total} Ereignisse im Freigabezeitraum — Fehler und, solange die
        Freigabe läuft, auch der Bedienablauf (geöffnete Seiten, angeklickte
        Schaltflächen). Neueste zuerst.
      </p>

      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Keine Ereignisse — entweder ist nichts aufgetreten, oder die Freigabe
          ist abgelaufen.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {liste.items.map((e) => {
            const art = ART[e.kind] ?? ART.error;
            return (
              <li key={e.id} className="rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${art.stil}`}
                  >
                    {art.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium">
                      {e.message}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {e.app}
                      {e.path ? ` · ${e.path}` : ""}
                      {e.http_status ? ` · HTTP ${e.http_status}` : ""}
                      {e.duration_ms ? ` · ${e.duration_ms} ms` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("de-DE")}
                  </span>
                </div>
                {/* Aufrufe brauchen eine aufbereitete Darstellung — bei einem
                    422 ist die Feldliste die eigentliche Antwort, nicht der
                    rohe JSON-Dump. */}
                {e.kind === "aufruf" ? (
                  <AufrufDetails context={e.context} />
                ) : (
                  Object.keys(e.context).length > 0 && (
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/40 p-3 text-xs">
                      {JSON.stringify(e.context, null, 2)}
                    </pre>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
