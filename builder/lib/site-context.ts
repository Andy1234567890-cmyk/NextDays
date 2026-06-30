// Site-Kontext der white-label Builder-App: liest den von der Middleware
// aufgelösten Tenant + dessen öffentliches Branding aus den Request-Headern.
//
// Quelle der Wahrheit ist der Backend-Resolver /api/v1/site/by-domain; die
// Middleware (middleware.ts) ruft ihn einmal pro Request und legt das Ergebnis
// als Header ab. Hier wird es nur typsicher ausgelesen — kein erfundener Wert.
// `unknown` = Host gehört zu keiner eingerichteten Agentur (neutraler Hinweis).
import { headers } from "next/headers";

export type SiteBranding = {
  tenant_id: string;
  site_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  social_links: Record<string, string>;
  booking_mode: "instant" | "inquiry" | "both";
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
