"use server";

// Übersetzung: Server-Action gegen den FastAPI-content-Slice
// (/api/v1/content/translate → Google Cloud Translation). Der API-Key bleibt
// serverseitig im Backend (PROJECT.md §2).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

/**
 * Ein Sprachcode (BCP 47): „de", „no", „pt-BR".
 *
 * Bewusst kein Union-Typ aus drei Sprachen wie früher: im Gäste-Chat kommt die
 * Quellsprache vom Gast, und Gäste schreiben aus aller Welt. Der Server prüft
 * die Form; welche Sprachen es wirklich gibt, entscheidet Google.
 */
export type TranslateLang = string;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Übersetzt Text in die Zielsprache. `source` optional (dann erkennt Google
 * sie selbst und meldet sie in `detected_source` zurück).
 *
 * `fmt` bestimmt, wie Google mit Markup umgeht — und das ist keine Kleinigkeit:
 * bei `"html"` kommen Sonderzeichen als Entities zurück (`&#39;` statt `'`).
 * Der Objekttext-Editor rendert HTML und braucht das; eine Chat-Blase zeigt
 * reinen Text und würde die Entities anzeigen. Deshalb entscheidet der
 * Aufrufer, nicht diese Funktion.
 */
export async function translateText(
  text: string,
  target: TranslateLang,
  source?: TranslateLang,
  fmt: "html" | "text" = "html",
): Promise<Result<{ text: string; detected_source: string | null }>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<{ text: string; detected_source: string | null }>(
      "/content/translate",
      {
        method: "POST",
        body: { text, target, source, fmt },
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
