// Bericht bearbeiten — dasselbe Formular wie beim Anlegen.
import { notFound } from "next/navigation";

import { BerichtFormular } from "@/components/eigentuemer/reporting/bericht-formular";
import { getReport } from "@/lib/owner-reporting";
import { ladeReportingObjekte } from "@/lib/reporting-objekte";

export default async function BerichtBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bericht, objekte] = await Promise.all([
    getReport(id),
    ladeReportingObjekte(),
  ]);
  // Ein fremder oder unbekannter Bericht ist für diesen Nutzer nicht
  // vorhanden — 404 statt eines Fehlerkastens (Wurzel 3).
  if (!bericht.ok) notFound();
  return (
    <BerichtFormular
      objekte={objekte.objekte}
      objekteError={objekte.error}
      // Die Währung des Berichts steht auch dann zur Wahl, wenn kein Objekt
      // sie (mehr) trägt: sonst verlöre ein bestehender Bericht beim
      // Bearbeiten stillschweigend seine Währung.
      waehrungen={[
        ...new Set([...objekte.waehrungen, bericht.data.currency]),
      ].sort()}
      bericht={bericht.data}
    />
  );
}
