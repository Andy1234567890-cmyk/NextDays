// Daten-Layer der Builder-App: lädt die vom Tenant komponierte Seite (Block-Baum
// + Branding) vom öffentlichen Resolver (/api/v1/site/page) — serverseitig direkt
// an FastAPI. Muster wie lib/inserate.ts: kurzes Zeitbudget, resilient.
import { cache } from "react";

import { backendBasis } from "./backend-basis";
import type { BlogAngaben } from "./seo";
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
  | "posts"
  // --- Objektseite (0468) --------------------------------------------------
  // Die Bausteine der Buchungsstrecke. Sie ziehen ihren Inhalt aus dem
  // angezeigten Objekt — einstellbar ist nur die Darstellung.
  //
  // In dieser Aufzählung darf KEIN Strichpunkt stehen, auch nicht in einem
  // Kommentar: `blocktypen-pruefen.mjs` liest sie bis zum ersten und hielte
  // davor an. Die Prüfung meldete dann jeden Typ darunter als fehlend, obwohl
  // er dasteht — und das ist schlimmer als gar keine Prüfung.
  | "property_book_form"
  | "property_gallery"
  | "property_description"
  | "property_amenities"
  | "property_map"
  // 0472 — der Container-Typ. Er trägt keinen Inhalt, sondern Struktur:
  // Abschnitt, Spalte, innere Spalte.
  | "container"
  // --- 0450: Basis-Widgets -------------------------------------------------
  | "accordion"
  | "tabs"
  | "countdown"
  | "table"
  | "list"
  | "file"
  | "copyright"
  | "breadcrumbs"
  // --- 0458: die Beitragssuche ---------------------------------------------
  | "search_posts"
  // --- 0451: Medien-Widgets -------------------------------------------------
  | "media_slider"
  | "video"
  | "audio"
  | "before_after"
  | "shape"
  // --- 0452: Business-Widgets -----------------------------------------------
  | "business_hours"
  | "click_to_call"
  | "click_to_email"
  | "multi_location"
  // --- 0471: Social-/Sonstiges-Widgets --------------------------------------
  | "social_icons"
  | "share_button"
  | "whatsapp_chat"
  | "rss_feed"
  | "facebook_feed"
  | "html_widget"
  // --- Buchungsstrecke (0474) ----------------------------------------------
  // Die Bausteine der Seiten NACH der Objektseite. Bis 0474 waren Checkout und
  // Bestätigung fest programmierte Routen ohne Blöcke. Ihr Aussehen stand im
  // Renderer und war für den Betrieb unerreichbar.
  //
  // In diesem Kommentar darf KEIN Semikolon stehen. blocktypen-pruefen.mjs
  // schneidet die Union am ersten Semikolon ab und sähe die vier Typen
  // darunter sonst nicht.
  | "checkout_form"
  | "checkout_summary"
  | "checkout_result"
  | "post_list";

/** Die Geräte, für die ein Abschnitt EINZELN ausgeblendet werden kann (0449).
 *
 *  Genau die drei, die der Editor umschalten und in der Vorschau zeigen kann,
 *  und jedes hat seinen eigenen Bereich im CSS: `mobil` die Basis (unter
 *  768 px), `tablet` ab `md` (768), `desktop` ab `lg` (1024). Ein Name ohne
 *  Breakpoint würde am Ende irgendetwas Falsches ausblenden.
 *
 *  SCHWESTERWERT: `GERAETE` in `web/components/website/editor/sichtbarkeit.ts`
 *  und `BlockGeraet` in `apps/api/.../site_config/schemas.py`. Die drei müssen
 *  dieselben Werte in derselben Reihenfolge führen — das Backend sortiert
 *  `hidden_on` danach. */
export type BlockGeraet = "desktop" | "tablet" | "mobil";

const GERAETE: readonly BlockGeraet[] = ["desktop", "tablet", "mobil"];

