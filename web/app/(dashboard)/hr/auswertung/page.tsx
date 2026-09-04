// Personal → Auswertung & Lohnvorbereitung (EXPORT_LOHN). Vorbelegt mit dem
// Vormonat — dem Zeitraum, der abgerechnet wird.
import { notFound } from "next/navigation";

import { Auswertung } from "@/components/personal/auswertung";
import { getAuswertung } from "@/lib/personal";
import { heuteIso } from "@/lib/personal-typen";

export const dynamic = "force-dynamic";

export default async function AuswertungPage() {
  const heute = heuteIso();
  const d = new Date(`${heute}T00:00:00Z`);
  const ersterDesMonats = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const vormonatStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const von = vormonatStart.toISOString().slice(0, 10);
  const bis = new Date(ersterDesMonats.getTime() - 86400000).toISOString().slice(0, 10);
  const res = await getAuswertung(von, bis);
  if (!res.ok && res.status === 403) notFound();
  return <Auswertung initial={res.ok ? res.data : null} von={von} bis={bis} />;
}
