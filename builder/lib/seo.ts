// Datenzugriff für die drei Maschinen-Dateien einer Kunden-Website (0430):
// sitemap.xml, robots.txt und llms.txt — plus die Auflösung von
// URL-Weiterleitungen beim 404.
//
// Muster wie lib/site.ts: kurzes Zeitbudget, resilient, kein erfundener
// Rückfall. Der Unterschied zu den Seiten-Abrufen: hier ist ein Fehlschlag
// FOLGENLOS für den Gast — er sieht diese Dateien nie. Deshalb `null` statt
// notFound(), und der Aufrufer liefert dann eine minimale, korrekte Datei aus
// statt einer erfundenen.
import { backendBasis } from "./backend-basis";

/** Eine Seite in der Sitemap. `slug` ist leer für die Startseite. */
export type SitemapSeite = {
  slug: string;
  /** Lesbarer Name der Seite. Die Sitemap braucht ihn nicht, llms.txt schon:
   *  eine Antwortmaschine liest „Über uns", kein „/ueber-uns". */
  title: string;
  lastmod: string | null;
  is_home: boolean;
  languages: string[] | null;
};

export type SitemapObjekt = {
  id: string;
  lastmod: string | null;
};

/** Ein Blog-Beitrag in der Sitemap (0438). */
export type SitemapBeitrag = {
  slug: string;
  title: string;
  lastmod: string | null;
};

export type SitemapDaten = {
  pages: SitemapSeite[];
  properties: SitemapObjekt[];
  posts: SitemapBeitrag[];
  /** true = der Deckel von 5000 Adressen wurde erreicht. Wird als Kommentar in
   *  die XML-Datei geschrieben: eine halbe Sitemap, die vollständig aussieht,
   *  lässt Google die andere Hälfte ignorieren, ohne dass jemand die Ursache
   *  findet. */
  abgeschnitten: boolean;
  noindex: boolean;
  site_name: string | null;
  seo_description: string | null;
  default_language: string | null;
  languages: string[] | null;
};

export type Weiterleitung = {
  target: string;
  /** 301 = dauerhaft, 302 = vorübergehend. */
  redirect_type: number;
};

const FETCH_TIMEOUT_MS = 8000;

/** Alle indexierbaren Adressen eines Hosts + die site-weiten SEO-Angaben.
 *
 *  EIN Aufruf für drei Dateien: die Host-Auflösung ist der teure Teil, und
 *  robots.txt braucht dieselben Angaben wie die Sitemap (Name, Sprachen,
 *  noindex).
 *
 *  `null` bei unbekannter Domain, offline geschalteter Website oder nicht
 *  erreichbarem Backend. Der Aufrufer liefert dann eine restriktive Datei aus
 *  — bei robots.txt heißt „ich weiß es nicht" `Disallow: /`, nicht „alles
 *  erlaubt" (fail-closed, Wurzel 5). */
