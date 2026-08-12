// Empfänger-Übersicht: Zahlungen, Volumen je Währung, Vertragsstand.
import { EmpfaengerListe } from "@/components/eigentuemer/reporting/empfaenger-liste";
import { listRecipients } from "@/lib/owner-reporting";

export default async function EmpfaengerPage() {
  const res = await listRecipients();
  return (
    <EmpfaengerListe
      items={res.ok ? res.data.items : []}
      loadError={res.ok ? null : res.error}
    />
  );
}
