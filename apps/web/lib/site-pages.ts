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

// Ein Block, wie ihn der Canvas-Editor speichert (blockId=null → neu anlegen).
export type SyncBlock = {
  blockId: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

/**
 * Synchronisiert den kompletten Block-Baum einer Seite (Editor → Backend):
 * vorhandene aktualisieren, neue anlegen, entfernte löschen, Reihenfolge setzen.
 * Diff über die vorhandenen Endpunkte (kein eigener Bulk-Endpoint nötig). Gibt
 * die frische, geordnete Block-Liste zurück (mit echten DB-IDs).
 */
export async function syncBlocks(
  pageId: string,
  blocks: SyncBlock[],
): Promise<Result<{ items: Block[]; total: number }>> {
  const existing = await listBlocks(pageId);
  if (!existing.ok) return existing;
  const keepIds = new Set(
    blocks.map((b) => b.blockId).filter((id): id is string => !!id),
  );

  // 1) Entfernte Blöcke löschen.
  for (const old of existing.data.items) {
    if (!keepIds.has(old.id)) {
      const res = await removeBlock(old.id);
      if (!res.ok) return res;
    }
  }

  // 2) Vorhandene aktualisieren, neue anlegen → finale ID-Reihenfolge sammeln.
  const orderedIds: string[] = [];
  for (const b of blocks) {
    if (b.blockId && keepIds.has(b.blockId)) {
      const res = await updateBlock(b.blockId, {
        content: b.content,
        settings: b.settings,
      });
      if (!res.ok) return res;
      orderedIds.push(b.blockId);
    } else {
      const res = await addBlock(pageId, b.type, b.content, b.settings);
      if (!res.ok) return res;
      orderedIds.push(res.data.id);
    }
  }

  // 3) Reihenfolge setzen (liefert die geordnete Liste zurück).
  if (orderedIds.length > 0) {
    const res = await reorderBlocks(pageId, orderedIds);
    if (res.ok) touch();
    return res;
  }
  touch();
  return { ok: true, data: { items: [], total: 0 } };
}

// --- Live-Vorschau (Draft-Token für den builder-iframe) ---------------------
export async function createDraftToken(
  pageId: string,
): Promise<Result<{ token: string }>> {
  return call(`/site-config/pages/${pageId}/draft-token`, { method: "POST" });
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