/**
 * Auf welchen Geräten dieser Abschnitt beim GAST nicht erscheint.
 *
 * Der Wert steht in `settings.hidden_on` — dort und nicht in einer eigenen
 * Spalte, weil eine Seite an sechs Stellen für den Renderer zusammengebaut
 * wird und jede davon `settings` unverändert durchreicht (0449).
 *
 * Hier wird NOCHMAL geprüft, obwohl das Backend beim Speichern prüft: in der
 * Datenbank stehen Zeilen, die älter sind als diese Prüfung, und ein
 * unbekannter Wert würde sonst zu einer Tailwind-Klasse, die es nicht gibt —
 * der Abschnitt bliebe stumm sichtbar. Unbekanntes wird verworfen, nicht
 * geraten (Wurzel 4).
 */
export function versteckteGeraete(
  settings: Record<string, unknown>,
): BlockGeraet[] {
  const roh = settings.hidden_on;
  if (!Array.isArray(roh)) return [];
  return GERAETE.filter((g) => roh.includes(g));
}

export type Block = {
  // --- Baum (0472) ---------------------------------------------------------
  /** Was diese Zeile IST. `section` und `column` tragen keinen Inhalt, sondern
   *  Struktur; `widget` ist der eigentliche Baustein.
   *
   *  Standard `widget`: eine Antwort aus einer älteren Fassung des Resolvers
   *  hat das Feld nicht, und ein Block ohne Angabe ist ein Baustein. */
  kind?: "section" | "column" | "inner_column" | "widget";
  /** Breitenanteil einer Spalte in ZWÖLFTELN. `null` bei allem anderen. */
  span?: number | null;
  /** Die Kinder dieses Knotens, in ihrer Reihenfolge. */
  children?: Block[];
  /** DB-ID. Nur beim Formular-Abschnitt gesetzt und nur dort gebraucht (zum
   *  Absenden). Alle anderen Abschnitte brauchen sie nicht, deshalb liefert der
   *  Resolver sie sonst nicht mit — es wandert keine interne ID ohne Grund auf
   *  eine Gast-Seite. */
  id?: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};

/** Eine Stufe im Brotkrumen-Pfad (0450).
 *
 *  `slug` ist `null`, wenn die Stufe kein Ziel hat — ein Ordner (der hat keine
 *  Adresse) oder eine unveröffentlichte Elternseite. Der Renderer zeigt sie dann
 *  als Text; ein Link auf eine Seite, die es öffentlich nicht gibt, wäre eine
 *  404 mitten in der Navigation. */
export type TrailItem = {
  title: string;
  slug: string | null;
};

export type PageMeta = {
  slug: string;
  title: string;
  /** Der Weg von oben bis zur ELTERN-Seite. Die aktuelle Seite steht NICHT
   *  darin — `title` oben ist sie. Kommt fertig aus dem Resolver: die
   *  Seitenhierarchie kennt nur der Server. */
  trail: TrailItem[];
  // Der site-weite Rückfall ist BEREITS aufgelöst (0430): steht hier ein Wert,
  // ist er entweder der der Seite oder der der Website — die Hierarchie liegt im
  // Backend-Resolver, damit sie nicht an zwei Stellen gepflegt wird.
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  /** Alternativtext zum Vorschaubild (0457) — er beschreibt das BILD, nicht
   *  die Seite. Gilt nur, wenn das Vorschaubild wirklich das der Seite ist. */
  og_image_alt: string | null;
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
  /** Der BEITRAG, wenn die Seite einer ist (0438/0483/0485).
   *
   *  `null`/fehlend bei jeder normalen Seite. Gefüllt nur im Entwurfs-Render
   *  des Editors: ein Beitrag hat keine Abschnitte, sein Inhalt steht in
   *  `content_html` und den Beitragsfeldern. Ohne ihn zeigte der Editor-iframe
   *  für einen Beitrag eine weiße Fläche. */
  post?: {
    slug: string;
    title: string;
    excerpt: string | null;
    author: string | null;
    cover_image_url: string | null;
    tags: string[];
    published_at: string | null;
    content_html: string | null;
    felder: BeitragsFelder | null;
  } | null;
  /** Die eigenen Felder des Betriebs (0485) — Schlüssel und Name. */
  eigene_felder?: { feld_key: string; label: string }[];
};

