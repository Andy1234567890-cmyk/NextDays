"use server";

// Page-Builder: Server-Actions gegen den FastAPI-site_config-Slice
// (/api/v1/site-config/pages|blocks|templates). Seiten + Blöcke der white-label
// Agentur-Website. 1:1 zu den Backend-Aktionen benannt (MCP-ready).
import { revalidatePath } from "next/cache";

// NUR als Typ importiert (`import type`): diese Datei trägt `"use server"`
// und darf ausschließlich async functions EXPORTIEREN. Ein Typ-Import wird
// beim Übersetzen entfernt und ist deshalb erlaubt — ein Re-Export von
// `FeldKonfig` wäre es NICHT und bräche erst in „Collecting page data" mit
// `A "use server" file can only export async functions`.
import type { FeldKonfig } from "@/components/website/blog/felder";
import type { EigeneFeldArt } from "@/lib/blog-feldarten";
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
  | "posts"
  // --- Objektseite / Buchungsstrecke (0468) --------------------------------
  | "property_book_form"
  | "property_gallery"
  | "property_description"
  | "property_amenities"
  | "property_map"
  // 0472 — der Container-Typ (Abschnitt, Spalte, innere Spalte).
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
  // Bestätigung fest programmierte Routen ohne Blöcke.
  | "checkout_form"
  | "checkout_summary"
  | "checkout_result"
  | "post_list";


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
  /** Kennung einer SYSTEMSEITE (0466) — die Buchungsstrecke: `inserat`,
   *  `checkout`, `checkout_abgeschlossen`, `blog`. `null` bei jeder anderen
   *  Seite.
   *
   *  Der angezeigte Name entsteht aus dieser Kennung über den
   *  Übersetzungskatalog. In der DB steht KEIN Titel: er stünde dort in einer
   *  Sprache, und die Seitenliste bedient 24. */
  system_key: string | null;
  /** Quelle einer DYNAMISCHEN Seite (0468) — heute nur `property`. Aus ihr
   *  entsteht eine Adresse je Objekt. `null` bei jeder anderen Seite. */
  dynamic_source: string | null;
  // --- Seitentypen (0433) --------------------------------------------------
  page_type: PageType;
  /** Ziel eines externen Menüpunkts. Nur bei `page_type = "external"`. */
  external_url: string | null;
  /** Übergeordneter Ordner, oder null. Genau eine Ebene tief. */
  parent_id: string | null;
  // --- Zugang und Einzelveröffentlichung (0442) ----------------------------
  /** true = diese Seite verlangt ein Passwort. NUR der Schalter, nie der Hash:
   *  ein Hash, der einmal in einer API-Antwort stand, steht danach in
   *  Browser-Verlauf und Fehlerprotokollen. */
  hat_passwort: boolean;
  /** Wann die Seite zuletzt EINZELN veröffentlicht wurde, oder null. */
  last_single_publish_at: string | null;
  /** true = beim Veröffentlichen der Website überspringen (0443). Nicht
   *  dasselbe wie `!is_published` — das heißt nur „steht gerade nicht live". */
  is_draft: boolean;
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
  // --- Blog-CMS (0480) ------------------------------------------------------
  /** Handsortierung der Beitragsliste (Ziehgriff an der Zeile). */
  post_sort: number | null;
  /** Dieser Beitrag ist ein KAPITEL des verwiesenen Beitrags. */
  parent_post_id: string | null;
  /** Aufrufe der öffentlichen Beitragsseite. */
  view_count: number;
  /** Die ZWEITE Sichtbarkeitsachse (0481): erscheint der Beitrag in der
   *  Beitragsübersicht?
   *
   *  Getrennt von `is_published`/`is_draft`, weil „fertig" und „wo sichtbar"
   *  zwei Fragen sind (Framer-Analyse Abschnitt G) — dasselbe Muster wie
   *  `status='active'` + `listed_on_marketplace` beim Objekt. Ein Beitrag, den
   *  der Betrieb hier abschaltet, verschwindet aus der Übersicht, bleibt aber
   *  unter seiner Adresse erreichbar: geteilte Links dürfen nicht tot gehen. */
  show_on_homepage: boolean;
  /** Der Autor als Konto des Betriebs; fehlt er, gilt `author` als Freitext. */
  author_user_id: string | null;
  is_archived: boolean;
  /** Alternativtext zum Vorschaubild (0457). Er beschreibt das BILD und nicht
   *  die Seite — deshalb ein eigenes Feld neben `seo_description`. */
  og_image_alt: string | null;
  /** Die Werte der EIGENEN Beitragsfelder (0485). Schlüssel = `feld_key` aus
   *  `EigenesFeld`. `{}` heißt „nichts gesetzt" — nie `null`. */
  custom: Record<string, unknown>;
  /** Der Beitragstext. Die Seitenliste liefert ihn seit 0480 mit (`_PAGE_COLS`
   *  führt `content_html`); im Typ stand er nie, weshalb die Tabelle ihn über
   *  einen `Record<string, unknown>`-Umweg lesen musste. Ein geliefertes Feld,
   *  das der Typ nicht kennt, ist für jeden Aufrufer unsichtbar. */
  content_html: string | null;
  /** Wann die Zeile ANGELEGT wurde — unsere Uhr.
   *
   *  Das Blog-CMS zeigt sie als „Erstellt: …" neben dem Erscheinungsdatum. Sie
   *  ist ausdrücklich NICHT dessen Ersatz, wenn dort nichts steht: „erschienen"
   *  ist eine Aussage über die Website, „angelegt" eine über unsere Datenbank
   *  (Wurzel 5b). */
  created_at: string | null;
  /** Wann die Zeile zuletzt GEÄNDERT wurde — auch das unsere Uhr (Trigger
   *  `set_updated_at`, 0087). Die Beitragstabelle zeigt sie als eigene Spalte
   *  neben „Erstellt": das Vorbild führt beide (`Created`/`Edited`), und sie
   *  beantworten verschiedene Fragen. Keine von beiden ersetzt das
   *  Erscheinungsdatum (Wurzel 5b). */
  updated_at: string | null;
};

