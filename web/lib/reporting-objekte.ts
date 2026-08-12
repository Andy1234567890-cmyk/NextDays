"use server";

// Die Objektauswahl des Reportings — EINE Quelle für Bericht-Formular und
// Plan-Formular.
//
// Beide brauchen dieselbe Liste (alle Objekte des Betriebs mit Titel, Adresse,
// Bild) und dieselben vorkommenden WÄHRUNGEN. Zweimal geladen liefen sie
// auseinander, sobald eine der beiden Stellen einen Filter bekommt.
import { listProperties } from "@/lib/properties";
import type { ObjektAuswahlEintrag } from "@/components/objekt-mehrfachauswahl";

export type ReportingObjekte = {
  objekte: ObjektAuswahlEintrag[];
  /** Grund, falls die Liste nicht geladen werden konnte. `null` = geladen. */
  error: string | null;
  /**
   * Die im Bestand VORKOMMENDEN Währungen, sortiert.
   *
   * Bewusst aus den Objekten abgeleitet und keine feste Liste: ein Katalog aller
   * 27 EU-Währungen böte dem Betreiber 26 Optionen an, mit denen sein Bestand
   * nichts zu tun hat — und die erste davon stünde vorausgewählt da. Ein Objekt
   * ohne gepflegte Währung liefert nichts; die leere Liste ist dann die
   * ehrliche Auskunft und kein Anlass, „EUR" zu erfinden (Wurzel 4).
   */
  waehrungen: string[];
};

export async function ladeReportingObjekte(): Promise<ReportingObjekte> {
  const res = await listProperties();
  if (!res.ok) {
    return { objekte: [], error: res.error, waehrungen: [] };
  }
  const objekte: ObjektAuswahlEintrag[] = res.data.items.map((p) => ({
    id: p.id,
    title: p.title,
    subtitle:
      [[p.street, p.house_number].filter(Boolean).join(" "), p.city]
        .filter(Boolean)
        .join(", ") || undefined,
    photo: p.photos?.[0] ?? undefined,
  }));
  const waehrungen = [
    ...new Set(
      res.data.items
        .map((p) => (p.currency ?? "").trim().toUpperCase())
        .filter((c) => c.length === 3),
    ),
  ].sort();
  return { objekte, error: null, waehrungen };
}
