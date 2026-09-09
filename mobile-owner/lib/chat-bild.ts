// Bilder für den verschlüsselten Chat (0611, ADR-0029).
//
// DER UNTERSCHIED ZU `mobile-nextdays/lib/foto.ts`: Dort geht die Datei über
// ihren URI hoch, der Server sieht ein Bild und prüft die Anfangsbytes. Hier
// wird sie VOR dem Hochladen verschlüsselt — der Server bekommt Zufallsbytes
// und kann sie nicht prüfen (er darf sie auch nicht sehen können).
//
// Deshalb müssen die Bytes durch den JS-Speicher, statt am URI zu bleiben. Das
// kostet Arbeitsspeicher, und genau deshalb wird HART verkleinert: 1280 px und
// Qualität 0.7. Ein Handyfoto sind 8-12 MB; verschlüsselt und base64-kodiert
// wüchse das auf über 16 MB, und auf einem älteren Telefon ist das der Absturz
// beim Absenden. 1280 px reichen für „der Zaun ist kaputt" und landen bei rund
// 300 KB.
//
// KEINE MAGIC-BYTE-PRÜFUNG NACH DEM VERSCHLÜSSELN — sie wäre unmöglich; der
// Schutz liegt im privaten Bucket und darin, dass die Bytes ohne Schlüssel in
// keinem Betrachter ein Bild ergeben (siehe `owner_chat/bilder.py`).
import { Buffer } from "@craftzdog/react-native-buffer";
import { PermissionsAndroid, Platform } from "react-native";
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from "react-native-image-picker";

const OPTIONEN = {
  mediaType: "photo" as const,
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.7 as const,
  // Base64 wird hier GEBRAUCHT, anders als in der PMS-App: die Bytes müssen
  // durch die Verschlüsselung, ein URI allein reicht nicht.
  includeBase64: true,
  saveToPhotos: false,
};

export type BildErgebnis =
  | { art: "bild"; daten: Uint8Array }
  | { art: "abgebrochen" }
  | { art: "fehler"; text: string };

async function kameraRechtHolen(): Promise<boolean> {
  // iOS regelt das über die Info.plist und den System-Dialog des Pickers;
  // auf Android muss die App fragen, sonst schließt sich die Kamera sofort
  // wieder — ohne Hinweis, was der Nutzer als Absturz liest.
  if (Platform.OS !== "android") return true;
  const ergebnis = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  return ergebnis === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Die vier Ausgänge der Auswahl sauber trennen.
 *
 * „Abgebrochen" ist KEIN Fehler: wer zurücktippt, soll keine Fehlermeldung
 * sehen. Genau diese Verwechslung ist der Grund, warum die Auswahl nicht
 * inline im Screen steht.
 */
function auswerten(antwort: ImagePickerResponse): BildErgebnis {
  if (antwort.didCancel) return { art: "abgebrochen" };
  if (antwort.errorCode === "permission") {
    return { art: "fehler", text: "keine_berechtigung" };
  }
  if (antwort.errorCode) {
    return { art: "fehler", text: antwort.errorMessage || "unbekannt" };
  }
  const bild: Asset | undefined = antwort.assets?.[0];
  if (!bild?.base64) {
    // Kein Bild ohne Daten durchreichen (Wurzel 4): ein leeres Uint8Array
    // ergäbe eine Nachricht mit einem Anhang, den niemand öffnen kann.
    return { art: "fehler", text: "keine_daten" };
  }
  return { art: "bild", daten: new Uint8Array(Buffer.from(bild.base64, "base64")) };
}

/** Foto aufnehmen. */
export async function fotoAufnehmen(): Promise<BildErgebnis> {
  if (!(await kameraRechtHolen())) {
    return { art: "fehler", text: "keine_berechtigung" };
  }
  return auswerten(await launchCamera(OPTIONEN));
}

/** Bild aus der Galerie wählen. */
export async function bildWaehlen(): Promise<BildErgebnis> {
  return auswerten(await launchImageLibrary(OPTIONEN));
}
