// Site-Kontext der white-label Builder-App: liest den von der Middleware
// aufgelösten Tenant + dessen öffentliches Branding aus den Request-Headern.
//
// Quelle der Wahrheit ist der Backend-Resolver /api/v1/site/by-domain; die
// Middleware (middleware.ts) ruft ihn einmal pro Request und legt das Ergebnis
// als Header ab. Hier wird es nur typsicher ausgelesen — kein erfundener Wert.
// `unknown` = Host gehört zu keiner eingerichteten Agentur (neutraler Hinweis).
import { headers } from "next/headers";

/** Ein Menüpunkt. `slug` ist leer für die Startseite; den Pfad baut der Renderer
 *  selbst — es wandert keine fertige URL durch die API. */
export type NavItem = {
  slug: string;
  title: string;
};

/** Navigation der Kunden-Site, nach Bereich getrennt (0421). Seiten mit
 *  nav_area='none' erscheinen in keiner der beiden Listen. */
export type SiteNav = {
  header: NavItem[];
  footer: NavItem[];
};

const LEERE_NAV: SiteNav = { header: [], footer: [] };

/** Menü aus dem Branding. Die Navigation gilt site-weit und steckt deshalb im
 *  Branding-Objekt — die Middleware löst es einmal pro Request auf, damit jede
 *  Route dieselbe Quelle liest.
 *
 *  Leere Listen sind kein Ersatzwert, sondern die wahre Aussage „kein Menü":
 *  der Renderer lässt es dann weg statt Platzhalter zu erfinden (Wurzel 4). */
export function navOf(branding: SiteBranding | null | undefined): SiteNav {
  return {
    header: branding?.nav?.header ?? LEERE_NAV.header,
    footer: branding?.nav?.footer ?? LEERE_NAV.footer,
  };
}

/** Header-/Footer-Skelett der Kunden-Site (0421). Bestimmt NUR die Rahmen-
 *  Anordnung — Farben, Schriften und Button-Form sind davon unabhängig. */
export type SiteTheme = "klar" | "mitte" | "karte" | "seitlich";

export type ButtonStyle = "solid" | "outline";
export type ButtonRadius = "sharp" | "rounded" | "pill";

export type SiteBranding = {
  tenant_id: string;
  site_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  favicon_url: string | null;
  theme: SiteTheme | null;
  primary_color: string | null;
  secondary_color: string | null;
  background_color: string | null;
  foreground_color: string | null;
  /** Absatz-/Body-Schrift. */
  font_family: string | null;
  heading_font: string | null;
  button_font: string | null;
  button_style: ButtonStyle | null;
  button_radius: ButtonRadius | null;
  logo_scale: number | null;
  social_links: Record<string, string>;
  booking_mode: "instant" | "inquiry" | "both";
  // --- Farbrollen für Kopf-/Fußzeile, Links und Firmenname (0426) ----------
  // Vorher übernahmen Kopf- und Fußzeile den Seitenhintergrund. Damit war ein
  // dunkler Header auf hellem Grund unmöglich — der häufigste
  // Gestaltungswunsch überhaupt.
  brand_name_color: string | null;
  header_background: string | null;
  header_link_color: string | null;
  link_color: string | null;
  footer_background: string | null;
  // --- Typografie des Logo-Bereichs (0426) --------------------------------
  logo_name_font: string | null;
  logo_name_size: number | null;
  slogan_font: string | null;
  /** Ziel des Logo-Klicks. Fehlt es, führt das Logo auf die Startseite. */
  logo_link_url: string | null;
  // --- Sprachen der Website (0426) ---------------------------------------
  languages: string[] | null;
  default_language: string | null;
  // --- Anzeigeverhalten (0426) -------------------------------------------
  show_guest_breakdown: boolean;
  show_base_prices: boolean;
  // --- Code des Betriebs (0426) ------------------------------------------
  head_html: string | null;
  head_css: string | null;
  custom_js: string | null;
  checkout_js: string | null;
  // --- Cookie-Hinweis und Datenschutz-Zustimmung (0426) ------------------
  cookie_banner: boolean;
  privacy_consent: boolean;
  /** Slug der verlinkten Seite, nicht ihre ID — der Renderer baut den Pfad. */
  cookie_policy_slug: string | null;
  privacy_policy_slug: string | null;
  /** Menüstruktur der Site (0421). Gilt site-weit, deshalb im Branding und nicht
   *  an der einzelnen Seite — die Middleware löst sie einmal pro Request auf. */
  nav?: SiteNav;
};

export type SiteContext = {
  tenantId: string | null;
  branding: SiteBranding | null;
  unknown: boolean;
};

/** Tenant + Branding für den aktuellen Request. `unknown` true → die Domain ist
 *  keiner Agentur zugeordnet (Seite zeigt einen neutralen Hinweis). */
export async function getSiteContext(): Promise<SiteContext> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) {
    return { tenantId: null, branding: null, unknown: true };
  }

  let branding: SiteBranding | null = null;
  const raw = h.get("x-site-branding");
  if (raw) {
    try {
      branding = JSON.parse(raw) as SiteBranding;
    } catch {
      branding = null; // defekter Header → kein Branding, kein Crash
    }
  }
  return { tenantId, branding, unknown: false };
}
