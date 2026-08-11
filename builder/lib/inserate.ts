// Domänen-Modul „Inserate" — Backend-Anbindung nach NextDays-Muster
// (lib/<domäne>.ts). Diese Loader laufen ausschließlich SERVERSEITIG und rufen
// FastAPI direkt; der Same-Origin-Proxy /api/v1 bleibt für die Client-Inseln
// (lib/buchung.ts) zuständig. Quelle ist der öffentliche
// booking_engine-Slice (nur status='active'); KEINE Demo-Daten mehr.
import { backendBasis } from "./backend-basis";
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
};

type ApiListResponse = { items: ApiListing[]; total: number };

// Server-Component-Fetch DIREKT an FastAPI (nicht über den Same-Origin-Proxy):
// eine Server-Component kennt ihren eigenen Origin nicht, und eine relative URL
// ist für `fetch` ungültig — siehe lib/backend-basis.ts.
// Kurzes Zeitbudget: hängt das Backend (z. B. 504/Gateway-Timeout), darf der
// SSR-Render nicht mitblockieren — nach Ablauf bricht der Fetch ab und der
// Aufrufer (ladeReihen) zeigt den Leerzustand statt abzustürzen.
const FETCH_TIMEOUT_MS = 8000;

async function get<T>(path: string): Promise<T> {
  const base = backendBasis();
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

/** Hängt den Tenant-Filter an einen booking_engine-Pfad. In der Builder-App ist
 *  tenant immer gesetzt (jede Domain = genau eine Agentur) → nur deren Objekte. */
function withTenant(path: string, tenant: string | null): string {
  if (!tenant) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}tenant=${encodeURIComponent(tenant)}`;
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
  };
}

export type SuchParams = {
  q?: string;
  guests?: number;
  start?: string;
  end?: string;
  // Featured-Block: nur diese Objekt-IDs (leeres Array → keine Objekte).
  propertyIds?: string[];
};

/** Alle aktiven Inserate (optional gefiltert). Resilient: ein Backend-Fehler
 *  oder Timeout darf die Startseite NICHT abstürzen lassen — dann leere Liste
 *  (die Seite zeigt ihren Leerzustand). Kein erfundener Inhalt. */
export async function ladeInserate(
  params: SuchParams = {},
  tenant: string | null = null,
): Promise<Listing[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.guests) qs.set("guests", String(params.guests));
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.propertyIds) {
    // Leere Liste bewusst übergeben → Backend liefert 0 (nicht „alle").
    for (const id of params.propertyIds) qs.append("property_ids", id);
    if (params.propertyIds.length === 0) qs.set("property_ids", "");
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  try {
    const data = await get<ApiListResponse>(
      withTenant(`listings${suffix}`, tenant),
    );
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
  tenant: string | null = null,
): Promise<Listing | null> {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  try {
    const a = await get<ApiListingDetail>(
      withTenant(`listings/${encodeURIComponent(id)}${suffix}`, tenant),
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
export async function ladeReihen(
  params: SuchParams = {},
  tenant: string | null = null,
): Promise<Reihe[]> {
  const alle = await ladeInserate(params, tenant);
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
