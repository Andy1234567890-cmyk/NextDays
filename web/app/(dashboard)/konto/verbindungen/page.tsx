// Konto → Verbindungen: erteilte MCP-Zugriffe (KI-Assistenten) verwalten.
// Zeigt, welche Anwendung wann lesenden Zugriff bekommen hat, erlaubt das
// Trennen und protokolliert jeden Abruf. Server-Komponente: lädt und übergibt
// an die Client-Listen.
import { VerbindungenListe } from "@/components/konto/mcp-verbindungen-liste";
import { ZugriffeListe } from "@/components/konto/mcp-zugriffe-liste";
import { listeVerbindungen, listeZugriffe } from "@/lib/mcp-verbindungen";

export default async function VerbindungenPage() {
  // Parallel: die beiden Abfragen hängen nicht voneinander ab.
  const [res, protokoll] = await Promise.all([
    listeVerbindungen(),
    listeZugriffe(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-extrabold">Verbindungen</h1>
          <p className="text-sm text-muted-foreground">
            KI-Assistenten, denen Sie lesenden Zugriff auf Ihr Konto erlaubt
            haben. Der Zugriff umfasst Kalender und Buchungen; Notizen und
            Nachrichteninhalte nur, wenn Sie sie ausdrücklich freigegeben haben.
            Schreibend kann keine dieser Verbindungen etwas tun.
          </p>
        </div>
        {!res.ok ? (
          <p className="text-sm text-destructive">
            Verbindungen konnten nicht geladen werden.
          </p>
        ) : (
          <VerbindungenListe verbindungen={res.data} />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-extrabold">
            Protokoll der Abrufe
          </h2>
          <p className="text-sm text-muted-foreground">
            Was verbundene Assistenten gelesen haben. Sie brauchen diese
            Übersicht, wenn ein Gast wissen möchte, wer seine Daten erhalten hat.
          </p>
        </div>
        {!protokoll.ok ? (
          <p className="text-sm text-destructive">
            Protokoll konnte nicht geladen werden.
          </p>
        ) : (
          <ZugriffeListe zugriffe={protokoll.data} />
        )}
      </div>
    </div>
  );
}
