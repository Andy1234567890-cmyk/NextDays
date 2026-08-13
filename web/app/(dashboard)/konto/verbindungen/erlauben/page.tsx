// Konto → Verbindungen → Erlauben: der OAuth-Zustimmungsdialog des
// MCP-Connectors (0385).
//
// WARUM DIESE SEITE HIER LIEGT und nicht in der API: Die FastAPI kennt nur den
// `Authorization`-Header, ein Browser-Formular trägt keinen. Eine dort
// gerenderte Seite könnte den Nutzer gar nicht identifizieren — sie bräuchte
// ein zweites Login neben dem echten. Hier ist der Nutzer bereits angemeldet.
//
// Die SICHERHEITSPRÜFUNG ist vorher schon gelaufen: `/api/v1/mcp/authorize`
// holt das Client-Dokument, prüft PKCE und die `redirect_uri` und leitet erst
// dann hierher. Diese Seite zeigt also nur noch, was geprüft wurde.
import { ZustimmungDialog } from "@/components/konto/mcp-zustimmung-dialog";

type Suche = {
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  scope?: string;
  state?: string;
  resource?: string;
  host?: string;
};

export default async function VerbindungErlaubenPage({
  searchParams,
}: {
  searchParams: Promise<Suche>;
}) {
  const p = await searchParams;

  // Ohne die Pflichtangaben ist das kein gültiger Einstieg — dann gibt es
  // nichts zu bestätigen. Klar sagen statt einen leeren Dialog zeigen.
  if (!p.client_id || !p.redirect_uri || !p.code_challenge) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h2 className="font-display text-lg font-extrabold">
          Ungültige Anfrage
        </h2>
        <p className="text-sm text-muted-foreground">
          Diese Seite wird vom Verbindungsvorgang aufgerufen. Starten Sie ihn in
          der Anwendung, die den Zugriff anfragt.
        </p>
      </div>
    );
  }

  return (
    <ZustimmungDialog
      clientId={p.client_id}
      redirectUri={p.redirect_uri}
      codeChallenge={p.code_challenge}
      scope={p.scope ?? "mcp:read"}
      state={p.state ?? ""}
      resource={p.resource ?? ""}
      host={p.host ?? p.client_id}
    />
  );
}
