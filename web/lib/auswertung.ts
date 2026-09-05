"use server";
// Auswertung: Server-Actions gegen den FastAPI-Slice (/api/v1/auswertung).
//
// EIN Aufruf für alle Reiter — sie teilen Zeitraum, Bezug und Objektfilter,
// und ihre Kennzahlen müssen übereinstimmen. Fünf getrennte Abrufe wären genau
// der Fehler, den Hostaway 09/2025 nachbessern musste („Einheitliche Zahlen
// auf allen Seiten"). Ausnahmen mit eigenem Abruf: Pace (blickt immer von
// heute nach vorn, kennt keinen Zeitraum) und die gespeicherten Ansichten.
//
// Typen liegen in `auswertung-typen.ts`: ein `"use server"`-Modul darf nur
// async functions exportieren.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import type {
  Ansicht,
  AnsichtAnlegen,
  Auswertung,
  AuswertungFilter,
  PaceBericht,
} from "@/lib/auswertung-typen";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
  fehler = "Auswertung nicht abrufbar.",
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : fehler;
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

export async function getAuswertung(
  filter: AuswertungFilter,
): Promise<Result<Auswertung>> {
  const qs = new URLSearchParams();
  qs.set("von", filter.von);
  qs.set("bis", filter.bis);
  if (filter.bezug) qs.set("bezug", filter.bezug);
  for (const id of filter.propertyIds ?? []) qs.append("property_id", id);
  for (const c of filter.channels ?? []) qs.append("channel", c);
  for (const s of filter.status ?? []) qs.append("status", s);
  if (filter.vergleich && filter.vergleich !== "keiner") {
    qs.set("vergleich", filter.vergleich);
  }
  return call<Auswertung>(`/auswertung?${qs.toString()}`);
}

/** Pace: Buchungsstand der nächsten zwölf Monate gegen den Vorjahres-Stichtag. */
export async function getPace(filter: {
  propertyIds?: string[];
  channels?: string[];
}): Promise<Result<PaceBericht>> {
  const qs = new URLSearchParams();
  for (const id of filter.propertyIds ?? []) qs.append("property_id", id);
  for (const c of filter.channels ?? []) qs.append("channel", c);
  const q = qs.toString();
  return call<PaceBericht>(`/auswertung/pace${q ? `?${q}` : ""}`);
}

export async function listAnsichten(reiter?: string): Promise<Result<Ansicht[]>> {
  const q = reiter ? `?reiter=${encodeURIComponent(reiter)}` : "";
  return call<Ansicht[]>(`/auswertung/ansichten${q}`, {}, "Ansichten nicht abrufbar.");
}

export async function saveAnsicht(req: AnsichtAnlegen): Promise<Result<Ansicht>> {
  return call<Ansicht>(
    `/auswertung/ansichten`,
    { method: "POST", body: req },
    "Ansicht konnte nicht gespeichert werden.",
  );
}

export async function deleteAnsicht(id: string): Promise<Result<null>> {
  return call<null>(
    `/auswertung/ansichten/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "Ansicht konnte nicht gelöscht werden.",
  );
}
