// Zahlung-Detail: Abschnitte, Teilzahlungen, Empfänger-Stammdaten.
import { notFound } from "next/navigation";

import { ZahlungDetailAnsicht } from "@/components/eigentuemer/reporting/zahlung-detail";
import { getPayment } from "@/lib/owner-reporting";

export default async function ZahlungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getPayment(id);
  if (!res.ok) notFound();
  return <ZahlungDetailAnsicht zahlung={res.data} />;
}