const FETCH_TIMEOUT_MS = 8000;

function base(): string {
  return backendBasis();
}

/** Veröffentlichte Seite eines Hosts laden (Home bei slug=""/undefined).
 *  null, wenn keine veröffentlichte Seite existiert (404) oder das Backend
 *  nicht erreichbar ist — der Aufrufer zeigt dann notFound()/Leerzustand. */
/** Was beim Laden einer Seite herauskommt.
 *
 *  Drei Ausgänge statt zwei, und der dritte ist neu (0442): eine Seite kann
 *  GESPERRT sein. Mit `null` für beides — „gibt es nicht" und „darfst du
 *  nicht" — hätte der Renderer eine geschützte Seite als 404 gezeigt, und der
 *  Gast mit dem richtigen Passwort in der Hand hätte nie erfahren, dass er nur
 *  danach gefragt werden muss. */
export type SeitenErgebnis =
  | { art: "seite"; seite: SitePage }
  | { art: "gesperrt" }
  | { art: "fehlt" };

async function ladeSeiteErgebnisRoh(
  host: string,
  slug?: string,
  ticket?: string | null,
  sprache?: string | null,
): Promise<SeitenErgebnis> {
  const qs = new URLSearchParams({ host });
  if (slug) qs.set("slug", slug);
  if (ticket) qs.set("ticket", ticket);
  // Die Sprache MUSS an den Resolver: Titel und Meta-Angaben der Seite liegen
  // je Sprache in einer eigenen Zeile (0476), und die wählt der Server aus.
  // Sie hier weglassen hieße, eine dänische Adresse mit deutschem `<title>`
  // auszuliefern — genau das, was die Fassung verhindern soll.
  if (sprache) qs.set("sprache", sprache);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}/api/v1/site/page?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status === 401) return { art: "gesperrt" };
    if (!res.ok) return { art: "fehlt" };
    return { art: "seite", seite: (await res.json()) as SitePage };
  } catch {
    return { art: "fehlt" };
  } finally {
    clearTimeout(timer);
  }
}

async function ladeSeiteRoh(
  host: string,
  slug?: string,
  ticket?: string | null,
  sprache?: string | null,
): Promise<SitePage | null> {
  const ergebnis = await ladeSeiteErgebnisRoh(host, slug, ticket, sprache);
  return ergebnis.art === "seite" ? ergebnis.seite : null;
}

/** Ein Blog-Beitrag mit seinen Abschnitten (0438).
 *
 *  `null` bei unbekanntem Slug, bei einem Entwurf ODER bei einem Beitrag, der
 *  noch nicht dran ist — die Vorplanung soll auch dann halten, wenn jemand den
 *  Link kennt. */
/** Die Vorlagenfelder eines Beitrags, wie die Website sie bekommt (0483/0485).
 *
 *  Namen wie im CMS, ohne den `post_`-Präfix der Datenbank — eine zweite
 *  Benennung für den Renderer wäre eine zweite Wahrheit darüber, wie ein Feld
 *  heißt (Wurzel 2). */
export type BeitragsFelder = {
  industry: string | null;
  client: string | null;
  full_title: string | null;
  intro_heading: string | null;
  intro_body: string | null;
  button_text: string | null;
  website_link: string | null;
  gallery_top: string[];
  gallery_left: string | null;
  gallery_right: string | null;
  gallery_bottom: string[];
  final_heading: string | null;
  final_body: string | null;
  show_carousel: boolean;
  /** Die vier Karussellbilder als EINE Liste, leere Plätze ausgelassen — der
   *  Server setzt sie zusammen. */
  carousel: string[];
  /** Die Werte der eigenen Felder, Schlüssel = `feld_key`. */
  custom: Record<string, unknown>;
};

