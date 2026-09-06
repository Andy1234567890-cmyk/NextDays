"use server";

// Schlösser: Server-Actions gegen den FastAPI-schloesser-Slice
// (/api/v1/schloesser). Türcodes je Buchung über den Aggregator Seam.
//
// Diese Datei enthält AUSSCHLIESSLICH async functions — `"use server"` erlaubt
// nichts anderes. Typen stehen in `schloesser-typen.ts`; ein `export type` hier
// würde die Seite erst beim Deploy-Build mit „A 'use server' file can only
// export async functions" umlegen, und weder tsc noch ESLint sehen das.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import type {
  SchlossGeraet,
  SchlossPruefung,
  SchlossVerbindung,
  SchlossZugang,
  SchlossEinstellungen,
} from "@/lib/schloesser-typen";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/schloesser${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

/** Prüft, ob der Seam-Schlüssel greift — ohne ein Gerät anzufassen.
 *
 *  `istSandbox` ist der Grund, warum es diese Prüfung gibt: ein Betrieb, dessen
 *  Schlösser an einem Sandbox-Workspace hängen, bekommt Codes, die nichts
 *  öffnen. Ohne Anzeige fällt das erst am verschlossenen Gast auf. */
export async function pruefeSchlossdienst(): Promise<Result<SchlossPruefung>> {
  return call<SchlossPruefung>("/pruefen");
}

/** Die verbundenen Schloss-Konten dieses Betriebs. */
export async function ladeVerbindungen(): Promise<Result<SchlossVerbindung[]>> {
  return call<SchlossVerbindung[]>("/verbindungen");
}

/** Öffnet die Anmeldemaske des HERSTELLERS (Seam Connect Webview).
 *
 *  Der Betrieb meldet sich dort bei seinem eigenen Schloss-Konto an; wir sehen
 *  das Passwort nie. Deshalb gibt es hier kein Formular für Zugangsdaten. */
export async function starteVerbindung(
  rueckkehrUrl: string,
): Promise<Result<{ url: string; webview_id: string | null }>> {
  return call<{ url: string; webview_id: string | null }>(
    "/verbindungen/start",
    { method: "POST", body: { rueckkehrUrl } },
  );
}

/** Nach der Rückkehr aus der Hersteller-Maske: Konto speichern, Geräte holen.
 *
 *  `status: "pending"` heißt, der Betrieb hat die Anmeldung noch nicht
 *  abgeschlossen — kein Fehler, sondern der normale Zwischenzustand. */
export async function uebernehmeVerbindung(
  webviewId: string,
): Promise<Result<{ status: string; connectionId: string | null }>> {
  return call<{ status: string; connectionId: string | null }>(
    "/verbindungen/uebernehmen",
    { method: "POST", body: { webviewId } },
  );
}

export async function trenneVerbindung(
  connectionId: string,
): Promise<Result<void>> {
  return call<void>(`/verbindungen/${connectionId}`, { method: "DELETE" });
}

/** Geräte einer Verbindung neu vom Hersteller holen. */
export async function gleicheGeraeteAb(
  connectionId: string,
): Promise<Result<{ anzahl: number }>> {
  return call<{ anzahl: number }>(
    `/verbindungen/${connectionId}/abgleichen`,
    { method: "POST" },
  );
}

/** Alle Schlösser des Betriebs samt Zuordnungen. */
export async function ladeGeraete(): Promise<Result<SchlossGeraet[]>> {
  return call<SchlossGeraet[]>("/geraete");
}

/** Ein Schloss an eine Einheit (private Tür) ODER ein Gebäude
 *  (Gemeinschaftstür) hängen. Genau eines von beiden. */
export async function ordneGeraetZu(daten: {
  deviceId: string;
  unitId?: string | null;
  buildingId?: string | null;
}): Promise<Result<{ id: string }>> {
  return call<{ id: string }>("/zuordnungen", {
    method: "POST",
    body: daten,
  });
}

export async function loeseZuordnung(
  zuordnungId: string,
): Promise<Result<void>> {
  return call<void>(`/zuordnungen/${zuordnungId}`, { method: "DELETE" });
}

/** Puffer und Vorlauf eines Objekts. */
export async function ladeEinstellungen(
  propertyId: string,
): Promise<Result<SchlossEinstellungen>> {
  return call<SchlossEinstellungen>(
    `/objekte/${propertyId}/einstellungen`,
  );
}

export async function setzeEinstellungen(
  propertyId: string,
  werte: Partial<SchlossEinstellungen>,
): Promise<Result<SchlossEinstellungen>> {
  return call<SchlossEinstellungen>(
    `/objekte/${propertyId}/einstellungen`,
    { method: "PUT", body: werte },
  );
}

/** Der Türcode einer Buchung.
 *
 *  `vorhanden: false` ist die normale Antwort für Betriebe ohne Schlösser —
 *  kein Fehler. */
export async function ladeZugang(
  reservationId: string,
): Promise<Result<SchlossZugang>> {
  return call<SchlossZugang>(`/buchungen/${reservationId}/zugang`);
}

/** Für eine Buchung einen Zugang vormerken bzw. sofort anlegen. */
export async function planeZugang(
  reservationId: string,
): Promise<Result<SchlossZugang>> {
  return call<SchlossZugang>(`/buchungen/${reservationId}/zugang`, {
    method: "POST",
  });
}

/** Einen geplanten Zugang jetzt ans Schloss geben, statt auf den Takt zu warten. */
export async function legeZugangAn(
  zugangId: string,
): Promise<Result<SchlossZugang>> {
  return call<SchlossZugang>(`/zugaenge/${zugangId}/anlegen`, {
    method: "POST",
  });
}

/** Den Zugang zurückziehen.
 *
 *  ACHTUNG auf die Antwort: `status: "nicht_widerrufbar"` heißt, der Code ist
 *  NICHT weg und läuft bis `endsAt` weiter (Offline-Schloss, algoPIN). Die
 *  Oberfläche muss das anzeigen, statt es als Erfolg zu verbuchen. */
export async function widerrufeZugang(
  reservationId: string,
): Promise<Result<SchlossZugang>> {
  return call<SchlossZugang>(
    `/buchungen/${reservationId}/zugang/widerrufen`,
    { method: "POST" },
  );
}
