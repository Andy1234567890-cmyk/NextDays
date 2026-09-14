"use server";

// Bereich »versand« der Buchhaltung: Server-Actions gegen
// /api/v1/buchhaltung/{email,send-invoice-email,document-sends,text-templates}.
// NUR async functions (Next-Regel für "use server"); Typen liegen in
// buchhaltung-versand-typen.ts.
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import type {
  DocumentSend,
  SendDocumentInput,
  SendDocumentResult,
  TextTemplate,
  TextTemplateInput,
  TextTemplateRenderResult,
} from "@/lib/buchhaltung-versand-typen";
import { currentToken } from "@/lib/session-token";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(`/buchhaltung${path}`, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error = exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

// --- Versand -----------------------------------------------------------------

export async function sendDocumentEmail(
  input: SendDocumentInput,
): Promise<Result<SendDocumentResult>> {
  return call("/email/send-document", { method: "POST", body: input });
}

export async function listDocumentSends(
  documentId: string,
  documentType?: string,
): Promise<Result<{ items: DocumentSend[]; total: number }>> {
  const params = new URLSearchParams({ document_id: documentId });
  if (documentType) params.set("document_type", documentType);
  return call(`/document-sends?${params.toString()}`);
}

// --- Textvorlagen ------------------------------------------------------------

export async function listTextTemplates(filter?: {
  category?: string;
  objectType?: string;
  textType?: string;
  language?: string;
}): Promise<Result<TextTemplate[]>> {
  const params = new URLSearchParams();
  if (filter?.category) params.set("category", filter.category);
  if (filter?.objectType) params.set("objectType", filter.objectType);
  if (filter?.textType) params.set("textType", filter.textType);
  if (filter?.language) params.set("language", filter.language);
  const query = params.toString();
  return call(`/text-templates${query ? `?${query}` : ""}`);
}

export async function createTextTemplate(
  input: TextTemplateInput,
): Promise<Result<TextTemplate>> {
  // `company_id` im Pfad ist Altlast des Bestands — der Server nimmt den Tenant aus dem JWT.
  const res = await call<TextTemplate>("/text-templates/me", { method: "POST", body: input });
  if (res.ok) revalidatePath("/buchhaltung/textvorlagen");
  return res;
}

export async function updateTextTemplate(
  templateId: string,
  input: Partial<TextTemplateInput>,
): Promise<Result<TextTemplate>> {
  const res = await call<TextTemplate>(`/text-templates/me/${templateId}`, {
    method: "PATCH",
    body: input,
  });
  if (res.ok) revalidatePath("/buchhaltung/textvorlagen");
  return res;
}

export async function deleteTextTemplate(templateId: string): Promise<Result<null>> {
  const res = await call<null>(`/text-templates/me/${templateId}`, { method: "DELETE" });
  if (res.ok) revalidatePath("/buchhaltung/textvorlagen");
  return res;
}

/** Kopf-/Fußtext per KI vorschlagen (Buchhaltung → Textvorlagen → „Mit KI erzeugen"). */
export async function kiTextbaustein(input: {
  objectType: string;
  textType: string;
  language: string;
  wunsch: string;
}): Promise<Result<{ text: string; name: string; verbrauch_heute: number; tageslimit: number }>> {
  return call("/text-templates/ki", {
    method: "POST",
    body: {
      object_type: input.objectType,
      text_type: input.textType,
      language: input.language,
      wunsch: input.wunsch,
    },
  });
}

export async function renderTextTemplate(input: {
  templateId?: string;
  text?: string;
  documentType: string;
  documentId: string;
  language?: string;
}): Promise<Result<TextTemplateRenderResult>> {
  return call("/text-templates/render", { method: "POST", body: input });
}
