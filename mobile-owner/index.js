/**
 * @format
 */

import 'react-native-url-polyfill/auto'; // URL/URLSearchParams für @supabase/supabase-js (bare RN)
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { absturzHandlerSetzen } from './lib/absturzmeldung';

// ZUERST, vor jedem anderen Aufruf: ab hier hat jeder unbehandelte Fehler
// und jede unbehandelte Promise-Rejection eine Spur im Protokoll. Fuer den
// Kunden unsichtbar — die Zeile geht nach `adb logcat`, nicht auf den
// Bildschirm.
absturzHandlerSetzen();

// Push-Hintergrundempfang. MUSS hier stehen, ausserhalb des Component-Trees:
// bei geschlossener App startet React Native nur diesen Einstiegspunkt, keine
// Komponente. Ein Handler, der in einem Screen registriert wird, existiert
// genau dann nicht, wenn er gebraucht wird — und die Meldung fiele aus.
//
// Die ANZEIGE macht Android selbst aus der `notification`-Nutzlast; hier ist
// nichts zu tun. Der Handler muss nur vorhanden sein, damit die Nutzlast
// zugestellt wird, und er muss ein Promise zurueckgeben (Timeout 30 s, gesetzt
// in firebase.json).
//
// ABGESICHERT (28.08.2026): `getMessaging()` fasst beim AUFRUF die native
// Firebase-Seite an. Stand dieser Aufruf ungeschuetzt auf Modulebene, war er
// die allererste Zeile des App-Starts — vor React, vor jeder Fehlergrenze.
// Wirft er (fehlende/fehlerhafte `google-services.json` — die Datei ist
// gitignoriert und existiert pro Arbeitsplatz einzeln —, nicht initialisiertes
// Firebase, fehlende Play-Services), startet die App NIE: sofortiger Absturz
// beim Oeffnen, ohne Bildschirm und ohne Spur. Push ist eine Zugabe; sein
// Fehlschlag darf den Start nicht kosten (Wurzel 5: der Hauptpfad kippt nicht).
try {
  // `require` statt Top-Level-`import`: ES-Importe werden ALLE ausgefuehrt,
  // bevor die erste Zeile dieser Datei laeuft — ein Import von
  // `@react-native-firebase/messaging` fasst die native Seite also an, bevor
  // `absturzHandlerSetzen()` ueberhaupt gerufen wurde, und ein Wurf dabei
  // waere wieder der spurlose Sofort-Absturz. Mit `require` liegt der Zugriff
  // INNERHALB des `try`. Dasselbe Muster wie `fcm()` in `lib/push.ts`.
  const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
  setBackgroundMessageHandler(getMessaging(), async () => {
    // Absichtlich leer: kein eigenes Rendern, kein Nachladen. Was der Nutzer
    // sieht, steht in der Meldung; die Details holt die App beim Antippen —
    // dann ist er angemeldet und der Server maskiert regulaer (Wurzel 3).
  });
} catch (e) {
  // Laut, nicht still: ohne diese Zeile weiss niemand, dass Push tot ist.
  //
  // Aber der BEKANNTE Fall ist ruhig: solange es keine Firebase-App fuer
  // `com.mynextdays.owner` gibt, wirft jeder Messaging-Zugriff hier. Mit
  // vollem Stacktrace beim Start sieht das aus wie ein Absturz und begraebt
  // echte Fehler. `lib/push.ts` traegt die Unterscheidung — hier steht sie in
  // Klartext, weil dieser Block VOR der App laeuft und nichts importieren
  // soll, was die native Seite anfasst (siehe Kommentar oben).
  const fehltKonfig =
    e instanceof Error && e.message.includes("No Firebase App '[DEFAULT]'");
  if (fehltKonfig) {
    console.info(
      '[push] Hintergrundempfang aus: keine Firebase-App konfiguriert — ' +
        'Behebung: android/app/GOOGLE-SERVICES-FEHLT.md',
    );
  } else {
    console.warn('[push] Hintergrundempfang nicht eingerichtet:', e);
  }
}

AppRegistry.registerComponent(appName, () => App);