export async function ladeSitemap(host: string): Promise<SitemapDaten | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${backendBasis()}/api/v1/site/sitemap?host=${encodeURIComponent(host)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as SitemapDaten;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Gibt es für diesen Pfad eine aktive Weiterleitung?
 *
 *  Wird NUR gerufen, wenn unter dem Pfad keine Seite existiert — eine
 *  vorhandene Seite hat immer Vorrang. Sonst wäre eine Seite über ihre eigene
 *  Adresse unerreichbar, sobald jemand versehentlich eine Weiterleitung darauf
 *  legt (Hostaway nennt genau das als häufigste Fehlerursache).
 *
 *  `null` heißt „keine Weiterleitung" — dann zeigt der Aufrufer seine
 *  404-Seite. Ein Fehlschlag des Abrufs führt zum selben Ergebnis: eine
 *  geratene Weiterleitung wäre schlimmer als eine Fehlerseite. */
export async function ladeWeiterleitung(
  host: string,
  pfad: string,
): Promise<Weiterleitung | null> {
  const qs = new URLSearchParams({ host, path: pfad });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${backendBasis()}/api/v1/site/redirect?${qs.toString()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const daten = (await res.json()) as {
      target: string | null;
      redirect_type: number | null;
    };
    if (!daten.target || !daten.redirect_type) return null;
    return { target: daten.target, redirect_type: daten.redirect_type };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Ein Pop-up mit seinem Auslöser und seinen Abschnitten (0437). */
export type PopupAntwort = {
  id: string;
  title: string;
  trigger: "delay" | "exit" | "scroll";
  value: number | null;
  device: "mobile" | "desktop" | null;
  once: boolean;
  /** Position im 3×3-Raster (0440). `null` = mittig. */
  position: string | null;
  blocks: Array<{
    type: string;
    content: Record<string, unknown>;
    settings: Record<string, unknown>;
  }>;
};

/** Die Pop-ups einer Website.
 *
 *  Leere Liste, wenn es keine gibt — der Normalfall. Ein Fehlschlag des Abrufs
 *  führt zum selben Ergebnis: eine Seite ohne Pop-up ist vollständig, eine
 *  Fehlermeldung an dieser Stelle wäre für den Gast unverständlich. */
export async function ladePopups(host: string): Promise<PopupAntwort[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${backendBasis()}/api/v1/site/popups?host=${encodeURIComponent(host)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return [];
    const daten = (await res.json()) as { items?: PopupAntwort[] };
    return daten.items ?? [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Die aktiven Personalisierungs-Regeln eines Hosts (0440).
 *
 *  Fehlschlag = leere Liste, wie bei den Pop-ups. Eine Website ohne Regeln ist
 *  eine gültige Website; sie wegen eines Abrufproblems gar nicht auszuliefern
 *  wäre der größere Schaden. `ort_verfuegbar` sagt, ob der Ort-Auslöser
 *  überhaupt entscheidbar ist — ohne Geo-Dienst ruhen solche Regeln.
 */
export async function ladeRegeln(
  host: string,
): Promise<{ items: RegelAntwort[]; ortVerfuegbar: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${backendBasis()}/api/v1/site/rules?host=${encodeURIComponent(host)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return { items: [], ortVerfuegbar: false };
    const daten = (await res.json()) as {
      items?: RegelAntwort[];
      ort_verfuegbar?: boolean;
    };
    return {
      items: daten.items ?? [],
      ortVerfuegbar: Boolean(daten.ort_verfuegbar),
    };
  } catch {
    return { items: [], ortVerfuegbar: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Eine Regel, wie der öffentliche Endpunkt sie liefert. */
export type RegelAntwort = {
  id: string;
  triggers: Record<string, unknown>;
  action_type: "popup" | "top_bar" | "effect" | "script";
  action: Record<string, unknown>;
  seiten: string[];
  einmal_je_besucher: boolean;
  wieder_nach_tagen: number | null;
};

/** Ein Blog-Beitrag in der Liste (0438). */
export type Beitrag = {
  slug: string;
  title: string;
  excerpt: string | null;
  author: string | null;
  cover_image_url: string | null;
  tags: string[];
  published_at: string | null;
};

/** Die Blog-Einstellungen des Betriebs (0457).
 *
 *  Alles darf leer sein: leer heißt „nicht eingestellt", und der Renderer fällt
 *  dann auf seinen ÜBERSETZTEN Standardtitel zurück — kein erfundener Wert. */
export type BlogAngaben = {
  blog_name: string | null;
  prev_next: boolean;
  rss_title: string | null;
  rss_description: string | null;
  rss_image_url: string | null;
};

export const BLOG_LEER: BlogAngaben = {
  blog_name: null,
  prev_next: true,
  rss_title: null,
  rss_description: null,
  rss_image_url: null,
};

export type BeitragsListe = {
  items: Beitrag[];
  total: number;
  /** Die Schlagwörter DIESER Seite der Liste, für die Filterleiste. */
  tags: string[];
  blog: BlogAngaben;
};

/** Die veröffentlichten Beiträge eines Hosts.
 *
 *  Beiträge mit einem Erscheinungsdatum in der Zukunft bleiben aus — das ist
 *  die Vorplanung, und sie wird serverseitig entschieden.
 *
 *  `tag` ist die Filterleiste der Blog-Seite (EIN Schlagwort), `tags` die
 *  Mehrfachauswahl des „Alle Beiträge"-Abschnitts, `q` die Beitragssuche (nur
 *  Titel). Alle drei werden serverseitig ausgewertet: eine Filterung im Browser
 *  hieße, erst alles zu laden und dann das meiste wegzuwerfen. */
export async function ladeBeitraege(
  host: string,
  opts: {
    limit?: number;
    offset?: number;
    tag?: string;
    tags?: string[];
    q?: string;
  } = {},
): Promise<BeitragsListe> {
  const qs = new URLSearchParams({ host });
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.offset) qs.set("offset", String(opts.offset));
  if (opts.tag) qs.set("tag", opts.tag);
  for (const t of opts.tags ?? []) qs.append("tags", t);
  if (opts.q) qs.set("q", opts.q);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${backendBasis()}/api/v1/site/posts?${qs.toString()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return { items: [], total: 0, tags: [], blog: BLOG_LEER };
    return (await res.json()) as BeitragsListe;
  } catch {
    return { items: [], total: 0, tags: [], blog: BLOG_LEER };
  } finally {
    clearTimeout(timer);
  }
}

/** Absolute Basis-Adresse der Kunden-Website.
 *
 *  Immer `https`: eine Kunden-Domain läuft hinter Cloudflare mit erzwungenem
 *  SSL, und in einer Sitemap oder einem Canonical steht `http` sonst als
 *  eigenständige, konkurrierende Adresse. Google behandelt beide Schemata als
 *  verschiedene Seiten — ein `http`-Canonical wäre also genau der
 *  Duplicate-Content, den er verhindern soll. */
export function basisUrl(host: string): string {
  return `https://${host}`;
}

/** Pfad einer Seite aus ihrem Slug. Der leere Slug der Startseite wird zu „/",
 *  nicht zu einer Adresse mit doppeltem Schrägstrich. */
export function seitenPfad(slug: string): string {
  const rein = (slug || "").trim().replace(/^\/+|\/+$/g, "");
  return rein ? `/${rein}` : "/";
}
