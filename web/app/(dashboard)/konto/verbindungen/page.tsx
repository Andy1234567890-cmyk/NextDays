// Konto → Verbindungen: erteilte MCP-Zugriffe (KI-Assistenten) verwalten.
// Zeigt, welche Anwendung wann lesenden Zugriff bekommen hat, und erlaubt das
// Trennen. Server-Komponente: lädt und übergibt an die Client-Liste.
import { VerbindungenListe } from "@/components/konto/mcp-verbindungen-liste";
import { listeVerbindungen } from "@/lib/mcp-verbindungen";

export default async function VerbindungenPage() {
  const res = await listeVerbindungen();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-extrabold">Verbindungen</h1>
        <p className="text-sm text-muted-foreground">
          KI-Assistenten, denen Sie lesenden Zugriff auf Ihr Konto erlaubt
          haben. Der Zugriff umfasst Kalender, Buchungen, Notizen und den
          Posteingang — schreibend kann keine dieser Verbindungen etwas tun.
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
  );
}
