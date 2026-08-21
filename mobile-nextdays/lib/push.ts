// Push-Benachrichtigungen (FCM) — Registrierung, Berechtigung, Sprungziel.
//
// WAS HIER NICHT PASSIERT: das ANZEIGEN einer Meldung bei geschlossener oder
// im Hintergrund liegender App. Das macht Android selbst aus der
// `notification`-Nutzlast; deshalb braucht es dafuer keine Anzeige-Bibliothek
// (Notifee ist seit 07.04.2026 archiviert und kommt bewusst nicht zum Einsatz).
// Im VORDERGRUND zeigt FCM nichts — das ist Absicht: dort laufen die
// Realtime-Abos, die Liste aktualisiert sich ohnehin sofort.
//
// DIE BERECHTIGUNG IST DER STILLE FALLSTRICK: ab Android 13 verwirft das System
// jede Meldung, wenn der Nutzer sie verweigert hat — FCM meldet dem Server
// trotzdem „zugestellt". Ein Push, der nie ankommt, sieht also von beiden Seiten
// wie ein Erfolg aus. `pushBereit()` gibt darum den echten Zustand zurueck,
// damit die Oberflaeche ihn benennen kann statt eine Attrappe zu zeigen.
import { Linking, PermissionsAndroid, Platform } from "react-native";

import { call } from "@/lib/api";

/** Welche der beiden Apps (ADR-0019) — entscheidet, welche Pushes hier landen. */
const APP_KENNUNG = "mynextdays";

/**
 * Firebase Messaging ERST BEIM AUFRUF laden, nicht beim Import.
 *
 * `@react-native-firebase/messaging` greift schon beim Laden des Moduls auf die
 * native Seite zu (`NativeRNFBTurboApp`). Ein Top-Level-Import zieht das in
 * jede Datei, die `lib/push` irgendwo in ihrer Kette hat — beim Rendern der App
 * also in den gesamten Baum, obwohl Push zu diesem Zeitpunkt niemand braucht.
 *
 * `require` im Funktionskörper heißt: die native Seite wird genau dann
 * angefasst, wenn eine Push-Funktion wirklich läuft. Das ist zugleich der
 * Grund, warum `App.test.tsx` die App rendern kann, ohne dass ein Mock nötig
 * wäre: es wird nichts geladen, was es im Testlauf nicht gibt.
 */
function fcm(): any {
  return require("@react-native-firebase/messaging");
}

/** Das zuletzt beim Server angemeldete Token. Verhindert, dass derselbe Wert
 *  bei jedem Vordergrund-Wechsel erneut hochgeladen wird. */
let gemeldet: string | null = null;

/**
 * Die Melde-Berechtigung einholen.
 *
 * Android 13+ braucht die Laufzeit-Abfrage; darunter gilt sie als erteilt.
 * Auf iOS fragt Firebase selbst (dort ist es seit je Pflicht).
 */
async function berechtigungHolen(): Promise<boolean> {
  if (Platform.OS === "android") {
    // Number, weil Platform.Version auf Android die API-Ebene ist.
    if (Number(Platform.Version) < 33) return true;
    const ergebnis = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return ergebnis === PermissionsAndroid.RESULTS.GRANTED;
  }
  const m = fcm();
  const status = await m.requestPermission(m.getMessaging());
  return (
    status === m.AuthorizationStatus.AUTHORIZED ||
    status === m.AuthorizationStatus.PROVISIONAL
  );
}

/** Token beim Server anmelden. Fehler bleiben still — Push ist eine Zugabe,
 *  kein Grund, die Anmeldung des Nutzers scheitern zu lassen. */
async function tokenMelden(token: string): Promise<void> {
  if (!token || token === gemeldet) return;
  const res = await call("/notification-settings/push-geraet", {
    method: "PUT",
    body: {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
      app: APP_KENNUNG,
    },
  });
  if (res.ok) gemeldet = token;
}

/**
 * Push einrichten — nach dem Login aufzurufen.
 *
 * Registriert das Geraet und haengt sich an `onTokenRefresh`. Der zweite Teil
 * ist nicht optional: FCM tauscht Tokens jederzeit aus (Neuinstallation,
 * Datenloeschung, Restore). Ohne den Listener stirbt Push fuer einen Teil der
 * Nutzer stumm — der Server schickt weiter an ein Token, das niemandem mehr
 * gehoert.
 *
 * Gibt zurueck, ob Push wirklich moeglich ist. `false` heisst: die Berechtigung
 * fehlt — die Oberflaeche darf dann nicht behaupten, Meldungen seien an.
 */
