"use server";

// Berichte und Lohnlauf (Paket F3) — Server-Actions gegen den FastAPI-Slice
// (/api/v1/personal, Vertrag §4). Business-Logik bleibt im Backend; hier nur
// die Aufrufe. Typen und reine Helfer liegen in `personal-berichte-typen.ts`
// (ohne "use server", weil ein Server-Action-Modul AUSSCHLIESSLICH async
// functions exportieren darf).
import { ApiError, api } from "@/lib/api";
import type {
  BerichtFilterWerte,
  BerichtKatalogEintrag,
  BerichtResponse,
  LohnExportDatei,
  LohnExportFormat,
  Lohnlauf,
} from "@/lib/personal-berichte-typen";
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

const q = (params: Record<string, string | number | boolean | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
};

/** Die Filter als Query — leere Werte fallen weg, damit der Server seinen
 *  eigenen Standard behält statt eines leeren Strings. */
const filterQuery = (f: Partial<BerichtFilterWerte>) => ({
  von: f.von,
  bis: f.bis,
  arbeitsbereich_id: f.arbeitsbereich_id,
  property_id: f.property_id,
  user_id: f.user_id,
  beschaeftigungsart: f.beschaeftigungsart,
});

// --- Katalog & Bericht (§4.1/§4.2) -------------------------------------------

/** Der Katalog ist serverseitig auf die Rechte des Aufrufers gefiltert — das
 *  Frontend führt KEINE eigene Rechte-Logik (Wurzel 3/9). */
export async function listBerichte(): Promise<Result<BerichtKatalogEintrag[]>> {
  return call("/personal/berichte");
}

export async function getBericht(
  name: string,
  filter: Partial<BerichtFilterWerte>,
): Promise<Result<BerichtResponse>> {
  return call(
    `/personal/berichte/${encodeURIComponent(name)}${q({ ...filterQuery(filter), format: "json" })}`,
  );
}

/** CSV-Ausgabe desselben Berichts. Der Server bestimmt den Dateinamen
 *  (Content-Disposition, `<name>_<von>_<bis>.csv`) — nie hier erfinden; der
 *  Download passiert im Client aus `inhalt_base64`.
 *
 *  Eigener `fetch` statt `api()`, weil die Antwort BINÄR ist (text/csv mit
 *  BOM): `api()` würde JSON erwarten. Gleiches Muster wie
 *  `personal.lohnexport`. */
export async function berichtCsv(
  name: string,
  filter: Partial<BerichtFilterWerte>,
): Promise<Result<LohnExportDatei>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const { apiBasis } = await import("@/lib/api");
  const pfad = `/personal/berichte/${encodeURIComponent(name)}${q({
    ...filterQuery(filter),
    format: "csv",
  })}`;
  const res = await fetch(`${apiBasis()}${pfad}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return fehlerAusAntwort(res);
  return { ok: true, data: await dateiAusAntwort(res, `${name}.csv`) };
}

// --- Lohnlauf (§4.3) ---------------------------------------------------------

export async function listLohnlaeufe(jahr: number): Promise<Result<Lohnlauf[]>> {
  return call(`/personal/lohnlaeufe${q({ jahr })}`);
}

export async function lohnlaufAnlegen(jahr: number, monat: number): Promise<Result<Lohnlauf>> {
  return call("/personal/lohnlaeufe", { method: "POST", body: { jahr, monat } });
}

export async function lohnlaufPruefen(id: string): Promise<Result<Lohnlauf>> {
  return call(`/personal/lohnlaeufe/${encodeURIComponent(id)}/pruefen`, { method: "POST" });
}

export async function lohnlaufFreigeben(id: string): Promise<Result<Lohnlauf>> {
  return call(`/personal/lohnlaeufe/${encodeURIComponent(id)}/freigeben`, { method: "POST" });
}

export async function lohnlaufExportieren(
  id: string,
  format: LohnExportFormat,
): Promise<Result<LohnExportDatei>> {
  return call(`/personal/lohnlaeufe/${encodeURIComponent(id)}/exportieren`, {
    method: "POST",
    body: { format },
  });
}

export async function lohnlaufZuruecksetzen(id: string, grund: string): Promise<Result<Lohnlauf>> {
  return call(`/personal/lohnlaeufe/${encodeURIComponent(id)}/zuruecksetzen`, {
    method: "POST",
    body: { grund },
  });
}

// --- Hilfen für Binärantworten -----------------------------------------------

async function fehlerAusAntwort(res: Response): Promise<{
  ok: false;
  error: string;
  status: number;
  details?: Record<string, unknown>;
}> {
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

async function dateiAusAntwort(res: Response, ersatzname: string): Promise<LohnExportDatei> {
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? ersatzname;
  const puffer = Buffer.from(await res.arrayBuffer());
  return {
    name,
    inhalt_base64: puffer.toString("base64"),
    mime: res.headers.get("Content-Type") ?? "text/csv",
  };
}
