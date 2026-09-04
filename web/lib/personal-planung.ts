"use server";

// Dienstplan-Ausbau (Paket F1): Server-Actions gegen den FastAPI-Slice
// (/api/v1/personal). Gebaut gegen den Schnittstellenvertrag
// docs/PERSONAL-AUSBAU-VERTRAG.md §1.3, §1.4, §2.1, §2.2, §2.3 — die Backends
// B1/B2 entstehen parallel.
//
// Dieselbe Bauform wie `personal.ts` (das niemandem gehoert und darum nicht
// angefasst wird): eigenes `call`/`q`, Ergebnis als `Result<T>` mit Status und
// `details` (Konfliktcodes des Vertrags), Business-Logik bleibt im Backend.
//
// NUR async functions — Typen, Konstanten und reine Helfer liegen in
// `personal-planung-typen.ts`.
import { ApiError, api } from "@/lib/api";
import type {
  AssistentAntwort,
  AutoplanRequest,
  BedarfDaten,
  BedarfResponse,
  BedarfZeile,
  Kennzahlen,
  KiStatus,
  LeerenErgebnis,
  MehrfachErgebnis,
  MehrfachRequest,
  PlanDaten,
  Planungslauf,
  Prognose,
  Tausch,
  Wochenvorlage,
  WochenvorlageDetail,
} from "@/lib/personal-planung-typen";
import type { Result } from "@/lib/personal-typen";
import { currentToken } from "@/lib/session-token";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) {
      return { ok: false, error: exc.message, status: exc.status, details: exc.details };
    }
    return { ok: false, error: "Aktion fehlgeschlagen." };
  }
}

async function query(
  params: Record<string, string | number | boolean | null | undefined>,
): Promise<string> {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
}

// --- Wochenplan über ein freies Fenster (§1.3) --------------------------------

/** Plan für ein freies Fenster (höchstens 42 Tage) — Basis der Tag-/Monatsansicht. */
export async function getPlanZeitraum(von: string, bis: string): Promise<Result<PlanDaten>> {
  return call(`/personal/dienstplan/zeitraum${await query({ von, bis })}`);
}

/** Plan einer Kalenderwoche (mit den Zusatzfeldern aus §1.3). */
export async function getPlanWoche(woche: string): Promise<Result<PlanDaten>> {
  return call(`/personal/dienstplan${await query({ woche })}`);
}

// --- §2.1 Kennzahlen ---------------------------------------------------------

export async function getKennzahlen(von: string, bis: string): Promise<Result<Kennzahlen>> {
  return call(`/personal/dienstplan/kennzahlen${await query({ von, bis })}`);
}

// --- §1.4 Woche leeren, Mehrfachaktion ----------------------------------------

export async function wocheLeeren(
  woche: string,
  arbeitsbereichId?: string,
): Promise<Result<LeerenErgebnis>> {
  const qs = await query({ woche, arbeitsbereich_id: arbeitsbereichId });
  return call(`/personal/dienstplan/leeren${qs}`, { method: "POST" });
}

export async function schichtenMehrfach(body: MehrfachRequest): Promise<Result<MehrfachErgebnis>> {
  return call("/personal/schichten/mehrfach", { method: "POST", body });
}

// --- §1.4 Wochenvorlagen ------------------------------------------------------

export async function listWochenvorlagen(): Promise<Result<Wochenvorlage[]>> {
  return call("/personal/wochenvorlagen");
}

export async function getWochenvorlage(id: string): Promise<Result<WochenvorlageDetail>> {
  return call(`/personal/wochenvorlagen/${encodeURIComponent(id)}`);
}

export async function createWochenvorlage(body: {
  name: string;
  notiz?: string | null;
  aus_woche: string;
  mit_personen: boolean;
}): Promise<Result<Wochenvorlage>> {
  return call("/personal/wochenvorlagen", { method: "POST", body });
}