export const ladeBeitrag = cache(async function ladeBeitragRoh(
  host: string,
  slug: string,
  sprache?: string | null,
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
        /** Der Beitragstext als gesäubertes HTML (0480).
         *
         *  Er kommt SERVERSEITIG gesäubert (`nh3`, `site_config/basis.
         *  _RICH_TEXT_TAGS`) — hier wird nichts mehr geprüft, weil eine zweite
         *  Prüfung im Renderer die erste irgendwann ersetzt und dann eine
         *  Lücke ist (Wurzel 8). */
        content_html: string | null;
        parent_post_id: string | null;
        /** Die Vorlagenfelder (0483) und die eigenen Werte (0485).
         *
         *  `null` in der Übersicht, gefüllt auf der Detailseite — dieselbe
         *  Regel wie bei `content_html`. Sie standen bis 28.08.2026 in KEINER
         *  öffentlichen Antwort: im CMS gepflegt, auf der Website unsichtbar. */
        felder: BeitragsFelder | null;
      };
      /** Blogname und RSS-Angaben des Betriebs (0457). */
      blog: BlogAngaben;
      /** Der ältere und der neuere Beitrag (0457).
       *
       *  Der neuere ist serverseitig auf „schon erschienen" begrenzt — sonst
       *  wäre diese Navigation das Leck, durch das ein geplanter Beitrag mit
       *  Titel und Adresse sichtbar wird. */
      vorheriger: { slug: string; title: string } | null;
      naechster: { slug: string; title: string } | null;
      /** Die EIGENEN Felder des Betriebs (0485) — Schlüssel und Name. Ohne
       *  sie stünde auf der Seite der technische Schlüssel über dem Wert. */
      eigene_felder: { feld_key: string; label: string }[];
    })
  | null
> {
  const qs = new URLSearchParams({ host });
  // Die Sprachfassung des Beitrags (0476): Titel, Meta-Angaben und Anrisstext.
  // `excerpt` kommt überhaupt nur bei Beiträgen vor — ohne diesen Parameter
  // wäre es übersetzt worden und nie ausgeliefert.
  if (sprache) qs.set("sprache", sprache);
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

/** Wie `ladeSeite`, aber mit dem Unterschied zwischen „fehlt" und „gesperrt".
 *
 *  Ebenfalls in `cache()` gewickelt: `generateMetadata` und die Komponente
 *  fragen dieselbe Seite, und ein zweiter Abruf je Seitenansicht wäre eine
 *  zusätzliche Anfrage für nichts. */
export const ladeSeitenErgebnis = cache(ladeSeiteErgebnisRoh);

/** Die eigene 404-Seite eines Hosts (0433), oder `null`.
 *
 *  `null` heißt: dieser Betrieb hat keine angelegt — der Normalfall. Der
 *  Aufrufer zeigt dann die eingebaute Fehlerseite.
 *
 *  In `cache()` gewickelt wie `ladeSeite`: `not-found.tsx` und
 *  `generateMetadata` können beide danach fragen. */
/** Das Master-Layout der Objektseite (0468), oder `null`.
 *
 *  `null` heißt: dieser Betrieb hat noch keine Bausteine darauf gelegt — dann
 *  zeigt die Objektseite ihr eingebautes Layout. Das ist der Normalfall für
 *  jeden bestehenden Betrieb und darf deshalb nichts kaputt machen: eine leere
 *  Objektseite wäre der Schaden, den diese Vorlage gerade verhindern soll.
 *
 *  In `cache()` gewickelt wie `ladeSeite`: `generateMetadata` und die Komponente
 *  fragen dieselbe Vorlage. */
export const ladeObjektVorlage = cache(async function ladeObjektVorlageRoh(
  host: string,
): Promise<SitePage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base()}/api/v1/site/page/objekt-vorlage?host=${encodeURIComponent(host)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const daten = (await res.json()) as SitePage | null;
    return daten && Array.isArray(daten.blocks) && daten.blocks.length > 0
      ? daten
      : null;
  } catch {
    // Ein Fehlschlag darf die Objektseite NICHT kippen. Sie hat ein
    // eingebautes Layout; das ist die richtige Antwort, wenn die Vorlage
    // gerade nicht erreichbar ist.
    return null;
  } finally {
    clearTimeout(timer);
  }
});