/** Die Beitragsfelder EINER Seite (0457).
 *
 *  Eigener Endpunkt neben `updatePage`, und der Grund ist der CHECK aus 0438:
 *  diese Felder gelten NUR für `page_type = "post"`. An `updatePage` gehängt
 *  wären sie an jeder Seite sichtbar und würden dort mit einem
 *  Datenbankfehler enden statt mit einer Antwort, die den Grund nennt. */
export type Beitrag = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  published_at: string | null;
  author: string | null;
  cover_image_url: string | null;
  excerpt: string | null;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  og_image_alt: string | null;
  noindex: boolean | null;
  // --- Blog-CMS (0480) ------------------------------------------------------
  /** Der Beitragstext als gesäubertes HTML. */
  content_html: string | null;
  /** Das Buch, dessen Kapitel dieser Beitrag ist. */
  parent_post_id: string | null;
  /** Der Autor als Konto des Betriebs. */
  author_user_id: string | null;
  is_archived: boolean | null;
  /** Aufrufe — nur lesbar. */
  view_count: number;
  /** Die zweite Sichtbarkeitsachse (0481) — siehe `Page.show_on_homepage`. */
  show_on_homepage: boolean;
  // --- Beitragsfelder aus der Framer-Feldliste (0483) ----------------------
  //
  // Zwei Arten Bildfeld: `gallery_top`/`gallery_bottom` tragen MEHRERE
  // Bilder, `gallery_left`/`gallery_right` je EINES — so wie im Vorbild
  // (Analyse C, Feld 14/15). In der DB heissen sie mit `post_`-Praefix, nach
  // aussen ohne; die Uebersetzung macht der Server an einer Stelle.
  industry: string | null;
  client: string | null;
  /** Der volle Titel neben dem kurzen Listentitel — ZWEI Felder, nicht ein
   *  gekuerztes (Analyse G). */
  full_title: string | null;
  intro_heading: string | null;
  intro_body: string | null;
  button_text: string | null;
  website_link: string | null;
  gallery_top: string[] | null;
  gallery_left: string | null;
  gallery_right: string | null;
  gallery_bottom: string[] | null;
  final_heading: string | null;
  final_body: string | null;
  show_carousel: boolean;
  carousel_1: string | null;
  carousel_2: string | null;
  carousel_3: string | null;
  carousel_4: string | null;
  // --- EIGENE Felder (0485) ------------------------------------------------
  /** Die Werte der eigenen Felder, Schlüssel = `EigenesFeld.feld_key`.
   *
   *  Beim SCHREIBEN ist es ein Teil-Objekt: gesendete Schlüssel werden
   *  gesetzt, nicht gesendete bleiben, ein ausdrückliches `null` leert das
   *  Feld. Ein volles Objekt zu senden löschte jedes Feld, das das sendende
   *  Formular nicht kennt. */
  custom: Record<string, unknown>;
};

