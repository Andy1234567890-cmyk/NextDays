// Empfänger-Detail im Reporting: Kennzahlen, wiederkehrende Posten, Zahlungen.
import { notFound } from "next/navigation";

import { EmpfaengerDetail } from "@/components/eigentuemer/reporting/empfaenger-detail";
import {
  listPayments,
  listRecipients,
  listRecurring,
} from "@/lib/owner-reporting";
import { getOwner } from "@/lib/owners";
import { listProperties } from "@/lib/properties";

export default async function EmpfaengerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [empfaengerListe, posten, zahlungen, owner, objekte] =
    await Promise.all([
      listRecipients(),
      listRecurring(id),
      listPayments({ ownerId: id }),
      getOwner(id),
      listProperties(),
    ]);

  // Die Kennzahlen kommen aus der Empfänger-Übersicht — dieselbe Quelle wie
  // die Liste. Sie hier zweitens zu berechnen ergäbe zwei Zahlen für dasselbe.
  const empfaenger = empfaengerListe.ok
    ? empfaengerListe.data.items.find((e) => e.owner_id === id)
    : undefined;
  if (!empfaenger || !owner.ok) notFound();

  // Nur die Objekte DIESES Eigentümers: ein wiederkehrender Posten auf einem
  // fremden Objekt verrechnete Beträge, die mit dieser Auszahlung nichts zu
  // tun haben.
  const titel = new Map(
    (objekte.ok ? objekte.data.items : []).map((p) => [p.id, p.title]),
  );
  const eigene = owner.data.properties.map((l) => ({
    id: l.property_id,
    title: titel.get(l.property_id) ?? l.property_id,
  }));

  // Währungen aus den EIGENEN Objekten: ein Posten muss auf die Währung des
  // Berichts lauten, und die folgt den Objekten dieses Eigentümers.
  const waehrungen = [
    ...new Set(
      (objekte.ok ? objekte.data.items : [])
        .filter((p) => eigene.some((e) => e.id === p.id))
        .map((p) => (p.currency ?? "").trim().toUpperCase())
        .filter((c) => c.length === 3),
    ),
  ].sort();

  return (
    <EmpfaengerDetail
      empfaenger={empfaenger}
      posten={posten.ok ? posten.data.items : []}
      zahlungen={zahlungen.ok ? zahlungen.data.items : []}
      objekte={eigene}
      waehrungen={waehrungen}
    />
  );
}
