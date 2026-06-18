"use server";

// Übersetzung: Server-Action gegen den FastAPI-content-Slice
// (/api/v1/content/translate → Google Cloud Translation). Der API-Key bleibt
// serverseitig im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type TranslateLang = "da" | "en" | "de";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Übersetzt HTML/Text in die Zielsprache. source optional (auto). */
export async function translateText(
  text: string,
  target: TranslateLang,
  source?: TranslateLang,
): Promise<Result<{ text: string; detected_source: string | null }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<{ text: string; detected_source: string | null }>(
      "/content/translate",
      {
        method: "POST",
        body: { text, target, source, fmt: "html" },
        token,
      },
    );
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Übersetzung fehlgeschlagen.";
    return { ok: false, error };
  }
}
