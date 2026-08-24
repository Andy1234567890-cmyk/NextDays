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
  | "reviews"
  | "faq"
  | "map"
  | "testimonials"
  | "features"
  | "form"
  | "posts";

/** Wo eine Seite in der Navigation der Kunden-Site hängt (0421). Die Zuordnung
 *  IST die Seitenstruktur: Kopfzeile, Fußzeile, oder nur per Direktlink. */
export type NavArea = "header" | "footer" | "none";

/** Was eine Zeile in der Seitenliste ist (0433).
 *
 *  `normal` = Seite mit Abschnitten · `external` = Menüpunkt auf eine fremde
 *  Adresse · `folder` = Gruppe im Menü, selbst keine Seite · `error404` = die
 *  Fehlerseite (höchstens eine, in keiner Navigation, in keiner Sitemap). */
export type PageType =
  | "normal"
  | "external"
  | "folder"
  | "error404"
  /** Ein Pop-up (0437). Auch das ist eine Seite: es hat Abschnitte, wird im
   *  Editor gebaut und veröffentlicht. Es erscheint nur nicht über eine
   *  Adresse, sondern über einen Auslöser. */
  | "popup"
  /** Ein Blog-Beitrag (0438). Dieselben Abschnitte wie eine Seite, dazu Datum,
   *  Autor, Titelbild, Anriss und Schlagwörter. */
  | "post";

/** Wann ein Pop-up erscheint (0437). */
export type PopupTrigger = "delay" | "exit" | "scroll";

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
  // --- SEO je Seite (0430) ------------------------------------------------
  /** Kommagetrennt. Rückfall: die site-weiten Keywords. */
  seo_keywords: string | null;
  /** Abweichende kanonische Adresse. `null` = diese Seite ist das Original.
   *  BEWUSST ohne site-weiten Rückfall: ein site-weiter Canonical würde jede
   *  Unterseite als Duplikat der Startseite erklären. */
  canonical_url: string | null;
  /** Kopf-HTML nur dieser Seite (seitenspezifisches JSON-LD). Allowlist wie
   *  site-weit: meta/link/title, keine Skripte. */
  head_html: string | null;
  /** true = diese Seite aus dem Suchindex halten. */
  noindex: boolean;
  // --- Seitentypen (0433) --------------------------------------------------
  page_type: PageType;
  /** Ziel eines externen Menüpunkts. Nur bei `page_type = "external"`. */
  external_url: string | null;
  /** Übergeordneter Ordner, oder null. Genau eine Ebene tief. */
  parent_id: string | null;
  // --- Pop-up (0437) -------------------------------------------------------
  popup_trigger: PopupTrigger | null;
  /** Sekunden bei `delay`, Prozent bei `scroll`. Ein Feld für beides, weil
   *  immer nur ein Auslöser aktiv ist. */
  popup_value: number | null;
  popup_device: "mobile" | "desktop" | null;
  popup_once: boolean;
  // --- Blog-Beitrag (0438) -------------------------------------------------
  /** Erscheinungsdatum. Bestimmt die Reihenfolge im Blog; ein Datum in der
   *  Zukunft ist die Vorplanung — der Beitrag erscheint dann von selbst. */
  published_at: string | null;
  author: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  tags: string[] | null;
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
  /** Seitentyp (0433). Default `normal` — der Regelfall. */
  pageType: PageType = "normal",
  /** Nur bei `external`: die vollständige https-Adresse. */
  externalUrl: string | null = null,
  /** Nur bei `normal`/`external`: der übergeordnete Ordner. */
  parentId: string | null = null,
  /** Pop-up-Auslöser (0437). Nur bei `pageType = "popup"` gesetzt. */
  popup: {
    trigger: PopupTrigger;
    value: number | null;
    device: "mobile" | "desktop" | null;
    once: boolean;
  } | null = null,
  /** Seiten-Vorlage (0434): legt die Seite mit fertigen Abschnitten an.
   *  `null` = leere Seite. Titel und Slug dürfen dann leer bleiben — sie kommen
   *  aus der Vorlage. */
  template: string | null = null,
): Promise<Result<Page>> {
  const res = await call<Page>("/site-config/pages", {
    method: "POST",
    body: {
      title,
      slug,
      nav_area: navArea,
      page_type: pageType,
      external_url: externalUrl,
      parent_id: parentId,
      popup_trigger: popup?.trigger ?? null,
      popup_value: popup?.value ?? null,
      popup_device: popup?.device ?? null,
      popup_once: popup?.once ?? true,
      template,
    },
  });
  if (res.ok) touch();
  return res;
}

/** Eine Seite samt Abschnitten kopieren (0433).
 *
 *  Die Kopie ist immer ein ENTWURF und trägt KEINE SEO-Felder des Originals —
 *  sonst stünden zwei Seiten mit demselben Meta-Titel live. */
export async function duplicatePage(pageId: string): Promise<Result<Page>> {
  const res = await call<Page>(`/site-config/pages/${pageId}/duplicate`, {
    method: "POST",
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
      | "seo_keywords"
      | "canonical_url"
      | "head_html"
      | "noindex"
      | "external_url"
      | "parent_id"
      | "popup_trigger"
      | "popup_value"
      | "popup_device"
      | "popup_once"
      | "published_at"
      | "author"
      | "cover_image_url"
      | "excerpt"
      | "tags"
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
