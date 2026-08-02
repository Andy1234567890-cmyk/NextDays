// Daten-Layer der Builder-App: lädt die vom Tenant komponierte Seite (Block-Baum
// + Branding) vom öffentlichen Resolver (/api/v1/site/page) über den eigenen
// Origin-Proxy. Muster wie lib/inserate.ts: kurzes Zeitbudget, resilient.
import type { SiteBranding } from "./site-context";

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

export type Block = {
  type: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export type PageMeta = {
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
};

export type SitePage = {
  tenant_id: string;
  page: PageMeta;
  blocks: Block[];
  branding: SiteBranding;
};

const FETCH_TIMEOUT_MS = 8000;

function base(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Veröffentlichte Seite eines Hosts laden (Home bei slug=""/undefined).
 *  null, wenn keine veröffentlichte Seite existiert (404) oder das Backend
 *  nicht erreichbar ist — der Aufrufer zeigt dann notFound()/Leerzustand. */
export async function ladeSeite(
  host: string,
  slug?: string,
): Promise<SitePage | null> {
  const qs = new URLSearchParams({ host });
  if (slug) qs.set("slug", slug);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}/api/v1/site/page?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null; // 404 = keine veröffentlichte Seite
    return (await res.json()) as SitePage;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Entwurfsseite für den Editor-iframe (rendert auch unveröffentlichte Blöcke).
 *  Token verifiziert das Backend; ohne gültigen Token → null. */
export async function ladeSeitenEntwurf(
  pageId: string,
  token: string,
): Promise<SitePage | null> {
  const qs = new URLSearchParams({ page_id: pageId, token });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}/api/v1/site/page/draft?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as SitePage;
  } finally {
    clearTimeout(timer);
  }
}
