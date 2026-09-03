// Absprung in die Schwester-App (ADR-0019). Seit der Aufteilung sind Marktplatz
// und PMS zwei Apps; der Wechsel zwischen beiden Welten ist deshalb ein echter
// App-Wechsel und keine Navigation mehr.
//
// SCHWESTERDATEI: die gleichnamige Datei der Schwester-App — identisch halten.
import { Linking, Platform } from "react-native";

import type { AndereApp } from "@/theme/tokens";

/**
 * Öffnet die Schwester-App auf dem angegebenen Pfad. Ist sie nicht installiert
 * (`canOpenURL` false), geht es in den Store — KEIN stiller No-Op, der Nutzer
 * bekommt immer eine Reaktion.
 *
 * Voraussetzung, sonst liefert `canOpenURL` IMMER false:
 *   iOS      Info.plist  LSApplicationQueriesSchemes = [<scheme der anderen App>]
 *   Android  Manifest    <queries><intent> mit demselben Scheme
 */
export async function zurAnderenApp(ziel: AndereApp, pfad: string): Promise<void> {
  const url = `${ziel.scheme}://${pfad}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
    return;
  }
  await Linking.openURL(Platform.OS === "ios" ? ziel.appStoreUrl : ziel.playStoreUrl);
}
