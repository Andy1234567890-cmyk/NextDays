"use server";

// Page-Builder: Server-Actions gegen den FastAPI-site_config-Slice
// (/api/v1/site-config/pages|blocks|templates). Seiten + Blöcke der white-label
// Agentur-Website. 1:1 zu den Backend-Aktionen benannt (MCP-ready).
import { revalidatePath } from "next/cache";

import { ApiError, api, apiBasis } from "@/lib/api";
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
  | "featured_properties"
  | "reviews";

/** Wo eine Seite in der Navigation der Kunden-Site hängt (0421). Die Zuordnung
 *  IST die Seitenstruktur: Kopfzeile, Fußzeile, oder nur per Direktlink. */
export type NavArea = "header" | "footer" | "none";

export type Page = {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  is_home: boolean;
  is_published: boolean;
  nav_area: NavArea;
  nav_order: number;
  /** Sprachen, in denen DIESE Seite existiert (0426). `null` = alle Sprachen
   *  der Website — der Normalfall, der keinen Eintrag braucht. */
  languages: string[] | null;
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
  revalidatePath("/website", "layout");
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
  navArea: NavArea = "header",
): Promise<Result<Page>> {
  const res = await call<Page>("/site-config/pages", {
    method: "POST",
    body: { title, slug, nav_area: navArea },
  });
  if (res.ok) touch();
  return res;
}

export async function updatePage(
  pageId: string,
  input: Partial<
    Pick<
      Page,
      | "title"
      | "slug"
      | "seo_title"
      | "seo_description"
      | "og_image_url"
      | "nav_area"
      | "nav_order"
      | "languages"
    >
  >,
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

/** Ein Abschnitt, wie ihn der Editor speichert (`id: null` → neu anlegen). */
export type AbschnittEingabe = {
  id: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

/**
 * Setzt ALLE Abschnitte einer Seite in EINEM Aufruf und gibt die frische,
 * geordnete Liste mit echten DB-IDs zurück.
 *
 * Vorher lief das Speichern als Folge einzelner Requests (löschen → updaten →
 * anlegen → neu ordnen), also N+1 Aufrufe ohne Transaktion: brach einer in der
 * Mitte ab, blieb die Seite halb gespeichert, und ein zweiter Klick lief die
 * ganze Sequenz erneut. Der Bulk-Endpunkt ist idempotent — dieselbe Liste
 * zweimal gesendet ergibt denselben Zustand (Wurzel 2).
 */
export async function speichereAbschnitte(
  pageId: string,
  items: AbschnittEingabe[],
): Promise<Result<{ items: Block[]; total: number }>> {
  const res = await call<{ items: Block[]; total: number }>(
    `/site-config/pages/${pageId}/blocks`,
    { method: "PUT", body: { items } },
  );
  if (res.ok) touch();
  return res;
}

/** Seiten innerhalb EINES Navigationsbereichs neu sortieren. */
export async function reorderPages(
  navArea: NavArea,
  orderedIds: string[],
): Promise<Result<{ items: Page[]; total: number }>> {
  const res = await call<{ items: Page[]; total: number }>(
    "/site-config/pages/reorder",
    { method: "POST", body: { nav_area: navArea, ordered_ids: orderedIds } },
  );
  if (res.ok) touch();
  return res;
}

// --- Mediathek --------------------------------------------------------------
/** Ein Bild im Bestand des Betriebs. */
export type Medium = {
  id: string;
  url: string;
  filename: string | null;
  mime: string;
  bytes: number;
  created_at: string | null;
};

/** Bildbestand laden, neueste zuerst. */
export async function listMedia(
  limit = 100,
  offset = 0,
): Promise<Result<{ items: Medium[]; total: number }>> {
  return call(`/site-config/media?limit=${limit}&offset=${offset}`);
}

/**
 * Ein Bild hochladen.
 *
 * Geht bewusst NICHT über `api()` wie die übrigen Aufrufe: der Body ist
 * `multipart/form-data`, und ein mitgesetzter `Content-Type: application/json`
 * würde die Grenzmarkierung zerstören, die der Browser selbst erzeugt. Der
 * Bildtyp wird ohnehin serverseitig aus den Anfangsbytes bestimmt — was hier
 * im FormData steht, ist für die Sicherheit ohne Bedeutung.
 */
export async function uploadMedium(
  datei: File,
): Promise<Result<Medium>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const body = new FormData();
  body.append("file", datei);
  try {
    const res = await fetch(`${apiBasis()}/site-config/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (!res.ok) {
      const detail = await res
        .json()
        .then((j) => (typeof j?.detail === "string" ? j.detail : null))
        .catch(() => null);
      return {
        ok: false,
        error: detail ?? "Upload fehlgeschlagen.",
        status: res.status,
      };
    }
    touch();
    return { ok: true, data: (await res.json()) as Medium };
  } catch {
    return { ok: false, error: "Upload fehlgeschlagen." };
  }
}

/** Bild aus der Mediathek entfernen (Zeile UND Datei im Bucket). */
export async function removeMedium(mediumId: string): Promise<Result<null>> {
  const res = await call<null>(`/site-config/media/${mediumId}`, {
    method: "DELETE",
  });
  if (res.ok) touch();
  return res;
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
