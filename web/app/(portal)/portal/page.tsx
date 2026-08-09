// Eigentümer-Portal · Übersicht (§4.2).
//
// Drei Dinge auf einen Blick, in der Reihenfolge, die ein Eigentümer erwartet:
// seine Objekte, die Belegung des gewählten Zeitraums und der Auszahlungsstand.
// Alles read-only — der Eigentümer verwaltet hier nichts, er sieht.
//
// Der Zeitraum (Monat/Jahr) steht in der URL (?zeitraum=), damit ein Reload und
// ein geteilter Link denselben Ausschnitt zeigen. Die Daten holt die Server
// Component; der Client-Teil hört auf Realtime und stößt einen Refresh an.
import { PortalUebersicht } from "@/components/portal/portal-uebersicht";
import {
  getOwnerEarnings,
  getOwnerProperties,
  getOwnerStatements,
} from "@/lib/portal";

export const dynamic = "force-dynamic";

/** Erster und letzter Tag des laufenden Monats bzw. Jahres als YYYY-MM-DD. */
function zeitraum(art: "monat" | "jahr"): { von: string; bis: string } {
  const jetzt = new Date();
  const jahr = jetzt.getUTCFullYear();
  if (art === "jahr") {
    return { von: `${jahr}-01-01`, bis: `${jahr}-12-31` };
  }
  const monat = jetzt.getUTCMonth();
  const ersterNaechster = new Date(Date.UTC(jahr, monat + 1, 1));
  const letzter = new Date(ersterNaechster.getTime() - 86_400_000);
  const mm = String(monat + 1).padStart(2, "0");
  return {
    von: `${jahr}-${mm}-01`,
    bis: letzter.toISOString().slice(0, 10),
  };
}

export default async function PortalUebersichtPage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>;
}) {
  const sp = await searchParams;
  const art = sp.zeitraum === "jahr" ? "jahr" : "monat";
  const { von, bis } = zeitraum(art);

  const [objekte, einnahmen, abrechnungen] = await Promise.all([
    getOwnerProperties(),
    getOwnerEarnings(von, bis),
    getOwnerStatements(),
  ]);

  return (
    <PortalUebersicht
      art={art}
      von={von}
      bis={bis}
      properties={objekte.ok ? objekte.data.items : []}
      propertiesError={objekte.ok ? null : objekte.error}
      earnings={einnahmen.ok ? einnahmen.data : null}
      earningsError={einnahmen.ok ? null : einnahmen.error}
      statements={abrechnungen.ok ? abrechnungen.data.items : []}
      statementsError={abrechnungen.ok ? null : abrechnungen.error}
    />
  );
}
