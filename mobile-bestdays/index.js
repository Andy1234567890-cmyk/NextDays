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

AppRegistry.registerComponent(appName, () => App);