export async function updateWochenvorlage(
  id: string,
  body: { name?: string; notiz?: string | null },
): Promise<Result<Wochenvorlage>> {
  return call(`/personal/wochenvorlagen/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function deleteWochenvorlage(id: string): Promise<Result<void>> {
  return call(`/personal/wochenvorlagen/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function wochenvorlageAnwenden(
  id: string,
  woche: string,
  body: { mit_personen: boolean; warnungen_akzeptieren: boolean },
): Promise<Result<BedarfResponse>> {
  const qs = await query({ woche });
  return call(`/personal/wochenvorlagen/${encodeURIComponent(id)}/anwenden${qs}`, {
    method: "POST",
    body,
  });
}

// --- §1.4 Tausch --------------------------------------------------------------

export async function tauschAnfragen(
  schichtId: string,
  body: { an_user_id: string; gegen_schicht_id?: string | null; grund?: string | null },
): Promise<Result<Tausch>> {
  return call(`/personal/schichten/${encodeURIComponent(schichtId)}/tausch`, {
    method: "POST",
    body,
  });
}

export async function listTausch(woche?: string, status?: string): Promise<Result<Tausch[]>> {
  return call(`/personal/tausch${await query({ woche, status })}`);
}

export async function tauschAnnehmen(id: string): Promise<Result<Tausch>> {
  return call(`/personal/tausch/${encodeURIComponent(id)}/annehmen`, { method: "POST" });
}

export async function tauschAblehnen(id: string): Promise<Result<Tausch>> {
  return call(`/personal/tausch/${encodeURIComponent(id)}/ablehnen`, { method: "POST" });
}

export async function tauschZurueckziehen(id: string): Promise<Result<Tausch>> {
  return call(`/personal/tausch/${encodeURIComponent(id)}/zurueckziehen`, { method: "POST" });
}

export async function tauschEntscheiden(
  id: string,
  body: { freigeben: boolean; kommentar?: string | null; warnungen_akzeptieren: boolean },
): Promise<Result<Tausch>> {
  return call(`/personal/tausch/${encodeURIComponent(id)}/entscheiden`, { method: "POST", body });
}

// --- §1.4 CSV-Export ----------------------------------------------------------

/**
 * Dienstplan der Woche als CSV. Der Endpunkt liefert `text/csv` (Semikolon,
 * BOM, CRLF) — `api()` erwartet JSON, deshalb hier ein eigener fetch wie bei
 * `personal.lohnexport`. Der Download passiert im Client aus dem Base64.
 */
export async function dienstplanCsv(
  woche: string,
): Promise<Result<{ name: string; inhalt_base64: string; mime: string }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const { apiBasis } = await import("@/lib/api");
  const res = await fetch(
    `${apiBasis()}/personal/dienstplan/export.csv${await query({ woche })}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) {
    let error = `Fehler ${res.status}`;
    let details: Record<string, unknown> | undefined;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") error = data.detail;
      else if (data?.detail && typeof data.detail === "object") {
        details = data.detail as Record<string, unknown>;
        if (typeof details.message === "string") error = details.message;
      }
    } catch {
      // kein JSON — Standardmeldung behalten
    }
    return { ok: false, error, status: res.status, details };
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `dienstplan-${woche}.csv`;
  const puffer = Buffer.from(await res.arrayBuffer());
  return {
    ok: true,
    data: {
      name,
      inhalt_base64: puffer.toString("base64"),
      mime: res.headers.get("Content-Type") ?? "text/csv",
    },
  };
}

// --- §2.2 Bedarf --------------------------------------------------------------

export async function getBedarf(von: string, bis: string): Promise<Result<BedarfDaten>> {
  return call(`/personal/bedarf${await query({ von, bis })}`);
}

export async function setBedarfVorlagen(zeilen: BedarfZeile[]): Promise<Result<BedarfZeile[]>> {
  return call("/personal/bedarf/vorlagen", { method: "PUT", body: zeilen });
}

export async function setBedarfTage(
  von: string,
  bis: string,
  zeilen: BedarfZeile[],
): Promise<Result<BedarfZeile[]>> {
  return call(`/personal/bedarf/tage${await query({ von, bis })}`, { method: "PUT", body: zeilen });
}

export async function deleteBedarf(id: string): Promise<Result<void>> {
  return call(`/personal/bedarf/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- §2.3 KI ------------------------------------------------------------------

export async function getKiStatus(): Promise<Result<KiStatus>> {
  return call("/personal/ki/status");
}

export async function prognoseErzeugen(woche: string): Promise<Result<Prognose>> {
  return call(`/personal/ki/prognose${await query({ woche })}`, { method: "POST" });
}

export async function listPrognosen(woche: string): Promise<Result<Prognose[]>> {
  return call(`/personal/ki/prognosen${await query({ woche })}`);
}

export async function prognoseUebernehmen(id: string): Promise<Result<BedarfResponse>> {
  return call(`/personal/ki/prognosen/${encodeURIComponent(id)}/uebernehmen`, { method: "POST" });
}

export async function autoplanStarten(
  woche: string,
  body: AutoplanRequest,
): Promise<Result<Planungslauf>> {
  return call(`/personal/ki/autoplan${await query({ woche })}`, { method: "POST", body });
}

export async function listPlanungslaeufe(woche: string): Promise<Result<Planungslauf[]>> {
  return call(`/personal/ki/planungslaeufe${await query({ woche })}`);
}

export async function planungslaufUebernehmen(
  id: string,
  variante: number,
): Promise<Result<BedarfResponse>> {
  return call(`/personal/ki/planungslaeufe/${encodeURIComponent(id)}/uebernehmen`, {
    method: "POST",
    body: { variante },
  });
}

export async function planungslaufVerwerfen(id: string): Promise<Result<{ geloescht: number }>> {
  return call(`/personal/ki/planungslaeufe/${encodeURIComponent(id)}/verwerfen`, { method: "POST" });
}

export async function kiAssistent(frage: string, woche: string): Promise<Result<AssistentAntwort>> {
  return call("/personal/ki/assistent", { method: "POST", body: { frage, woche } });
}
