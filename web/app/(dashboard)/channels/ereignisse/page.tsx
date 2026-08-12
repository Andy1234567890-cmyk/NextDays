// Kanal-Ereignisse — was die Portale gemeldet haben (Sidebar „Channel Manager").
//
// Die Ereignisse (`channex_webhook_event`) wurden seit jeher gespeichert und die
// Endpunkte existierten auch — es gab nur keine Oberfläche dafür. Damit blieben
// Sync-Fehler, nicht zuordenbare Buchungen und fristgebundene Anfragen
// unsichtbar. Diese Seite schließt das.
import { KanalEreignisse } from "@/components/channel-manager/kanal-ereignisse";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { listKanalEreignisse } from "@/lib/channex";

export const dynamic = "force-dynamic";

export default async function KanalEreignissePage() {
  const res = await listKanalEreignisse(false, 100);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      {/* `channex_webhook_event` ist für `authenticated` gesperrt (Wurzel 6,
          0337 — Gast-PII im Payload) und liegt nicht in der Publikation; ein
          Abo darauf wäre eine stumme Attrappe. `reservations` ist die erlaubte
          Quelle und bewegt sich bei genau den Ereignissen mit, die zählen
          (neue/geänderte/stornierte Portal-Buchung). ENTFÄLLT: ein reiner
          Sync-Fehler ohne Buchungsbezug erscheint erst beim nächsten Laden. */}
      <RealtimeRefresh tables={["reservations"]} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Kanal-Ereignisse</h1>
        <p className="text-sm text-muted-foreground">
          Meldungen der Portale: Synchronisierungsfehler, nicht zuordenbare
          Buchungen, Anfragen und Bewertungen.
        </p>
      </header>

      <KanalEreignisse
        ereignisse={res.ok ? res.data : []}
        fehler={res.ok ? null : res.error}
      />
    </div>
  );
}
