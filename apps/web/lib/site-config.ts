"use server";

// White-Label-Site-Konfiguration: Server-Actions gegen den FastAPI-site_config-
// Slice (/api/v1/site-config). Branding (Logo/Farben/Texte) + Custom-Domains der
// Agentur. Die Custom-Domain-TLS läuft über Cloudflare for SaaS; das Backend
// kapselt das. Aktionen sind 1:1 zu den Backend-Aktionen benannt (MCP-ready).
import { revalidatePath } from "next/cache";

import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type BookingMode = "instant" | "inquiry" | "both";
export type DomainStatus = "pending" | "active" | "error";

export type Branding = {
  site_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  about_text: Record<string, string>;
  contact_text: Record<string, string>;
  social_links: Record<string, string>;
  booking_mode: BookingMode;
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
  if (res.ok) revalidatePath("/konto/branding");
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
  if (res.ok) revalidatePath("/konto/branding");
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
  if (res.ok) revalidatePath("/konto/branding");
  return res;
}

/** Custom-Domain entfernen (auch bei Cloudflare). */
export async function removeDomain(domainId: string): Promise<Result<null>> {
  const res = await call<null>(`/site-config/domains/${domainId}`, {
    method: "DELETE",
  });
  if (res.ok) revalidatePath("/konto/branding");
  return res;
}
