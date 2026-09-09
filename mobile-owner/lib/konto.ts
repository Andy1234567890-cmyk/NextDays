// Konto-Löschung des Eigentümers — Store-Voraussetzung, nicht Beigabe.
//
// WARUM DIESE DATEI NICHT AUS `mobile-nextdays/lib/konto.ts` KOPIERT IST:
// Dort führt sie das GANZE Konto (Name, E-Mail, Passwort, 2FA, Geräteverlauf).
// Diese App darf davon nichts — sie hat fünf schreibende Aktionen, und keine
// davon ist eine Konto-Änderung. Eine Kopie brächte acht Funktionen mit, die
// hier keinen Aufrufer hätten, und mit ihnen die Erwartung, dass es die
// zugehörigen Bildschirme gibt. Übernommen ist deshalb NUR der Löschweg.
//
// WARUM ES IHN ÜBERHAUPT GIBT (Entscheidung vom 09.09.2026):
// Google verlangt den In-App-Weg für Apps, in denen man ein Konto ANLEGEN
// kann („Your app supports account creation within the app if a user can
// complete creating an app account directly in the app or if the app directs
// the user to an app account creation flow outside of the app"). Diese App
// kann das nicht: Eigentümer werden von ihrem Betrieb eingeladen, und es gibt
// weder einen Registrierweg noch einen Verweis darauf (`screens/Anmelden.tsx`).
// Formal reicht also die öffentliche Löschseite.
//
// Gebaut wurde er trotzdem, aus zwei Gründen, die beide nichts mit dem Formular
// zu tun haben:
//   1. Die Löschseite auf mynextdays.com sagt wörtlich „In der App findest du
//      die Löschung unter Profil → Konto". Für DIESE App war das eine
//      Falschaussage.
//   2. Der Weg über das Web-Formular läuft im Backend auf dasselbe Löschbuch —
//      und der Gegenzustand des Eigentümers (freigewordene Sperrnächte,
//      Familienzugänge) fehlte dort ebenso. Wer den Knopf baut, sieht das.
//
// Der Server unterscheidet zwei Ausgänge; die App darf sie NICHT gleich
// behandeln (Wurzel 4). Für den Eigentümer ist es immer der erste — er ist nie
// Kontoinhaber, sonst wäre er in `screens/FalscheRolle.tsx` gelandet. Der
// zweite bleibt trotzdem im Typ, weil der Contract ihn führt und ein Feld
// wegzulassen heißt, eine Antwort zu erfinden.
import { call, type Result } from "@/lib/api";

export type LoeschStatus = {
  antrag_offen: boolean;
  /** Wann der Antrag gestellt wurde (ISO). null = keiner offen. */
  beantragt_am: string | null;
  /** Was trotz Löschung aufbewahrt wird. null, solange kein Antrag läuft. */
  hinweis: string | null;
};

export type LoeschErgebnis = {
  /**
   * true = der Zugang ist weg. false = es liegt ein ANTRAG vor, weil am Konto
   * der ganze Betrieb hängt — beim Eigentümer der Fall, den es nicht gibt.
   */
  geloescht: boolean;
  antrag_offen: boolean;
  beantragt_am: string | null;
  detail: string;
  hinweis: string | null;
};

/** Liegt für dieses Konto schon ein Löschantrag vor? */
export async function loeschStatus(): Promise<Result<LoeschStatus>> {
  return call("/auth/account/deletion");
}

/**
 * Eigenes Konto löschen. Das aktuelle Passwort ist Pflicht — ein gekapertes
 * Token allein darf kein Konto vernichten (Wurzel 7).
 *
 * Was der Server dabei zusätzlich tut und was die Oberfläche deshalb ankündigen
 * muss: genehmigte, noch nicht abgelaufene Aufenthalte dieses Eigentümers
 * werden zurückgenommen und ihre Nächte freigegeben, und Familienzugänge
 * verlieren die Sicht auf das Objekt. Beides ist kein Nebeneffekt, sondern der
 * Gegenzustand — ohne ihn bliebe das Objekt gesperrt, ohne dass noch ein
 * Antrag darauf zeigt.
 */
export async function kontoLoeschen(
  currentPassword: string,
  grund?: string,
): Promise<Result<LoeschErgebnis>> {
  return call("/auth/account/deletion", {
    method: "POST",
    body: { current_password: currentPassword, grund: grund ?? null },
  });
}
