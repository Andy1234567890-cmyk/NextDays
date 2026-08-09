"use server";

// Offizielle Ankündigungen (Neuerungen) des Plattform-Teams: Popup nach dem
// Login + Historie unter /neuerungen. Gegen den announcements-Slice
// (/api/v1/announcements). Der Scope kommt im Backend aus dem Token (Rolle
// admin/co_admin, eigener Mandant) — hier wird nie eine Nutzer-ID mitgegeben.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/** Redaktionelle Einordnung. Die Liste ist bewusst geschlossen; ein neuer
 *  Backend-Wert darf die Seite trotzdem nicht crashen — deshalb löst die UI
 *  ihn über eine Allowlist mit Rückfall auf `hinweis` auf. */
export type AnnouncementKategorie =
  | "neuerung"
  | "wartung"
  | "hinweis"
  | "wichtig";

export type Announcement = {
  id: string;
  titel: string;
  /** Serverseitig mit nh3 gegen eine Allowlist bereinigt (Wurzel 8). */
  inhalt_html: string;
  kurztext: string | null;
  kategorie: AnnouncementKategorie;
  als_popup: boolean;
  /** `null`, solange die Ankündigung noch im Entwurf steht — die UI zeigt dann
   *  kein Datum, statt „Invalid Date" zu rendern (Wurzel 4). */
  veroeffentlicht_am: string | null;
  /** Hat DIESER Nutzer sie quittiert? Kommt je Zeile aus der Liste. */
  quittiert: boolean;
};

export type AnnouncementListe = {
  items: Announcement[];
  total: number;
  ungelesen: number;
};

/** Antwort von `/popup`: die EINE unterbrechende Ankündigung plus die Zahl der
 *  danach noch wartenden (für „1 von 3"). Das Backend liefert diese Hülle —
 *  nicht die Ankündigung selbst. */
export type PopupAntwort = {
  item: Announcement | null;
  offen: number;
};

/** Ergebnis einer Quittierung. `neu=false` heißt: war schon quittiert
 *  (idempotent, ein Retry schiebt den Zeitpunkt nicht nach vorn). */
export type QuittierErgebnis = { ok: true; neu: boolean };

type Ergebnis<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  pfad: string,
  method: "GET" | "POST" = "GET",
): Promise<Ergebnis<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet.", status: 401 };
  try {
    return {
      ok: true,
      data: await api<T>(`/announcements${pfad}`, { token, method }),
    };
  } catch (e) {
    // Ein Ladefehler darf nicht als „keine Ankündigungen" durchgehen: „leer"
    // und „konnte nicht laden" sind zwei verschiedene Aussagen (Wurzel 4).
    // Beim Popup hängt daran zusätzlich der sessionStorage-Riegel — er wird
    // NUR bei ok gesetzt, sonst verschluckt ein 503 die ganze Sitzung.
    return {
      ok: false,
      error: e instanceof ApiError ? e.message : "Backend nicht erreichbar.",
      status: e instanceof ApiError ? e.status : undefined,
    };
  }
}

/** Historie samt Ungelesen-Zähler. `offset` blättert „Ältere laden". */
export async function listAnnouncements(
  limit = 20,
  offset = 0,
): Promise<Ergebnis<AnnouncementListe>> {
  return call<AnnouncementListe>(
    `?limit=${limit}&offset=${offset}`,
  );
}

/**
 * Die EINE Ankündigung, die als Nächstes unterbrechen darf — oder `null`.
 *
 * Bewusst kein Puffern einer Liste im Client: die Reihenfolge (älteste
 * unquittierte zuerst, Neukunden-Filter, `gueltig_bis`) bleibt Server-Sache.
 * Nach jeder erfolgreichen Quittierung wird hier erneut gefragt.
 */
export async function popupAnnouncement(): Promise<Ergebnis<PopupAntwort>> {
  return call<PopupAntwort>("/popup");
}

/**
 * Ankündigung quittieren. Das Schließen des Popups IST diese Quittierung —
 * sie darf deshalb nicht optimistisch behandelt werden: schlägt sie fehl,
 * bleibt der Dialog offen (sonst gilt sie als erledigt, ohne es zu sein).
 */
export async function quittiereAnnouncement(
  id: string,
): Promise<Ergebnis<QuittierErgebnis>> {
  return call<QuittierErgebnis>(
    `/${encodeURIComponent(id)}/quittieren`,
    "POST",
  );
}
