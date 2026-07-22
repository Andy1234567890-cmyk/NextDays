// Google-Fonts-Katalog-Proxy für den Website-Baukasten (Typography-Picker).
// Ruft die Google Fonts Developer API mit dem Server-Key ab und liefert eine
// schlanke Familienliste (name, category, variants). Der Key liegt NUR
// serverseitig (GOOGLE_FONTS_API_KEY, Coolify-Env) — nie im Client-Bundle.
//
// Die Katalogliste ändert sich selten → aggressiv cachen (revalidate 1 Tag).
// Ohne Key KEIN Fallback-Katalog: klarer Fehler, damit die Konfiguration
// auffällt (Prinzip „keine erfundenen Ersatzwerte").
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Antwort einen Tag lang cachen (Google-Katalog ist quasi statisch).
export const revalidate = 86400;

type GoogleFontItem = {
  family: string;
  category: string;
  variants: string[];
  files?: Record<string, string>;
};

export type FontCatalogEntry = {
  family: string;
  category: string; // sans-serif | serif | display | handwriting | monospace
  variants: string[];
};

export async function GET() {
  const key = process.env.GOOGLE_FONTS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GOOGLE_FONTS_API_KEY fehlt (Coolify-Env setzen)." },
      { status: 503 },
    );
  }
  // sort=popularity → die Liste kommt schon nach Beliebtheit sortiert (wie Framer).
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${key}&sort=popularity`;
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 86400 } });
  } catch {
    return NextResponse.json({ error: "Google-Fonts-API nicht erreichbar." }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `Google-Fonts-API-Fehler (${res.status}).` },
      { status: res.status === 403 ? 403 : 502 },
    );
  }
  const data = (await res.json()) as { items?: GoogleFontItem[] };
  const items: FontCatalogEntry[] = (data.items ?? []).map((f) => ({
    family: f.family,
    category: f.category,
    variants: f.variants,
  }));
  return NextResponse.json({ items }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
