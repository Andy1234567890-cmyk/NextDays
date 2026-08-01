// Standort des Geräts für die Umkreissuche („In der Nähe"). Kapselt Berechtigung
// und Abfrage an EINER Stelle — Screens rufen nur `aktuellerStandort()`.
//
// Bewusst nur der GROBE Standort: der Server filtert gegen gerundete
// Objekt-Koordinaten, eine metergenaue Position bringt nichts und wäre mehr
// Datenerhebung als nötig. Die Position wird weder gespeichert noch geloggt,
// sie geht nur als Query-Parameter in die Suchanfrage.
//
// Fehler werden NICHT verschluckt (Wurzel 5): der Aufrufer bekommt einen
// klaren Grund und kann ihn anzeigen, statt stillschweigend „überall" zu suchen.
//
// Das native Modul wird BEWUSST erst beim ersten Aufruf geladen. Ein Import auf
// Modulebene wirft in einem App-Build ohne den nativen Teil (nach `pod install`
// ohne Rebuild) schon beim Laden dieser Datei — und reißt den ganzen Screen mit.
import { PermissionsAndroid, Platform } from "react-native";

import type GeolocationTyp from "@react-native-community/geolocation";

export type Position = { lat: number; lng: number };

export type StandortErgebnis =
  | { ok: true; position: Position }
  | { ok: false; grund: "verweigert" | "nicht_verfuegbar" | "kein_modul"; text: string };

// Abbruch, wenn das Gerät zu lange braucht — ohne Deckel hängt die Suche.
const TIMEOUT_MS = 12000;

/** Natives Modul laden. null, wenn der App-Build es (noch) nicht enthält. */
function ladeGeolocation(): typeof GeolocationTyp | null {
  try {
    return require("@react-native-community/geolocation").default;
  } catch {
    return null;
  }
}

async function androidErlaubnis(): Promise<boolean> {
  const ergebnis = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    {
      title: "Standort verwenden",
      message: "Damit zeigen wir dir Unterkünfte in deiner Nähe.",
      buttonPositive: "Erlauben",
      buttonNegative: "Nicht jetzt",
    },
  );
  return ergebnis === PermissionsAndroid.RESULTS.GRANTED;
}

/** Aktuelle grobe Position — fragt bei Bedarf die Berechtigung ab. */
export async function aktuellerStandort(): Promise<StandortErgebnis> {
  const geolocation = ladeGeolocation();
  if (!geolocation) {
    return {
      ok: false,
      grund: "kein_modul",
      text: "Standortsuche ist in dieser App-Version noch nicht aktiv.",
    };
  }

  if (Platform.OS === "android") {
    const erlaubt = await androidErlaubnis();
    if (!erlaubt) {
      return {
        ok: false,
        grund: "verweigert",
        text: "Ohne Standort-Freigabe können wir keine Unterkünfte in deiner Nähe zeigen.",
      };
    }
  }

  return new Promise<StandortErgebnis>((resolve) => {
    geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      (fehler) => {
        // 1 = PERMISSION_DENIED (iOS-Dialog abgelehnt oder Dienst gesperrt).
        const verweigert = fehler?.code === 1;
        resolve({
          ok: false,
          grund: verweigert ? "verweigert" : "nicht_verfuegbar",
          text: verweigert
            ? "Ohne Standort-Freigabe können wir keine Unterkünfte in deiner Nähe zeigen."
            : "Dein Standort ließ sich gerade nicht bestimmen. Versuch es später noch einmal.",
        });
      },
      { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60000 },
    );
  });
}
