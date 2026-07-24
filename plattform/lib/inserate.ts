// Domänen-Modul „Inserate" — Backend-Anbindung nach NextDays-Muster (wie
// apps/web/lib/<domäne>.ts: ruft den eigenen Origin-Proxy /api/v1/..., der
// server-seitig an FastAPI weiterleitet). Quelle ist der öffentliche
// booking_engine-Slice (nur status='active'); KEINE Demo-Daten mehr.
import { type Listing, type Reihe, hueAusId } from "./listings";

// --- API-Form (booking_engine PublicListing/PublicListingDetail) ------------
type ApiListing = {
  id: string;
  title: string;
  property_type: string;
  city: string | null;
  country: string | null;
  photos: string[];
  max_guests: number;
  bedrooms: number | null;
  baths: number | null;
  amenities: string[];
  price_from: number | null;
  currency: string;
  rating: number | null;
  rating_count: number | null;
};

type ApiListingDetail = ApiListing & {
  description: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  nights: number | null;
  search_engine_indexing: boolean;
};

type ApiListResponse = { items: ApiListing[]; total: number };

// Server-Component-Fetch über den Same-Origin-Proxy. Absolute URL aus der
// Request-Herkunft ableiten ist hier nicht nötig: Next leitet relative Pfade in
// Server-Components an den eigenen Origin; der Proxy spricht dann FastAPI an.
// Kurzes Zeitbudget: hängt das Backend (z. B. 504/Gateway-Timeout), darf der
// SSR-Render nicht mitblockieren — nach Ablauf bricht der Fetch ab und der
// Aufrufer (ladeReihen) zeigt den Leerzustand statt abzustürzen.
const FETCH_TIMEOUT_MS = 8000;

async function get<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/v1/booking-engine/${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Backend ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

function ort(city: string | null, country: string | null): string {
  return [city, country].filter(Boolean).join(", ") || "—";
}

function mapList(a: ApiListing): Listing {
  return {
    id: a.id,
    titel: a.title,
    typ: a.property_type,
    ort: ort(a.city, a.country),
    preisProNacht: a.price_from,
    currency: a.currency ?? null,
    hue: hueAusId(a.id),
    fotos: a.photos ?? [],
    schlafzimmer: a.bedrooms,
    baeder: a.baths,
    gaeste: a.max_guests,
    ausstattung: a.amenities ?? [],
    beschreibung: null,
    // Bewertungen nur übernehmen, wenn das Backend echte Werte liefert.
    ...(a.rating != null ? { bewertung: a.rating } : {}),
    ...(a.rating_count != null ? { anzahlBewertungen: a.rating_count } : {}),
  };
}

function mapDetail(a: ApiListingDetail): Listing {
  return {
    ...mapList(a),
    beschreibung: a.description,
    preisProNacht: a.price ?? a.price_from,
    suchmaschinenIndex: a.search_engine_indexing,
  };
}

export type SuchParams = {
  q?: string;
  guests?: number;
  start?: string;
  end?: string;
};

// --- Sitemap: nur aktive, suchmaschinen-indexierbare Objekte -----------------
type ApiSitemapEntry = { id: string; updated_at: string | null };
type ApiSitemapResponse = { items: ApiSitemapEntry[] };

export type SitemapInserat = { id: string; updatedAt: string | null };

/** IDs (+ letzte Änderung) der aktiven, indexierbaren Objekte für die Sitemap.
 *  noindex-Objekte liefert das Backend gar nicht erst. Resilient: ein Fehler
 *  ergibt eine leere Sitemap statt eines Crashs. */
export async function ladeSitemapInserate(): Promise<SitemapInserat[]> {
  try {
    const data = await get<ApiSitemapResponse>("sitemap");
    return (data.items ?? []).map((e) => ({
      id: e.id,
      updatedAt: e.updated_at,
    }));
  } catch (err) {
    console.error("ladeSitemapInserate fehlgeschlagen:", err);
    return [];
  }
}

/** Alle aktiven Inserate (optional gefiltert). Resilient: ein Backend-Fehler
 *  oder Timeout darf die Startseite NICHT abstürzen lassen — dann leere Liste
 *  (die Seite zeigt ihren Leerzustand). Kein erfundener Inhalt. */
export async function ladeInserate(params: SuchParams = {}): Promise<Listing[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.guests) qs.set("guests", String(params.guests));
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  try {
    const data = await get<ApiListResponse>(`listings${suffix}`);
    return (data.items ?? []).map(mapList);
  } catch (err) {
    console.error("ladeInserate fehlgeschlagen:", err);
    return [];
  }
}

/** Ein Inserat (Detail) — null, wenn nicht (mehr) aktiv. */
export async function ladeInserat(
  id: string,
  params: SuchParams = {},
): Promise<Listing | null> {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  try {
    const a = await get<ApiListingDetail>(
      `listings/${encodeURIComponent(id)}${suffix}`,
    );
    return mapDetail(a);
  } catch {
    return null; // 404/Backend-Fehler → kein Inserat (Detailseite → notFound)
  }
}

// Deutsche Labels der property_type-Enum (für Themen-Reihen-Titel).
const TYP_LABEL: Record<string, string> = {
  ferienhaus: "Ferienhäuser",
  appartement: "Appartements",
  glamping: "Glamping",
  tiny_house: "Tiny Houses",
  stellplatz: "Stellplätze",
  hausboot: "Hausboote",
};

/** Themen-Reihen aus echten Inseraten ableiten: erst „alle", dann je
 *  property_type und je Stadt — leere Reihen entfallen. Keine Demo. */
export async function ladeReihen(params: SuchParams = {}): Promise<Reihe[]> {
  const alle = await ladeInserate(params);
  if (alle.length === 0) return [];

  const reihen: Reihe[] = [
    { titel: "Beliebte Unterkünfte", listings: alle },
  ];

  // Nach property_type gruppieren (nur Reihen mit mind. 1 Treffer).
  const typen = new Map<string, Listing[]>();
  const staedte = new Map<string, Listing[]>();
  for (const l of alle) {
    if (l.typ) {
      const arr = typen.get(l.typ) ?? [];
      arr.push(l);
      typen.set(l.typ, arr);
    }
    const stadt = l.ort.split(",")[0]?.trim();
    if (stadt && stadt !== "—") {
      const arr = staedte.get(stadt) ?? [];
      arr.push(l);
      staedte.set(stadt, arr);
    }
  }
  for (const [typ, listings] of typen) {
    reihen.push({ titel: TYP_LABEL[typ] ?? typ, listings });
  }
  for (const [stadt, listings] of staedte) {
    reihen.push({ titel: `Unterkünfte in ${stadt}`, listings });
  }
  return reihen;
}
