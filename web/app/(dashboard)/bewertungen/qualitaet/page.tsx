// Qualitäts-Dashboard: Ø, 5-Sterne-Quote, Antwortquote, Kategorien,
// Tagesverlauf und die Rangliste der Objekte. Server Component lädt die
// letzten 30 Tage vor.
import { notFound } from "next/navigation";

import { Qualitaet } from "@/components/bewertungen/qualitaet";
import { Card } from "@nextdays/ui/card";
import { reviewQuality } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function QualitaetPage() {
  const res = await reviewQuality();
  if (!res.ok) {
    if (res.status === 403) notFound();
    return <Card className="p-5 text-sm text-destructive">{res.error}</Card>;
  }
  return <Qualitaet initial={res.data} />;
}
