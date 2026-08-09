// Eigentümer-Portal · Berichte (§4.2, read-only).
//
// Drei Dinge auf einer Seite, weil sie dieselbe Frage beantworten („was bekomme
// ich?"): die finalisierten Abrechnungen zum Herunterladen, der laufende
// Abrechnungsstand des aktuellen Monats und Monats-/Jahresberichte.
//
// Alle Zahlen kommen aus dem public_portal-Slice; die Maskierung sitzt im
// Backend (guest_masking: owner sieht ohne PM_BOOKING_TOTAL keine Gast-Beträge).
// Sichtbar ist die eigene Auszahlung.
import { PortalBerichte } from "@/components/portal/portal-berichte";
import { getOwnerEarnings, getOwnerStatements } from "@/lib/portal";

export const dynamic = "force-dynamic";

/** Laufender Monat als [erster, letzter] Tag, ISO. */
function laufenderMonat(): { von: string; bis: string } {
  const jetzt = new Date();
  const jahr = jetzt.getUTCFullYear();
  const monat = jetzt.getUTCMonth();
  const mm = String(monat + 1).padStart(2, "0");
  const letzter = new Date(Date.UTC(jahr, monat + 1, 0));
  return { von: `${jahr}-${mm}-01`, bis: letzter.toISOString().slice(0, 10) };
}

export default async function PortalBerichtePage() {
  const { von, bis } = laufenderMonat();
  const [abrechnungen, laufend] = await Promise.all([
    getOwnerStatements(),
    getOwnerEarnings(von, bis),
  ]);

  return (
    <PortalBerichte
      statements={abrechnungen.ok ? abrechnungen.data.items : []}
      statementsError={abrechnungen.ok ? null : abrechnungen.error}
      current={laufend.ok ? laufend.data : null}
      currentError={laufend.ok ? null : laufend.error}
    />
  );
}
