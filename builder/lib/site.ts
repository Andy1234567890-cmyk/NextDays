// Daten-Layer der Builder-App: lädt die vom Tenant komponierte Seite (Block-Baum
// + Branding) vom öffentlichen Resolver (/api/v1/site/page) — serverseitig direkt
// an FastAPI. Muster wie lib/inserate.ts: kurzes Zeitbudget, resilient.
import { cache } from "react";

import { backendBasis } from "./backend-basis";
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
  | "reviews"
  | "faq"
  | "map"
  | "testimonials"
  | "features"
  | "form"
  | "posts";

export type Block = {
  /** DB-ID. Nur beim Formular-Abschnitt gesetzt und nur dort gebraucht (zum
   *  Absenden). Alle anderen Abschnitte brauchen sie nicht, deshalb liefert der
   *  Resolver sie sonst nicht mit — es wandert keine interne ID ohne Grund auf
   *  eine Gast-Seite. */
  id?: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export type PageMeta = {
  slug: string;
  title: string;
  // Der site-weite Rückfall ist BEREITS aufgelöst (0430): steht hier ein Wert,
  // ist er entweder der der Seite oder der der Website — die Hierarchie liegt im
  // Backend-Resolver, damit sie nicht an zwei Stellen gepflegt wird.
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  seo_keywords: string | null;
  canonical_url: string | null;
  head_html: string | null;
  noindex: boolean;
};

export type SitePage = {
  tenant_id: string;
  page: PageMeta;
  blocks: Block[];
  branding: SiteBranding;
};

const FETCH_TIMEOUT_MS = 8000;

function base(): string {
  return backendBasis();
}

/** Veröffentlichte Seite eines Hosts laden (Home bei slug=""/undefined).
 *  null, wenn keine veröffentlichte Seite existiert (404) oder das Backend
 *  nicht erreichbar ist — der Aufrufer zeigt dann notFound()/Leerzustand. */
async function ladeSeiteRoh(
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

/** Ein Blog-Beitrag mit seinen Abschnitten (0438).
 *
 *  `null` bei unbekanntem Slug, bei einem Entwurf ODER bei einem Beitrag, der
 *  noch nicht dran ist — die Vorplanung soll auch dann halten, wenn jemand den
 *  Link kennt. */
export const ladeBeitrag = cache(async function ladeBeitragRoh(
  host: string,
  slug: string,
): Promise<
  | (SitePage & {
      post: {
        slug: string;
        title: string;
        excerpt: string | null;
        author: string | null;
        cover_image_url: string | null;
        tags: string[];
        published_at: string | null;
      };
    })
  | null
> {
  const qs = new URLSearchParams({ host });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base()}/api/v1/site/posts/${encodeURIComponent(slug)}?${qs.toString()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
});

/** Dieselbe Seite, aber pro Request nur EINMAL geholt.
 *
 *  Nötig, seit `generateMetadata` existiert: Next ruft es VOR der Komponente
 *  auf, und beide brauchen dieselbe Seite. Ohne diesen Wrapper wäre jede
 *  Seitenansicht zwei identische Backend-Abrufe — `fetch` dedupliziert bei
 *  `cache: "no-store"` nicht.
 *
 *  `cache()` von React gilt genau für die Dauer EINES Requests. Es ist kein
 *  Zwischenspeicher über Requests hinweg: eine gerade veröffentlichte Änderung
 *  ist beim nächsten Aufruf da. */
export const ladeSeite = cache(ladeSeiteRoh);

/** Die eigene 404-Seite eines Hosts (0433), oder `null`.
 *
 *  `null` heißt: dieser Betrieb hat keine angelegt — der Normalfall. Der
 *  Aufrufer zeigt dann die eingebaute Fehlerseite.
 *
 *  In `cache()` gewickelt wie `ladeSeite`: `not-found.tsx` und
 *  `generateMetadata` können beide danach fragen. */
export const ladeFehlerseite = cache(async function ladeFehlerseiteRoh(
  host: string,
): Promise<SitePage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base()}/api/v1/site/page/404?host=${encodeURIComponent(host)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const daten = (await res.json()) as SitePage | null;
    // Der Endpunkt antwortet mit 200 und `null`, wenn es keine eigene
    // Fehlerseite gibt — „keine" ist der Normalfall und kein Fehler.
    return daten && daten.page ? daten : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
});

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
