// Gemeinsame Server-Daten aller Baukasten-Routen.
//
// Jede Route braucht dieselben drei Dinge (Branding, Seiten, Domains) — für die
// Reiterleiste, den Veröffentlichen-Knopf und die Vorschau. Statt das in fünf
// `page.tsx` zu kopieren, steht es einmal hier.
import { type Branding, getBranding, listDomains } from "@/lib/site-config";
import { listPages } from "@/lib/site-pages";

/** Leeres Branding, wenn noch nie etwas gespeichert wurde.
 *  Alles auf null: „nicht gesetzt" ist der wahre Zustand, und der Renderer
 *  entscheidet dann selbst. Kein erfundener Startwert (Wurzel 4). */
export const LEERES_BRANDING: Branding = {
  site_name: null,
  tagline: null,
  logo_url: null,
  hero_image_url: null,
  favicon_url: null,
  theme: null,
  primary_color: null,
  secondary_color: null,
  background_color: null,
  foreground_color: null,
  font_family: null,
  heading_font: null,
  button_font: null,
  button_style: null,
  button_radius: null,
  logo_scale: null,
  about_text: {},
  contact_text: {},
  social_links: {},
  booking_mode: "instant",
  brand_name_color: null,
  header_background: null,
  header_link_color: null,
  link_color: null,
  footer_background: null,
  logo_name_font: null,
  logo_name_size: null,
  slogan_font: null,
  logo_link_url: null,
  languages: null,
  default_language: null,
  // Die drei Booleans tragen HIER die Werte, die auch die Spalten-Defaults
  // haben (0426). Ein Schalter hat keinen dritten Zustand — anders als eine
  // Farbe, wo `null` „nie gewählt" heißt und der Renderer entscheidet.
  show_guest_breakdown: true,
  show_base_prices: true,
  head_html: null,
  head_css: null,
  custom_js: null,
  checkout_js: null,
  cookie_banner: false,
  cookie_policy_page_id: null,
  privacy_consent: false,
  privacy_policy_page_id: null,
  is_offline: false,
  // --- SEO/AEO (0430) -----------------------------------------------------
  seo_title: null,
  seo_description: null,
  seo_keywords: null,
  noindex: false,
  gtag_id: null,
  // Die vier Schema-Schalter stehen auf AN wie ihre Spalten-Defaults: der
  // Renderer baut das JSON-LD aus geprüften eigenen Feldern, das ist kein
  // Kundencode. Ein Standard „aus" hieße nur, dass fast niemand strukturierte
  // Daten ausliefert.
  schema_organization: true,
  schema_breadcrumbs: true,
  schema_lodging: true,
  schema_faq: true,
  lazy_loading: true,
  // true, weil der Renderer seine Schriften schon immer mit `display=swap`
  // lädt — der Schalter beschreibt den Ist-Zustand, er stellt ihn nicht um.
  system_fonts_first: true,
  // null = nie gewählt. Der Renderer nimmt dann die Werte, die er heute schon
  // verwendet — eine bestehende Seite sieht unverändert aus (Wurzel 1).
  content_width: null,
  heading_scale: null,
  body_scale: null,
  // --- Theme: Breite, Abstand, Designfarben, Text-Rollen (0446/0447) -------
  // `px` und `false` sind hier KEINE erfundenen Startwerte, sondern die
  // Spalten-Defaults aus 0447 — und beide beschreiben genau den Zustand, den
  // eine Website ohne Angabe schon immer hatte: die Zahl in `content_width`
  // war Pixel, und voll breit war nichts.
  content_width_unit: "px",
  content_full_width: false,
  section_spacing_y: null,
  section_spacing_x: null,
  theme_colors: [],
  theme_color_links: {},
  text_styles: {},
};

export type BaukastenDaten = Awaited<ReturnType<typeof ladeBaukasten>>;

export async function ladeBaukasten() {
  const [pagesRes, brandingRes, domainsRes] = await Promise.all([
    listPages(),
    getBranding(),
    listDomains(),
  ]);
  return {
    // 403 auf der Seitenliste heißt: dieser Rolle fehlt MANAGE_SITE_CONFIG.
    // Der Aufrufer entscheidet, was er damit anzeigt — hier wird nichts
    // stillschweigend zu einer leeren Liste (sonst sähe „kein Zugriff" aus wie
    // „noch keine Seiten angelegt").
    keinZugriff: !pagesRes.ok && pagesRes.status === 403,
    branding: brandingRes.ok ? brandingRes.data : LEERES_BRANDING,
    pages: pagesRes.ok ? pagesRes.data.items : [],
    domains: domainsRes.ok ? domainsRes.data.items : [],
  };
}
