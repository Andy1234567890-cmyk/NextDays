// Aufschlüsselung nach Buchung — je Aufenthalt Bezugsdaten + Posten.
import { notFound } from "next/navigation";

import { BuchungsAufschluesselungAnsicht } from "@/components/eigentuemer/reporting/buchungs-aufschluesselung";
import { getReport, getReportBookings } from "@/lib/owner-reporting";

export default async function BerichtBuchungenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bericht, buchungen] = await Promise.all([
    getReport(id),
    getReportBookings(id),
  ]);
  if (!bericht.ok || !buchungen.ok) notFound();
  return (
    <BuchungsAufschluesselungAnsicht
      reportId={id}
      reportName={bericht.data.name}
      daten={buchungen.data}
    />
  );
}
