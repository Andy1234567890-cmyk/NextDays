// Zugriff auf die Hilfe-Inhalte. Aktuell nur Deutsch als Basissprache; weitere
// Sprachen kommen als eigenes Modul mit identischen slugs dazu (wie im
// Marketing-Center). Bis dahin faellt jede Sprache bewusst auf DE zurueck —
// sichtbar deutsche Texte sind besser als leere Seiten.
import { kategorien } from "./de";
import type { HilfeArtikel, HilfeKategorie } from "./typen";

export type { HilfeArtikel, HilfeBlock, HilfeKategorie } from "./typen";

export function alleKategorien(): HilfeKategorie[] {
  return kategorien;
}

export function kategorie(slug: string): HilfeKategorie | undefined {
  return kategorien.find((k) => k.slug === slug);
}

export function artikel(
  kategorieSlug: string,
  artikelSlug: string,
): { kategorie: HilfeKategorie; artikel: HilfeArtikel } | undefined {
  const k = kategorie(kategorieSlug);
  const a = k?.artikel.find((x) => x.slug === artikelSlug);
  return k && a ? { kategorie: k, artikel: a } : undefined;
}

/** Flache Liste fuer die Suche. */
export function suchIndex(): {
  kategorie: HilfeKategorie;
  artikel: HilfeArtikel;
}[] {
  return kategorien.flatMap((k) => k.artikel.map((a) => ({ kategorie: k, artikel: a })));
}

/** Volltextsuche ueber Titel, Auszug und Text. Ohne Treffer: leere Liste —
 *  NIE „ähnliche" Artikel erfinden, das verwirrt mehr, als es hilft. */
export function suche(frage: string) {
  const q = frage.trim().toLowerCase();
  if (!q) return [];
  return suchIndex().filter(({ artikel: a }) => {
    const heu = [
      a.titel,
      a.auszug,
      ...a.text.map((b) =>
        "text" in b ? b.text : "punkte" in b ? b.punkte.join(" ") : "",
      ),
    ]
      .join(" ")
      .toLowerCase();
    return heu.includes(q);
  });
}
