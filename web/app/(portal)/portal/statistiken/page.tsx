// Eigentümer-Portal · Statistiken (pm_nonrevenue_charts, §4.2 read-only).
//
// AUSDRÜCKLICH OHNE GELD: der Endpunkt /public-portal/statistics liefert
// Belegung, Nächte, Aufenthaltsdauer und Vorlaufzeit — keine Beträge, keine
// Preise, keine Währung. `pm_revenue_charts` hat der Eigentümer nicht (§4.3).
//
// Zeitraum und Objekt stehen in der URL, damit der Server rechnet und ein Link
// auf einen Zeitraum teilbar bleibt. Ohne Angabe: die letzten 12 vollen Monate.
// Die harte Obergrenze der Spanne (730 Tage, Wurzel 8) setzt das Backend mit
// 422 durch; die Fläche zeigt dessen Begründung wörtlich an, statt still einen
// kürzeren Zeitraum zu nehmen.
import { PortalStatistiken } from "@/components/portal/portal-statistiken";
import { getOwnerProperties, getOwnerStatistics } from "@/lib/portal";

export const dynamic = "force-dynamic";

/** Nur ein echtes ISO-Datum wird übernommen. Alles andere ist keine Eingabe,
 *  sondern Müll aus der Adresszeile (Wurzel 3) — dann gilt die Voreinstellung,
 *  und es wird kein unlesbarer Wert an den Server oder in den DatePicker
 *  gereicht. */
function istIsoDatum(wert: string | undefined): wert is string {
  return (
    typeof wert === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(wert) &&
    !Number.isNaN(Date.parse(`${wert}T00:00:00Z`))
  );
}

/** Die letzten 12 vollen Monate: erster Tag vor 11 Monaten bis letzter Tag des
 *  laufenden Monats. Volle Monate, weil die Diagramme je Monat gruppieren. */
function letzteZwoelfMonate(): { von: string; bis: string } {
  const jetzt = new Date();
  const jahr = jetzt.getUTCFullYear();
  const monat = jetzt.getUTCMonth();
  const start = new Date(Date.UTC(jahr, monat - 11, 1));
  const ende = new Date(Date.UTC(jahr, monat + 1, 0));
  return {
    von: start.toISOString().slice(0, 10),
    bis: ende.toISOString().slice(0, 10),
  };
}

export default async function PortalStatistikenPage({
  searchParams,
}: {
  searchParams: Promise<{ objekt?: string; von?: string; bis?: string }>;
}) {
  const sp = await searchParams;
  const standard = letzteZwoelfMonate();
  const von = istIsoDatum(sp.von) ? sp.von : standard.von;
  const bis = istIsoDatum(sp.bis) ? sp.bis : standard.bis;

  const objekte = await getOwnerProperties();
  const items = objekte.ok ? objekte.data.items : [];

  // Eine fremde ID aus der URL wird verworfen, nicht durchgereicht (Wurzel 3).
  // Der Backend-Scope prüft ohnehin erneut und antwortet mit 404; die UI soll
  // nur nicht so tun, als hätte sie Zugriff.
  const gewaehlt =
    sp.objekt && items.some((p) => p.id === sp.objekt) ? sp.objekt : null;

  const statistik = await getOwnerStatistics({
    propertyId: gewaehlt,
    from: von,
    to: bis,
  });

  return (
    <PortalStatistiken
      properties={items}
      propertyId={gewaehlt}
      von={von}
      bis={bis}
      statistik={statistik.ok ? statistik.data : null}
      error={
        statistik.ok ? (objekte.ok ? null : objekte.error) : statistik.error
      }
    />
  );
}
