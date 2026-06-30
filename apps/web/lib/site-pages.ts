"use server";

// Page-Builder: Server-Actions gegen den FastAPI-site_config-Slice
// (/api/v1/site-config/pages|blocks|templates). Seiten + Blöcke der white-label
// Agentur-Website. 1:1 zu den Backend-Aktionen benannt (MCP-ready).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type BlockType =
  | "hero"
  | "rich_text"
  | "image"
  | "gallery"
  | "button"
  | "spacer"
  | "contact"
  | "search"
  | "properties_grid"
  | "featured_properties";

export type Page = {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  is_home: boolean;
  is_published: boolean;
  nav_order: number;
};

export type Block = {
  id: string;
  page_id: string;
  type: BlockType;
  position: number;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    const error =
      exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.";
    const status = exc instanceof ApiError ? exc.status : undefined;
    return { ok: false, error, status };
  }
}

function touch() {
  revalidatePath("/website");
}

// --- Seiten -----------------------------------------------------------------
export async function listPages(): Promise<
  Result<{ items: Page[]; total: number }>
> {
  return call("/site-config/pages");
}

export async function createPage(
  title: string,
  slug = "",
): Promise<Result<Page>> {
  const res = await call<Page>("/site-config/pages", {
    method: "POST",
    body: { title, slug },
  });
  if (res.ok) touch();
  return res;
}

export async function updatePage(
  pageId: string,
  input: Partial<Pick<Page, "title" | "slug" | "seo_title" | "seo_description" | "og_image_url" | "nav_order">>,
): Promise<Result<Page>> {
  const res = await call<Page>(`/site-config/pages/${pageId}`, {
    method: "PUT",
    body: input,
  });
  if (res.ok) touch();
  return res;
}

export async function setHomePage(pageId: string): Promise<Result<Page>> {
  const res = await call<Page>(`/site-config/pages/${pageId}/home`, {
    method: "POST",
  });
  if (res.ok) touch();
  return res;
}

export async function publishPage(pageId: string): Promise<Result<Page>> {
  const res = await call<Page>(`/site-config/pages/${pageId}/publish`, {
    method: "POST",
  });
  if (res.ok) touch();
  return res;
}

export async function unpublishPage(pageId: string): Promise<Result<Page>> {
  const res = await call<Page>(`/site-config/pages/${pageId}/unpublish`, {
    method: "POST",
  });
  if (res.ok) touch();
  return res;
}

export async function deletePage(pageId: string): Promise<Result<null>> {
  const res = await call<null>(`/site-config/pages/${pageId}`, {
    method: "DELETE",
  });
  if (res.ok) touch();
  return res;
}

// --- Blöcke -----------------------------------------------------------------
export async function listBlocks(
  pageId: string,
): Promise<Result<{ items: Block[]; total: number }>> {
  return call(`/site-config/pages/${pageId}/blocks`);
}

export async function addBlock(
  pageId: string,
  type: BlockType,
  content: Record<string, unknown> = {},
  settings: Record<string, unknown> = {},
): Promise<Result<Block>> {
  return call(`/site-config/pages/${pageId}/blocks`, {
    method: "POST",
    body: { type, content, settings },
  });
}

export async function updateBlock(
  blockId: string,
  input: { content?: Record<string, unknown>; settings?: Record<string, unknown> },
): Promise<Result<Block>> {
  return call(`/site-config/blocks/${blockId}`, {
    method: "PUT",
    body: input,
  });
}

export async function reorderBlocks(
  pageId: string,
  orderedIds: string[],
): Promise<Result<{ items: Block[]; total: number }>> {
  return call(`/site-config/pages/${pageId}/blocks/reorder`, {
    method: "POST",
    body: { ordered_ids: orderedIds },
  });
}

export async function removeBlock(blockId: string): Promise<Result<null>> {
  return call(`/site-config/blocks/${blockId}`, { method: "DELETE" });
}

// --- Templates --------------------------------------------------------------
export async function applyTemplate(
  templateId: string,
): Promise<Result<{ items: Page[]; total: number }>> {
  const res = await call<{ items: Page[]; total: number }>(
    "/site-config/templates/apply",
    { method: "POST", body: { template_id: templateId } },
  );
  if (res.ok) touch();
  return res;
}
