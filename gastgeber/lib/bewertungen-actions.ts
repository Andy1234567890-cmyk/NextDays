"use server";

// Schreib-Actions Bewertungen (Gastgeber-Seite). Antwort auf eine Bewertung —
// beim Portal geht sie zuerst dorthin, erst danach in unseren Bestand (das
// erledigt das Backend, Wurzel 1). Jede Aktion gibt bei Fehler die Backend-
// Meldung zurück (Wurzel 5).
import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { ReviewSource, UnifiedReview } from "./bewertungen";

type Err = { ok: false; error: string };

function fehler(exc: unknown, fallback: string): Err {
  return { ok: false, error: exc instanceof ApiError ? exc.message : fallback };
}

export async function antworteAufBewertung(
  source: ReviewSource,
  id: string,
  reply: string,
): Promise<{ ok: true; review: UnifiedReview } | Err> {
  try {
    const review = await api<UnifiedReview>(`/reviews/${source}/${id}/reply`, {
      method: "PUT",
      body: { reply },
    });
    return { ok: true, review };
  } catch (exc) {
    return fehler(exc, "Antwort konnte nicht gesendet werden.");
  }
}