/** Blogname, Nächster/Vorheriger-Navigation und die RSS-Angaben (0457). */
export type BlogEinstellungen = {
  blog_name: string | null;
  blog_prev_next: boolean;
  rss_title: string | null;
  rss_description: string | null;
  rss_image_url: string | null;
};

export type Block = {
  // --- Baum (0472) ---------------------------------------------------------
  /** Was diese Zeile IST: Abschnitt, Spalte, innere Spalte oder Baustein. */
  kind?: "section" | "column" | "inner_column" | "widget";
  /** Der Elternteil. `null` = ein Abschnitt, direkt an der Seite. */
  parent_id?: string | null;
  /** Breitenanteil einer Spalte in Zwölfteln. */
  span?: number | null;
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
  opts: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  } = {},
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

/** Eine Seite als Entwurf halten — oder wieder freigeben (0443). */
export async function setPageDraft(
  pageId: string,
  entwurf: boolean,
): Promise<Result<Page>> {
  const res = await call<Page>(`/site-config/pages/${pageId}/draft`, {
    method: "POST",
    body: { entwurf },
  });
  if (res.ok) touch();
  return res;
}

/** Seitenpasswort setzen — oder mit `null` wieder entfernen (0442).
 *
 *  Eine Aktion für beides, weil „offen für alle" nur die andere Stellung
 *  desselben Schalters ist. Das Passwort geht im Klartext an die API und wird
 *  dort gehasht; es kommt NIE zurück. */
export async function setPageAccess(
  pageId: string,
  passwort: string | null,
): Promise<Result<null>> {
  const res = await call<null>(`/site-config/pages/${pageId}/access`, {
    method: "POST",
    body: { passwort },
  });
  if (res.ok) touch();
  return res;
}

