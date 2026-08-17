// Reiseziel-Vorschläge des Suchfelds — ECHTE Ziele aus dem Bestand
// (/api/v1/booking-engine/destinations), keine hartkodierte Städteliste.
// Vorher standen im Suchfeld Paris/Barcelona/Bangkok/Tokio/Rom, ohne dass dort
// ein einziges Objekt lag; die real vorhandenen Orte (Skagen, Bindslev,
// Rostock-Warnemünde, Kitzbühel …) tauchten nie auf.
// Client-Insel → Same-Origin-Proxy /api/v1 (kein Direktaufruf an FastAPI).

export type Reiseziel = {
  art: "city" | "country";
  /** Anzeigefertig, z. B. „Skagen, Dänemark" oder „Dänemark". */
  label: string;
  /** Wert, mit dem die Suche wirklich trifft (Stadt bzw. Landesname). */
  query: string;
  city: string | null;
  country: string | null;
  countryName: string | null;
  count: number;
  /** Pfad zur selbst gezeichneten Illustration in public/reiseziele/. */
  bild: string;
};

// Die gezeichneten Motive in public/reiseziele/: die Landschaften/Neutralen und
// je Land eine Flagge (`land-<iso2>`). Ein unbekannter Wert vom Server darf keinen
// 404 im Suchfeld erzeugen → auf das neutrale Motiv zurückfallen, das es garantiert
// gibt. Kein erfundener Inhalt, sondern dieselbe neutrale Illustration, die der
// Server ohne Datenlage selbst wählt.
const LANDSCHAFTS_MOTIVE = new Set([
  "kueste",
  "insel",
  "berge",
  "see",
  "stadt",
  "land",
  "welt",
]);

/** `land-dk` & Co. werden anhand des Musters akzeptiert statt über eine zweite
 *  Länderliste — eine Kopie der 29 Codes im Frontend würde beim nächsten Land
 *  auseinanderlaufen. Das Muster ist eng genug, dass nichts anderes durchkommt. */
const FLAGGEN_MUSTER = /^land-[a-z]{2}$/;

function bildPfad(motiv: string | undefined, art: "city" | "country"): string {
  const gueltig =
    !!motiv && (LANDSCHAFTS_MOTIVE.has(motiv) || FLAGGEN_MUSTER.test(motiv));
  const name = gueltig ? motiv : art === "country" ? "welt" : "land";
  return `/reiseziele/${name}.svg`;
}

type ApiZiel = {
  art: "city" | "country";
  label: string;
  query: string;
  city: string | null;
  country: string | null;
  country_name: string | null;
  count: number;
  motiv?: string;
};

/** Reiseziele mit buchbaren Objekten; `q` filtert Stadt- und Landesname.
 *  Ein Backend-Fehler ergibt eine leere Liste — das Suchfeld zeigt dann keine
 *  Vorschläge, aber der getippte Freitext bleibt suchbar. Kein Ersatzinhalt. */
export async function ladeReiseziele(
  q: string,
  limit = 8,
  signal?: AbortSignal,
): Promise<Reiseziel[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  const begriff = q.trim();
  if (begriff) qs.set("q", begriff);
  try {
    const res = await fetch(`/api/v1/booking-engine/destinations?${qs}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: ApiZiel[] };
    return (data.items ?? []).map((z) => ({
      art: z.art,
      label: z.label,
      query: z.query,
      city: z.city,
      country: z.country,
      countryName: z.country_name,
      count: z.count,
      bild: bildPfad(z.motiv, z.art),
    }));
  } catch {
    return []; // inkl. AbortError beim Weitertippen
  }
}
