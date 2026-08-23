"use server";

// White-Label-Site-Konfiguration: Server-Actions gegen den FastAPI-site_config-
// Slice (/api/v1/site-config). Branding (Logo/Farben/Texte) + Custom-Domains der
// Agentur. Die Custom-Domain-TLS läuft über Cloudflare for SaaS; das Backend
// kapselt das. Aktionen sind 1:1 zu den Backend-Aktionen benannt (MCP-ready).
import { revalidatePath } from "next/cache";

// `revalidatePath("/website", "layout")` statt nur `("/website")`: der Baukasten
// besteht seit dem Wechsel auf echte Reiter-Routen aus mehreren Seiten
// (`/website/design`, `/website/design/logo`, `/website/seiten`,
// `/website/einstellungen/*`). Die Punkt-Variante hätte nur die Weiterleitung
// unter `/website` selbst entwertet — die Ansicht, die der Kunde offen hat, wäre
// aus dem Cache gekommen und hätte seine Änderung nicht gezeigt.

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type BookingMode = "instant" | "inquiry" | "both";
export type DomainStatus = "pending" | "active" | "error";

/** Header-/Footer-Skelett der Kunden-Site (0421). Bestimmt NUR die Anordnung —
 *  Farben, Schriften und Button-Form sind davon unabhängig, deshalb kostet ein
 *  Theme-Wechsel den Kunden nicht seine Marke. */
export type SiteTheme = "klar" | "mitte" | "karte" | "seitlich";
export type ButtonStyle = "solid" | "outline";
export type ButtonRadius = "sharp" | "rounded" | "pill";

export type Branding = {
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
  about_text: Record<string, string>;
  contact_text: Record<string, string>;
  social_links: Record<string, string>;
  booking_mode: BookingMode;
  // --- Farbrollen für Kopf-/Fußzeile, Links, Firmenname (0426) ------------
  // Vorher gab es vier Rollen; Kopf- und Fußzeile hatten keine eigene Farbe und
  // übernahmen den Seitenhintergrund. Ein dunkler Header auf hellem Grund war
  // damit unmöglich — der häufigste Gestaltungswunsch überhaupt.
  brand_name_color: string | null;
  header_background: string | null;
  header_link_color: string | null;
  link_color: string | null;
  footer_background: string | null;
  // --- Typografie des Logo-Bereichs (0426) -------------------------------
  logo_name_font: string | null;
  /** Schriftgröße des Firmennamens in Punkt (8–48). */
  logo_name_size: number | null;
  slogan_font: string | null;
  /** Klickziel des Logos. Leer = Startseite. */
  logo_link_url: string | null;
  // --- Sprachen der Website (0426) --------------------------------------
  languages: string[] | null;
  default_language: string | null;
  // --- Anzeigeverhalten (0426) ------------------------------------------
  show_guest_breakdown: boolean;
  show_base_prices: boolean;
  // --- Eigener Code (0426) ---------------------------------------------
  head_html: string | null;
  head_css: string | null;
  custom_js: string | null;
  checkout_js: string | null;
  // --- Cookie-Hinweis, Datenschutz-Zustimmung, Hauptschalter (0426) -----
  cookie_banner: boolean;
  cookie_policy_page_id: string | null;
  privacy_consent: boolean;
  privacy_policy_page_id: string | null;
  is_offline: boolean;
};

export type BrandingInput = Partial<Branding>;

export type DnsRecord = { type: string; name: string; value: string };

export type CustomDomain = {
  id: string;
  domain: string;
  status: DomainStatus;
  ssl_status: string | null;
  dns_records: DnsRecord[];
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "PUT" | "POST" | "DELETE"; body?: unknown } = {},
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

/** Branding der Agentur lesen (leere Felder, falls noch nichts gepflegt). */
export async function getBranding(): Promise<Result<Branding>> {
  return call("/site-config");
}

/** Branding speichern (Teil-Update; nur gesetzte Felder). */
export async function setBranding(
  input: BrandingInput,
): Promise<Result<Branding>> {
  const res = await call<Branding>("/site-config", {
    method: "PUT",
    body: input,
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

/** Alle Custom-Domains der Agentur. */
export async function listDomains(): Promise<
  Result<{ items: CustomDomain[]; total: number }>
> {
  return call("/site-config/domains");
}

/** Custom-Domain hinzufügen → liefert CNAME + TXT-Validierungs-Record. */
export async function addDomain(
  domain: string,
): Promise<Result<CustomDomain>> {
  const res = await call<CustomDomain>("/site-config/domains", {
    method: "POST",
    body: { domain },
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

/** Status einer Domain mit Cloudflare abgleichen (pending → active). */
export async function syncDomain(
  domainId: string,
): Promise<Result<CustomDomain>> {
  const res = await call<CustomDomain>(
    `/site-config/domains/${domainId}/sync`,
    { method: "POST" },
  );
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}

/** Custom-Domain entfernen (auch bei Cloudflare). */
export async function removeDomain(domainId: string): Promise<Result<null>> {
  const res = await call<null>(`/site-config/domains/${domainId}`, {
    method: "DELETE",
  });
  if (res.ok) revalidatePath("/website", "layout");
  return res;
}