/** Diese eine Seite veröffentlichen (0442). */
export async function publishPageSingle(pageId: string): Promise<Result<Page>> {
  const res = await call<Page>(`/site-config/pages/${pageId}/publish-single`, {
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
/** Die Bausteine einer Seite.
 *
 *  `mitContainern` liefert zusätzlich die Struktur-Zeilen (Abschnitt, Spalte,
 *  innere Spalte). Die Ebenen-Ansicht braucht sie, um überhaupt einen Baum
 *  bilden zu können: ohne die Container findet sie zu keinem Baustein den
 *  Elternteil, jeder wird zur Wurzel, und die Liste bleibt flach. Die
 *  Abschnittsliste kommt weiter ohne — für Container hat sie kein Formular. */
export async function listBlocks(
  pageId: string,
  mitContainern = false,
): Promise<Result<{ items: Block[]; total: number }>> {
  const abfrage = mitContainern ? "?mit_containern=true" : "";
  return call(`/site-config/pages/${pageId}/blocks${abfrage}`);
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

/**
 * Einen CONTAINER anlegen — Abschnitt, Spalte oder innere Spalte (0472).
 *
 * Eigene Funktion und nicht ein viertes Argument an `addBlock`: ein Container
 * ist das Gegenteil eines Bausteins. Er trägt keinen Inhalt (sein Aussehen
 * steht in `kind`/`span`), und die drei Felder gehören zusammen — `span` ohne
 * `kind: "column"` ist wirkungslos, `kind: "column"` ohne `parentId` ist ein
 * 422.
 *
 * `span` in ZWÖLFTELN, wie der Renderer es liest (`flexBasis: span/12*100%`):
 * 6 = halbe Breite, 4 = ein Drittel, 3 = ein Viertel. Ohne Angabe teilen sich
 * die Geschwister die Breite gleichmäßig.
 *
 * Bis 27.08.2026 gab es diesen Weg NICHT. Datenmodell (0472) und Renderer
 * konnten Spalten, der Baukasten nicht — jeder Baustein landete in seiner
 * eigenen einspaltigen Reihe.
 */
export async function addContainer(
  pageId: string,
  kind: "section" | "column" | "inner_column",
  opts: {
    parentId?: string | null;
    span?: number | null;
    /** Rang unter den Geschwistern. Ohne Angabe ans Ende.
     *
     *  Nötig, weil das „+" im Editor eine STELLE bezeichnet: wer oben klickt,
     *  will den Abschnitt oben. Der Server schiebt die Geschwister dahinter
     *  mit (Wurzel 1). */
    position?: number | null;
  } = {},
): Promise<Result<Block>> {
  return call(`/site-config/pages/${pageId}/blocks`, {
    method: "POST",
    body: {
      type: "container",
      kind,
      parent_id: opts.parentId ?? null,
      span: opts.span ?? null,
      position: opts.position ?? null,
      content: {},
      settings: {},
    },
  });
}

export async function updateBlock(
  blockId: string,
  input: {
    content?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    /** Breitenanteil einer SPALTE in Zwölfteln (1–12). An einem Abschnitt oder
     *  Baustein antwortet der Server mit 422 — er hat dort keine Wirkung, und
     *  ein stilles Verwerfen wäre ein „gespeichert" ohne Änderung. */
    span?: number;
  },
): Promise<Result<Block>> {
  return call(`/site-config/blocks/${blockId}`, {
    method: "PUT",
    body: input,
  });
}

/** Einen Abschnitt oder eine Spalte an einen anderen Rang setzen (0479).
 *
 *  Nur die ZAHL geht hinaus; die Ordnung der Geschwister pflegt der Server.
 *  Für BAUSTEINE ist das der falsche Weg — ihre Reihenfolge steht in der
 *  Abschnittsliste des Editors (`speichereAbschnitte`), und zwei Wege auf
 *  dieselbe Ordnung wären ein Widerspruch, den niemand auflöst. */
export async function moveContainer(
  blockId: string,
  position: number,
): Promise<Result<Block>> {
  return call(`/site-config/blocks/${blockId}/move`, {
    method: "POST",
    body: { position },
  });
}

/** Einen Abschnitt (oder eine Spalte) MIT ALLEM darin kopieren — die Kopie
 *  steht direkt dahinter. */
export async function duplicateContainer(
  blockId: string,
): Promise<Result<Block>> {
  return call(`/site-config/blocks/${blockId}/duplicate`, { method: "POST" });
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
  /** In WELCHE Spalte dieser Baustein gehört (0472).
   *
   *  `null`/fehlend = der Server legt ihm eine eigene Hülle an (Abschnitt mit
   *  einer Spalte) — der Normalfall für einen Baustein, der untereinander
   *  steht.
   *
   *  Gesetzt heißt: der Kunde hat ihn in eine bestehende Spalte gezogen. Ohne
   *  dieses Feld war das unmöglich, und damit war das Spaltenlayout
   *  unbenutzbar — die Spalten ließen sich anlegen, aber nicht füllen. */
  parent_id?: string | null;
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
/** Die fünf Arten des Media Managers (0479). Deckungsgleich mit
 *  `site_media.kind` und dem Pydantic-Enum `MediumArt` — die drei Listen
 *  beschreiben denselben Bestand, und eine vierte Fassung wäre die, die
 *  auseinanderläuft. */
export type MediumArt = "image" | "icon" | "video" | "audio" | "file";

/** Ein Medium im Bestand des Betriebs — Bild, Symbol, Video, Audio, Dokument. */
export type Medium = {
  id: string;
  url: string;
  filename: string | null;
  mime: string;
  /** `null` bei Stock-Bildern: sie liegen als Hotlink beim Anbieter, es gibt
   *  also keine Datei, deren Größe wir kennen. Kein geschätzter Wert. */
  bytes: number | null;
  created_at: string | null;
  // --- Ordner, Alt-Text, Maße (0460) ---------------------------------------
  /** `null` = liegt in keinem Ordner (Wurzel der Mediathek). */
  folder_id: string | null;
  /** Alternativtext. Am BILD und nicht am Block, damit er nicht je
   *  Verwendungsstelle gepflegt werden muss. */
  alt_text: string | null;
  /** Aus den Kopfbytes gelesen. `null`, wenn sie dort nicht standen — nie
   *  geraten (Wurzel 4). */
  width: number | null;
  height: number | null;
  // --- Medienart (0479) ----------------------------------------------------
  /** Die Art. Kommt aus der Signaturprüfung des Uploads, NIE vom Client — der
   *  Reiter der Mediathek IST dieser Filter. */
  kind: MediumArt;
  // --- Herkunft und Bildnachweis (0461/0479) -------------------------------
  /** `iconify` = Symbol als Hotlink (ein SVG in unserem öffentlichen Bucket
   *  wäre Stored-XSS). */
  source: "upload" | "unsplash" | "pexels" | "iconify";
  /** Fotograf. Bei Unsplash Pflichtangabe an JEDER Anzeigestelle. */
  credit_name: string | null;
  /** Profil-Adresse des Fotografen, inkl. utm-Parametern. */
  credit_url: string | null;
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
  /** In welchen Ordner. `null` = Wurzel. Der Server prüft ihn VOR dem Upload,
   *  damit keine Datei im Bucket landet, deren DB-Zeile danach scheitert. */
  folderId: string | null = null,
): Promise<Result<Medium>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  const body = new FormData();
  body.append("file", datei);
  if (folderId) body.append("folder_id", folderId);
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

/** Das Bild zu einer URL finden — für den KI-Alt-Text-Knopf im Bild-Baustein
 *  (0463–0465).
 *
 *  Der Baustein speichert nur die URL (`content.image_url`), keine
 *  Medien-ID — Alt-Text gehört aber dem BILD, nicht der Verwendungsstelle
 *  (0460). Ohne Rückweg von URL zu Bild gäbe es keine ID, die man an
 *  `kiAltText` schicken könnte. Ein eigener Backend-Suchpfad wäre dafür eine
 *  neue Route für einen einzigen Konsumenten; der bestehende Listen-Endpunkt
 *  reicht — Mediatheken sind keine Zehntausend-Bilder-Bestände.
 *
 *  `null`, wenn kein Treffer da ist (externe Adresse, Stockfoto-Hotlink, oder
 *  ein Bild jenseits der ersten 300). Der Aufrufer blendet den Knopf dann
 *  einfach aus — kein erfundener Ersatzwert (Wurzel 4). */
export async function findMediumByUrl(url: string): Promise<Medium | null> {
  if (!url) return null;
  const res = await listMedia(300);
  if (!res.ok) return null;
  return res.data.items.find((m) => m.url === url) ?? null;
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

/** Eine Seite, die eine Vorlage mitbringt — für die Aufzählung in der Galerie
 *  und für die Seitenwahl in der Vorschau. */
export type TemplatePage = {
  slug: string;
  title: string;
  nav_area: NavArea;
  block_count: number;
};

export type TemplateSummary = {
  id: string;
  kategorie: string;
  /** Locale → Name. Mehrsprachig, weil die Vorlagen-Inhalte es auch sind. */
  name: Record<string, string>;
  description: Record<string, string>;
  preview_image: string | null;
  primary_color: string | null;
  pages: TemplatePage[];
};

export type SeitenVorlage = {
  id: string;
  title: Record<string, string>;
  slug: string;
  block_count: number;
  block_types: string[];
};

/** Die Vorlagen-Galerie. Kommt vom SERVER — die Oberfläche zählt die IDs nicht
 *  selbst auf (sonst laufen zwei Listen auseinander und jeder Klick endet im
 *  404 „Unbekanntes Template", sichtbar nur als Toast). */
export async function listTemplates(): Promise<
  Result<{ templates: TemplateSummary[]; kategorien: string[] }>
> {
  return call("/site-config/templates");
}

/** Vorlagen für EINZELNE Seiten — dieselbe Liste, die beim Anlegen erscheint. */
export async function listSeitenVorlagen(): Promise<
  Result<{ vorlagen: SeitenVorlage[] }>
> {
  return call("/site-config/seiten-vorlagen");
}

/** Kurzlebiger Token, mit dem der Renderer eine Vorlage zeigt, BEVOR sie
 *  angewendet wird. */
export async function createTemplatePreviewToken(
  templateId: string,
): Promise<Result<{ token: string }>> {
  return call(`/site-config/templates/${templateId}/preview-token`, {
    method: "POST",
  });
}

// --- Buchungsstrecke: die drei Formen (0474) ---------------------------------
// Eine Wahl setzt Objektseite, Buchung und Bestätigung GEMEINSAM. Sie gehören
// zusammen, weil der Gast sie hintereinander durchläuft: eine moderne
// Objektseite vor einem schmalen Behörden-Checkout wirkt wie zwei verschiedene
// Websites, und genau dieser Bruch ist es, an dem er abbricht.
//
// Der Blog gehört NICHT dazu — er ist ein eigener Bereich mit eigenem CMS
// (`/website/blog`).

/** Eine Vorlage der Buchungsstrecke. KEIN Anzeigename: der steht im
 *  Übersetzungskatalog (`website.strecke.*`), damit die Auswahl in allen 24
 *  Sprachen dasteht. */
export type Strecke = {
  key: string;
  objekt_bloecke: number;
  checkout_bloecke: number;
  bestaetigung_bloecke: number;
};

export async function listStrecken(): Promise<Result<{ strecken: Strecke[] }>> {
  return call("/site-config/strecken");
}

/** Token und Beispielobjekt für die Live-Vorschau einer Strecke.
 *
 *  `beispiel_objekt_id` ist `null`, wenn der Betrieb kein aktives Objekt hat.
 *  Das ist eine Aussage und kein Fehler: die Buchungsseite lässt sich auch dann
 *  ansehen, die Objektseite nicht. */
export async function createStreckePreviewToken(
  strecke: string,
): Promise<Result<{ token: string; beispiel_objekt_id: string | null }>> {
  return call(`/site-config/strecken/${strecke}/preview-token`, {
    method: "POST",
  });
}

/** Eine Strecken-Vorlage anwenden. ERSETZT die Bausteine der drei Seiten. */
export async function applyStrecke(
  strecke: string,
): Promise<Result<{ items: Page[]; total: number }>> {
  const res = await call<{ items: Page[]; total: number }>(
    "/site-config/strecken/apply",
    { method: "POST", body: { strecke } },
  );
  if (res.ok) revalidatePath("/website/seiten");
  return res;
}

// --- Blog (0457) -------------------------------------------------------------
// Eigene Aktionen neben `updatePage`, weil die Beitragsfelder nur an einem
// Beitrag existieren (CHECK aus 0438). Der Server antwortet mit 422, wenn die
// Seite keiner ist — das ist die Meldung, die der Kunde lesen kann.

/** Die Handsortierung der Beitragsliste setzen — Index = neue Reihenfolge.
 *
 *  Der Server schreibt sie in EINER Anweisung (`set_post_order`, 0480). */
export async function reorderPosts(ids: string[]): Promise<Result<null>> {
  const res = await call<null>("/site-config/posts/reorder", {
    method: "PUT",
    body: { ids },
  });
  if (res.ok) touch();
  return res;
}

/** Die Beitragsfelder einer Seite lesen. */
export async function getPost(pageId: string): Promise<Result<Beitrag>> {
  return call(`/site-config/pages/${pageId}/post`);
}

/** Beitragsfelder setzen — auch das Erscheinungsdatum.
 *
 *  Ein Datum in der ZUKUNFT ist die Planung: der Beitrag verschwindet damit aus
 *  Liste, Adresse, Feed und Sitemap und kommt von selbst wieder, wenn er dran
 *  ist. Ein Datum in der VERGANGENHEIT verschiebt ihn in der Reihenfolge.
 *
 *  Nur die MITGESCHICKTEN Felder ändern sich: der Server wertet `exclude_unset`
 *  aus. Deshalb darf diese Funktion kein vollständiges Objekt bauen — sonst
 *  löschte das Speichern des SEO-Reiters den Autor. */
export async function updatePost(
  pageId: string,
  input: Partial<Omit<Beitrag, "id" | "slug" | "title" | "is_published">>,
): Promise<Result<Beitrag>> {
  const res = await call<Beitrag>(`/site-config/pages/${pageId}/post`, {
    method: "PUT",
    body: input,
  });
  if (res.ok) touch();
  return res;
}

/** Die Blog-Einstellungen des Betriebs. */
export async function getBlogSettings(): Promise<Result<BlogEinstellungen>> {
  return call("/site-config/blog");
}

export async function setBlogSettings(
  input: BlogEinstellungen,
): Promise<Result<BlogEinstellungen>> {
  const res = await call<BlogEinstellungen>("/site-config/blog", {
    method: "PUT",
    body: input,
  });
  if (res.ok) touch();
  return res;
}

/** Vorschläge für das Autorenfeld — NUR Namen.
 *
 *  Eine Bequemlichkeit über dem Freitextfeld, kein Ersatz dafür: der Autor
 *  eines Beitrags ist oft keiner unserer Benutzer („Familie Jensen"), und ein
 *  gelöschter Benutzer würde den Beitrag sonst anonymisieren (0438). */
export async function listBlogAuthors(): Promise<Result<{ items: string[] }>> {
  return call("/site-config/blog/autoren");
}

// --- EIGENE Beitragsfelder (0485) ------------------------------------------
//
// Framers Reiter „Fields": über einem Trenner die Systemfelder, darunter die
// frei anlegbaren. Das ist etwas anderes als die Feldkonfiguration darunter —
// die sagt, wie ein EINGEBAUTES Feld heißt und sich verhält, diese hier sagt,
// welche Felder es überhaupt gibt.

// Die Feldarten (`EIGENE_FELD_ARTEN`, `EigeneFeldArt`) stehen in
// `./blog-feldarten` und NICHT hier — und sie werden auch NICHT von hier
// re-exportiert. Beides aus demselben Grund wie beim Typ-Import oben: ein
// `export const` bricht zur Laufzeit mit „A 'use server' file can only export
// async functions", und ein Re-Export ist die Sorte Zeile, bei der niemand
// mehr sieht, ob sie erlaubt ist. Wer die Arten braucht, importiert sie
// direkt aus `@/lib/blog-feldarten`.

export type EigenesFeld = {
  id: string;
  /** Der Schlüssel in `Page.custom`. Nach dem Anlegen unveränderlich — er
   *  steht in jeder Beitragszeile. */
  feld_key: string;
  label: string;
  art: EigeneFeldArt;
  position: number;
  beschreibung: string | null;
  platzhalter: string | null;
  max_zeichen: number | null;
  pflicht: boolean;
  mehrzeilig: boolean;
  versteckt: boolean;
  /** Fester Vorgabewert (0486). */
  standard_wert: string | null;
  /** Vorgabe abgeleitet aus einem anderen Feld (Framers „Based on"). */
  standard_feld: string | null;
};

export async function listCustomPostFields(): Promise<
  Result<{ felder: EigenesFeld[] }>
> {
  return call("/site-config/blog/eigene-felder");
}

export async function createCustomPostField(input: {
  feld_key: string;
  label: string;
  art: EigeneFeldArt;
}): Promise<Result<EigenesFeld>> {
  const res = await call<EigenesFeld>("/site-config/blog/eigene-felder", {
    method: "POST",
    body: input,
  });
  if (res.ok) touch();
  return res;
}

/** Ein eigenes Feld ändern. Schlüssel und Art sind NICHT dabei — beide würden
 *  die Werte in allen Beiträgen unlesbar machen (siehe `EigenesFeldPatch` im
 *  Backend). */
export async function updateCustomPostField(
  feldId: string,
  input: Partial<Omit<EigenesFeld, "id" | "feld_key" | "art">>,
): Promise<Result<EigenesFeld>> {
  const res = await call<EigenesFeld>(
    `/site-config/blog/eigene-felder/${encodeURIComponent(feldId)}`,
    { method: "PUT", body: input },
  );
  if (res.ok) touch();
  return res;
}

/** Ein eigenes Feld löschen — samt seiner Werte in allen Beiträgen.
 *
 *  Die Antwort sagt, wie viele Beiträge dabei angefasst wurden. Sie gehört in
 *  die Meldung: „Feld gelöscht" allein verschweigt, dass dabei Werte
 *  verschwunden sind. */
export async function deleteCustomPostField(
  feldId: string,
): Promise<Result<{ beitraege: number }>> {
  const res = await call<{ beitraege: number }>(
    `/site-config/blog/eigene-felder/${encodeURIComponent(feldId)}`,
    { method: "DELETE" },
  );
  if (res.ok) touch();
  return res;
}

// --- Feldkonfiguration der Beitragsfelder (0481) ---------------------------
//
// Framer-Analyse C1: jedes Feld trägt Name, Beschreibung, Pflicht,
// ein-/mehrzeilig, Platzhalter und Maximallänge. Der Server liefert
// AUSSCHLIESSLICH gespeicherte Abweichungen — die Vorgabe eines Feldes ohne
// Eintrag steht im Katalog `components/website/blog/felder.ts`. Ein zweiter
// Satz Vorgabewerte auf der Serverseite wären zwei Wahrheiten (Wurzel 2/4).

/** Die gespeicherten Feld-Abweichungen dieses Betriebs. */
export async function getPostFieldConfig(): Promise<
  Result<{ felder: FeldKonfig[] }>
> {
  return call("/site-config/blog/felder");
}

/** Ein Beitragsfeld konfigurieren.
 *
 *  Der Schlüssel steht im PFAD — er ist die Adresse dieser Ressource. */
export async function setPostFieldConfig(
  feldKey: string,
  input: Omit<FeldKonfig, "feld_key">,
): Promise<Result<FeldKonfig>> {
  const res = await call<FeldKonfig>(
    `/site-config/blog/felder/${encodeURIComponent(feldKey)}`,
    { method: "PUT", body: { ...input, feld_key: feldKey } },
  );
  if (res.ok) touch();
  return res;
}

/** Ein Feld auf die eingebaute Vorgabe zurücksetzen.
 *
 *  Die Zeile wird GELÖSCHT und nicht auf lauter Nullwerte gesetzt: eine Zeile
 *  voller Nullwerte wäre von einer bewussten Einstellung nicht zu
 *  unterscheiden, und der Katalog soll wieder greifen. */
export async function resetPostFieldConfig(
  feldKey: string,
): Promise<Result<null>> {
  const res = await call<null>(
    `/site-config/blog/felder/${encodeURIComponent(feldKey)}`,
    { method: "DELETE" },
  );
  if (res.ok) touch();
  return res;
}

/** Beiträge aus einem fremden RSS-/Atom-Feed übernehmen.
 *
 *  Sie landen als ENTWURF: importierte Texte sind fremde Texte und gehen erst
 *  live, wenn der Betrieb sie gesehen hat. Derselbe Feed zweimal importiert
 *  legt nichts doppelt an — erkannt wird ein Beitrag an seinem Slug. */
export async function importBlogFeed(
  url: string,
  limit?: number,
): Promise<
  Result<{
    angelegt: number;
    uebersprungen: number;
    feed_eintraege: number;
    titel: string[];
    hinweise: string[];
  }>
> {
  const res = await call<{
    angelegt: number;
    uebersprungen: number;
    feed_eintraege: number;
    titel: string[];
    hinweise: string[];
  }>("/site-config/blog/import", {
    method: "POST",
    body: limit ? { url, limit } : { url },
  });
  if (res.ok) touch();
  return res;
}
