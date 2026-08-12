// Zahlungen über alle Berichte hinweg.
import { ZahlungenListe } from "@/components/eigentuemer/reporting/zahlungen-liste";
import { listPayments } from "@/lib/owner-reporting";

export default async function ZahlungenPage({
  searchParams,
}: {
  searchParams: Promise<{ offen?: string }>;
}) {
  const { offen } = await searchParams;
  const nurOffene = offen === "1";
  // Der Filter läuft über den SERVER: „bezahlter Prozentsatz" ist die Summe
  // der Teilzahlungen geteilt durch den Betrag, und die Teilzahlungen stehen
  // nicht in der Liste.
  const res = await listPayments({ nurOffene });
  return (
    <ZahlungenListe
      items={res.ok ? res.data.items : []}
      loadError={res.ok ? null : res.error}
      nurOffene={nurOffene}
    />
  );
}
