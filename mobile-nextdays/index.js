/**
 * @format
 */

import 'react-native-url-polyfill/auto'; // URL/URLSearchParams für @supabase/supabase-js (bare RN)
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Push-Hintergrundempfang. MUSS hier stehen, ausserhalb des Component-Trees:
// bei geschlossener App startet React Native nur diesen Einstiegspunkt, keine
// Komponente. Ein Handler, der in einem Screen registriert wird, existiert
// genau dann nicht, wenn er gebraucht wird — und die Meldung fiele aus.
//
// Die ANZEIGE macht Android selbst aus der `notification`-Nutzlast; hier ist
// nichts zu tun. Der Handler muss nur vorhanden sein, damit die Nutzlast
// zugestellt wird, und er muss ein Promise zurueckgeben (Timeout 30 s, gesetzt
// in firebase.json).
setBackgroundMessageHandler(getMessaging(), async () => {
  // Absichtlich leer: kein eigenes Rendern, kein Nachladen. Was der Nutzer
  // sieht, steht in der Meldung; die Details holt die App beim Antippen —
  // dann ist er angemeldet und der Server maskiert regulaer (Wurzel 3).
});

AppRegistry.registerComponent(appName, () => App);
