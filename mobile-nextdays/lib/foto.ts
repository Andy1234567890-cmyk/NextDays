// Ein Bild von der Kamera oder aus der Galerie holen — die EINE Stelle, an der
// diese App den System-Bildwähler anspricht.
//
// Warum hier und nicht im Screen: die Auswahl hat vier Ausgänge, die alle
// unterschiedlich behandelt werden müssen — Bild da, Nutzer hat abgebrochen,
// Berechtigung verweigert, technischer Fehler. Ein Screen, der das inline macht,
// verwechselt „abgebrochen" mit „fehlgeschlagen" und zeigt eine Fehlermeldung,
// wo der Nutzer bloß zurückgetippt hat.
//
// Die Bilder werden VOR dem Hochladen verkleinert (maxWidth/maxHeight/quality):
// ein Handyfoto sind heute 8–12 MB, das serverseitige Limit liegt bei 20 MB, und
// eine Reinigungskraft steht oft im Funkloch des Kellers. 1600 px reichen für
// einen Nachweis („ist das Bad sauber"), sind aber ein Zehntel der Datenmenge.
// Kein Zuschnitt und keine Bearbeitung: ein Nachweisfoto soll zeigen, was da
// war, nicht was jemand daraus gemacht hat.
import { PermissionsAndroid, Platform } from "react-native";
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from "react-native-image-picker";

import type { Bilddatei } from "@/lib/tasks";

/** Nur was der Server annimmt (er prüft die echten Anfangsbytes, Wurzel 8). */
const ERLAUBT = ["image/jpeg", "image/png", "image/webp"];

const OPTIONEN = {
  mediaType: "photo" as const,
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8 as const,
  // Kein Base64 im Speicher: die Datei wird über ihren URI hochgeladen. Sonst
  // liegt ein 12-MB-Foto zusätzlich als String im JS-Heap.
  includeBase64: false,
  saveToPhotos: false,
};

export type FotoErgebnis =
  | { art: "bild"; bild: Bilddatei }
  | { art: "abgebrochen" }
  | { art: "fehler"; text: string };

/**
 * Kamerarecht auf Android erfragen.
 *
 * iOS regelt das über die Info.plist-Texte und den System-Dialog, den der
 * Picker selbst auslöst — dort gibt es nichts zu erfragen. Auf Android muss es
 * die App tun, sonst schließt sich die Kamera sofort wieder, ohne Hinweis.
 */
async function kameraRechtHolen(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const ergebnis = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  return ergebnis === PermissionsAndroid.RESULTS.GRANTED;
}

/** Foto aufnehmen. */
export async function fotoAufnehmen(): Promise<FotoErgebnis> {
  if (!(await kameraRechtHolen())) {
    return {
      art: "fehler",
      text: "Ohne Kamera-Freigabe kann kein Foto aufgenommen werden. Du kannst sie in den Einstellungen erteilen.",
    };
  }
  return auswerten(await launchCamera(OPTIONEN));
}

/** Vorhandenes Bild auswählen (System-Bildwähler, kein Lese-Recht nötig). */
export async function fotoWaehlen(): Promise<FotoErgebnis> {
  return auswerten(await launchImageLibrary(OPTIONEN));
}

/**
 * Die Antwort des Pickers in einen der drei Ausgänge übersetzen.
 *
 * Exportiert, damit die Auswertung ohne Native-Modul geprüft werden kann — sie
 * trägt die eigentliche Logik (Abbruch ≠ Fehler, Typ- und URI-Prüfung).
 */
export function auswerten(antwort: ImagePickerResponse): FotoErgebnis {
  if (antwort.didCancel) return { art: "abgebrochen" };
  if (antwort.errorCode === "permission") {
    return {
      art: "fehler",
      text: "Der Zugriff auf Kamera bzw. Fotos ist nicht freigegeben.",
    };
  }
  if (antwort.errorCode) {
    // Die Meldung des Systems weitergeben, nicht durch eine eigene ersetzen —
    // sie benennt den Grund genauer (Wurzel 5).
    return { art: "fehler", text: antwort.errorMessage ?? "Bild nicht verfügbar." };
  }
  const treffer: Asset | undefined = antwort.assets?.[0];
  if (!treffer?.uri) {
    return { art: "fehler", text: "Bild nicht verfügbar." };
  }
  const typ = treffer.type ?? "";
  if (!ERLAUBT.includes(typ)) {
    // Klar fehlschlagen statt „image/jpeg" zu behaupten: der Server prüft die
    // echten Bytes und würde die Datei ohnehin mit 415 ablehnen (Wurzel 4/8).
    return {
      art: "fehler",
      text: "Dieses Format wird nicht angenommen — bitte ein JPEG-, PNG- oder WebP-Bild.",
    };
  }
  return {
    art: "bild",
    bild: {
      uri: treffer.uri,
      name: treffer.fileName ?? `nachweis.${typ.split("/")[1] ?? "jpg"}`,
      type: typ,
    },
  };
}
