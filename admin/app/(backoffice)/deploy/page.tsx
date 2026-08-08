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
  // Wie viele Anwendungen warten auf einen Deploy? Das ist die Zahl, wegen der
  // jemand diese Seite öffnet — sie gehört in die erste Zeile, nicht in eine
  // Spalte weiter unten.
  const offen = (uebersicht?.apps ?? []).filter(
    (a) => a.rueckstand?.betrifft_mich,
  ).length;

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
        {!fehler && uebersicht?.main_kurz_sha ? (
          <>
            {" · main "}
            <span className="font-mono text-xs">
              {uebersicht.main_kurz_sha}
            </span>
          </>
        ) : null}
      </p>

      {!fehler && offen > 0 ? (
        <p className="mt-3 inline-flex rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
          {offen === 1
            ? "1 Anwendung hat noch nicht ausgerollte Änderungen"
            : `${offen} Anwendungen haben noch nicht ausgerollte Änderungen`}
        </p>
      ) : null}

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
