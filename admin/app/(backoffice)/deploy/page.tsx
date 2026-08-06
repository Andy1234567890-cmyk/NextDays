// Deploy-Monitor: was läuft gerade auf welchem Stand, und was ist zuletzt
// ausgerollt worden. Quelle ist Coolify (über /platform/deploy), nicht unsere
// Datenbank — deshalb kein Realtime, sondern Takt-Refresh in der Tabelle.
import { ApiError } from "@nextdays/auth/errors";

import { DeployTabelle } from "@/components/deploy-tabelle";
import { getDeployUebersicht, getPlatformMe } from "@/lib/backoffice";

export default async function DeploySeite() {
  const me = await getPlatformMe();

  let uebersicht;
  let fehler: string | null = null;
  try {
    uebersicht = await getDeployUebersicht();
  } catch (exc) {
    // Nicht eingerichtet oder Coolify nicht erreichbar: den Grund zeigen,
    // statt eine leere Tabelle als "alles ruhig" auszugeben.
    fehler =
      exc instanceof ApiError
        ? exc.message
        : "Deploy-Status konnte nicht geladen werden.";
  }

  const aktiv = uebersicht?.aktiv ?? false;

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Deploy-Monitor
      </h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {fehler
          ? "Status nicht verfügbar"
          : aktiv
            ? "Ein Ausrollen läuft gerade."
            : `${uebersicht?.apps.length ?? 0} Anwendungen · zuletzt ausgerollter Stand`}
      </p>

      {fehler ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">{fehler}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Der Monitor braucht COOLIFY_API_URL und COOLIFY_TOKEN in der
            Server-Konfiguration von nextdays-api.
          </p>
        </div>
      ) : (
        <DeployTabelle
          apps={uebersicht?.apps ?? []}
          aktiv={aktiv}
          darfDeployen={me.can_write}
        />
      )}
    </div>
  );
}
