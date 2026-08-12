// Bilanzstatistik: gezahltes Geld im Zeitverlauf + Anteile je Abschnitt.
import { StatistikAnsicht } from "@/components/eigentuemer/reporting/statistik-ansicht";
import { getStatistik } from "@/lib/owner-reporting";

export default async function StatistikenPage({
  searchParams,
}: {
  searchParams: Promise<{ von?: string; bis?: string }>;
}) {
  const params = await searchParams;
  // Vorgabe: das laufende Kalenderjahr. Der Zeitraum wird SERVERSEITIG
  // bestimmt — über die Browser-Uhr sähen zwei Nutzer in verschiedenen
  // Zeitzonen am Jahreswechsel verschiedene Vorgaben.
  const jahr = new Date().getFullYear();
  const von = istDatum(params.von) ? params.von : `${jahr}-01-01`;
  const bis = istDatum(params.bis) ? params.bis : `${jahr}-12-31`;

  const res = await getStatistik({ von, bis });
  return (
    <StatistikAnsicht
      statistik={res.ok ? res.data : null}
      von={von}
      bis={bis}
      loadError={res.ok ? null : res.error}
    />
  );
}

/** Nur echte ISO-Daten durchlassen: ein manipulierter Query-Parameter darf
 *  nicht als Datum an die API gehen (der Server lehnt ihn ab, aber der Nutzer
 *  sähe dann eine Fehlermeldung statt seiner Statistik). */
function istDatum(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
