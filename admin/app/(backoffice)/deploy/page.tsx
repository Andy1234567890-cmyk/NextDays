// Deploy-Monitor: was läuft gerade auf welchem Stand, und was ist zuletzt
// ausgerollt worden. Coolify ist die Quelle der Wahrheit; gelesen wird sein
// Spiegel (public.deploy_spiegel), den die Tabelle per Realtime abonniert.
import { ApiError } from "@nextdays/auth/errors";

import { DeployTabelle, SPIEGEL_STILL_MS } from "@/components/deploy-tabelle";
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

  // Steht der Spiegel als Ganzes still, ist ALLES auf dieser Seite womöglich
  // veraltet — das gehört nach oben, nicht in eine Spalte. `spiegel_geprueft_at`
  // ist der ÄLTESTE Blick des Workers über alle Apps und damit unsere Uhr, nicht
  // der Zeitpunkt eines Coolify-Ereignisses (Wurzel 5b). Fehlt das Feld (älterer
  // Lesepfad), wird nichts behauptet.
  const geprueft = uebersicht?.spiegel_geprueft_at
    ? new Date(uebersicht.spiegel_geprueft_at)
    : null;
  const spiegelSteht =
    geprueft !== null && Date.now() - geprueft.getTime() >= SPIEGEL_STILL_MS;

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

      {!fehler && spiegelSteht && geprueft ? (
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Der Spiegel steht still — die Angaben unten können veraltet sein.
          </p>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80">
            Zuletzt haben wir am {geprueft.toLocaleString("de-DE")} bei Coolify
            nachgesehen. Vermutlich läuft der Spiegel-Job im Worker nicht mehr;
            der tatsächliche Deploy-Zustand kann davon abweichen.
          </p>
        </div>
      ) : null}

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