export async function pushEinrichten(): Promise<boolean> {
  const erlaubt = await berechtigungHolen();
  if (!erlaubt) return false;
  const m = fcm();
  const messaging = m.getMessaging();
  const token = await m.getToken(messaging);
  await tokenMelden(token);
  // Rueckgabewert (Abmeldefunktion) bewusst verworfen: der Listener lebt so
  // lange wie die App. Ein Aufraeumen an einer Komponente waere falsch — er
  // gehoert nicht zu einem Bildschirm.
  m.onTokenRefresh(messaging, (neu: string) => {
    void tokenMelden(neu);
  });
  return true;
}

/**
 * Beim Logout abmelden.
 *
 * Der Gegenzustand zur Anmeldung (Wurzel 1): ohne diesen Aufruf bekaeme das
 * Telefon weiter die Meldungen des abgemeldeten Betriebs — sichtbar im
 * Sperrbildschirm, fuer den naechsten Nutzer desselben Geraets.
 */
export async function pushAbmelden(): Promise<void> {
  const m = fcm();
  const token =
    gemeldet ?? (await m.getToken(m.getMessaging()).catch(() => null));
  gemeldet = null;
  if (!token) return;
  await call("/notification-settings/push-geraet/abmelden", {
    method: "POST",
    body: { token },
  });
}

/**
 * Server-Zielpfad → App-Deep-Link.
 *
 * Der Server kennt EINEN Pfad je Ereignis (`/reservierungen/{id}`,
 * `/posteingang/{id}`) — den des Web-Dashboards. Ihn dort zu verdoppeln, nur
 * weil die App eine Route anders nennt, waere eine zweite Wahrheit im Backend
 * (Wurzel 4). Deshalb liegt die Zuordnung HIER, an einer Stelle.
 *
 * Unbekannte Pfade ergeben `null`: dann oeffnet die App normal, statt auf einen
 * geratenen Screen zu springen.
 */
export function zielAlsDeepLink(ziel: string | undefined): string | null {
  if (!ziel) return null;
  const pfad = ziel.startsWith("/") ? ziel.slice(1) : ziel;
  const [kopf, id] = pfad.split("/");
  // `reservierungen/:id` heisst in der App genauso — 1:1 durchreichen.
  if (kopf === "reservierungen" && id) return `mynextdays://reservierungen/${id}`;
  if (kopf === "aufgaben" && id) return `mynextdays://aufgaben/${id}`;
  // Der Posteingang heisst im Web `posteingang`, in der App `inbox`.
  if (kopf === "posteingang") {
    return id ? `mynextdays://inbox/${id}` : "mynextdays://inbox";
  }
  return null;
}

/**
 * Den Tap auf eine Meldung verdrahten — einmal beim App-Start aufzurufen.
 *
 * ZWEI Wege, und beide sind noetig:
 *   - `onNotificationOpenedApp`: die App lag im Hintergrund und wird durch den
 *     Tap nach vorn geholt.
 *   - `getInitialNotification`: die App war GESCHLOSSEN und wurde durch den Tap
 *     erst gestartet. Ohne diesen Zweig landet man auf der Startseite und der
 *     Grund des Antippens ist verloren — der haeufigste Fall bei einer Meldung,
 *     die nachts kam.
 *
 * Der Sprung laeuft ueber `Linking`, nicht ueber ein Navigations-Objekt: das
 * Deep-Link-Handling steht bereits in App.tsx (`linking`), und ein zweiter Weg
 * in dieselben Screens waere die zweite Wahrheit, die stiller veraltet.
 */
export function pushTapVerdrahten(): void {
  const m = fcm();
  const messaging = m.getMessaging();

  const springen = (ziel: string | undefined) => {
    const link = zielAlsDeepLink(ziel);
    // Kein Fallback auf die Startseite: ein unbekanntes Ziel bedeutet, dass
    // Server und App auseinanderlaufen. Dann ist Nichtstun ehrlicher als ein
    // geratener Screen (Wurzel 4).
    if (link) void Linking.openURL(link);
  };

  m.onNotificationOpenedApp(messaging, (nachricht: { data?: { ziel?: string } }) => {
    springen(nachricht?.data?.ziel);
  });

  // Kaltstart: die Meldung liegt schon vor, bevor irgendein Screen steht.
  void m
    .getInitialNotification(messaging)
    .then((nachricht: { data?: { ziel?: string } } | null) => {
      if (nachricht) springen(nachricht.data?.ziel);
    });
}
