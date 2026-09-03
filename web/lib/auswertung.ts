"use server";
// Auswertung: Server-Action gegen den FastAPI-Slice (/api/v1/auswertung).
//
// EIN Aufruf für alle Reiter — sie teilen Zeitraum, Bezug und Objektfilter,
// und ihre Kennzahlen müssen übereinstimmen. Fünf getrennte Abrufe wären genau
// der Fehler, den Hostaway 09/2025 nachbessern musste („Einheitliche Zahlen
// auf allen Seiten").
//
// Typen liegen in `auswertung-typen.ts`: ein `"use server"`-Modul darf nur
// async functions exportieren.
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";
import type { Auswertung, AuswertungFilter } from "@/lib/auswertung-typen";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export async function getAuswertung(
  filter: AuswertungFilter,
): Promise<Result<Auswertung>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };

  const qs = new URLSearchParams();
  qs.set("von", filter.von);
  qs.set("bis", filter.bis);
  if (filter.bezug) qs.set("bezug", filter.bezug);
  for (const id of filter.propertyIds ?? []) qs.append("property_id", id);
  for (const c of filter.channels ?? []) qs.append("channel", c);
  if (filter.vergleich && filter.vergleich !== "keiner") {
    qs.set("vergleich", filter.vergleich);
  }

  try {
    const data = await api<Auswertung>(`/auswertung?${qs.toString()}`, { token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Auswertung nicht abrufbar.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}
