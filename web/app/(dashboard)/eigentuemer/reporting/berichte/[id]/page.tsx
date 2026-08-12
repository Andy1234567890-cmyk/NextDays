// Bericht-Detail: KPI, Zahlungen und die fünf Aufschlüsselungen.
import { notFound } from "next/navigation";

import { BerichtDetail } from "@/components/eigentuemer/reporting/bericht-detail";
import { getReport, listRecipients } from "@/lib/owner-reporting";
import { listProperties } from "@/lib/properties";

export default async function BerichtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bericht, empfaenger, objekte] = await Promise.all([
    getReport(id),
    listRecipients(),
    listProperties(),
  ]);
  if (!bericht.ok) notFound();

  // Titel der Objekte im Scope: die „ohne Buchung"-Zeilen kommen ohne Namen,
  // weil sie keine Auswertung haben. Fehlt der Titel dennoch, steht die ID da
  // — unschön, aber wahr; ein Platzhalter wäre es nicht (Wurzel 4).
  const objektNamen = Object.fromEntries(
    (objekte.ok ? objekte.data.items : []).map((p) => [p.id, p.title]),
  );

  return (
    <BerichtDetail
      bericht={bericht.data}
      empfaenger={empfaenger.ok ? empfaenger.data.items : []}
      objektNamen={objektNamen}
    />
  );
}