/** Die Bausteine einer SYSTEMSEITE (0474), oder `null`.
 *
 *  `key` ist ihre Kennung: `checkout`, `checkout_abgeschlossen`, `blog`.
 *
 *  `null` heißt: dieser Betrieb hat noch keine Bausteine darauf gelegt — dann
 *  zeigt die Route ihr eingebautes Layout. Das ist der Normalfall für jeden
 *  bestehenden Betrieb und darf nichts kaputt machen: eine leere Buchungsseite
 *  wäre der Schaden, den diese Vorlage gerade verhindern soll.
 *
 *  Ein Fehlschlag kippt die Seite NICHT. Sie hat ein eingebautes Layout, und das
 *  ist die richtige Antwort, wenn die Vorlage gerade nicht erreichbar ist —
 *  anders als bei einer normalen Seite gibt es hier immer etwas zu zeigen. */
export const ladeSystemseitenVorlage = cache(
  async function ladeSystemseitenVorlageRoh(
    host: string,
    key: string,
  ): Promise<SitePage | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(
        `${base()}/api/v1/site/page/system-vorlage?host=${encodeURIComponent(host)}` +
          `&key=${encodeURIComponent(key)}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        },
      );
      if (!res.ok) return null;
      const daten = (await res.json()) as SitePage | null;
      return daten && Array.isArray(daten.blocks) && daten.blocks.length > 0
        ? daten
        : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  },
);

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

/** Vorschau einer VORLAGE, bevor sie angewendet wird (Reiter „Vorlagen").
 *
 *  Derselbe Weg wie `ladeSeitenEntwurf` und bewusst kein zweiter: der Renderer
 *  hat kein Nutzer-JWT, also hängt der Zugriff an einem kurzlebigen HMAC-Token,
 *  das das Dashboard vorher holt. Ohne gültigen Token gibt es keine Vorschau —
 *  die Vorlagen sind zwar keine Kundendaten, aber der Token trägt die
 *  tenant_id, mit der Farben und Logo des Betriebs eingesetzt werden. */
/** Eine Seite einer STRECKEN-Vorlage (0474), oder `null`.
 *
 *  `seite` ist der Abschnitt der Strecke (`objekt`, `checkout`,
 *  `bestaetigung`), kein Slug: eine Strecke hat keine eigenen Adressen — sie
 *  setzt die Bausteine bestehender Seiten.
 *
 *  Wie bei der Vorlagen-Vorschau hängt der Zugriff an einem kurzlebigen
 *  HMAC-Token, weil der Renderer als eigener Dienst ohne Nutzer-JWT läuft. */
export async function ladeStreckenEntwurf(
  strecke: string,
  seite: string,
  token: string,
): Promise<SitePage | null> {
  const qs = new URLSearchParams({ strecke, seite, token });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base()}/api/v1/site/strecke/draft?${qs.toString()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as SitePage;
  } finally {
    clearTimeout(timer);
  }
}

export async function ladeVorlagenEntwurf(
  templateId: string,
  token: string,
  slug: string,
): Promise<SitePage | null> {
  const qs = new URLSearchParams({ template_id: templateId, token, slug });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base()}/api/v1/site/template/draft?${qs.toString()}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as SitePage;
  } finally {
    clearTimeout(timer);
  }
}
