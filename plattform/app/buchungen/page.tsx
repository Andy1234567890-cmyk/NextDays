// Meine Buchungen — Tabs anstehend/vergangen/storniert. Der erste Tab wird
// serverseitig vorgeladen; das Tab-Wechseln/Nachladen ist eine Client-Insel.
import { BuchungenListe } from "@/components/buchungen-liste";
import { KontoShell } from "@/components/konto-shell";
import { serverBookings } from "@/lib/guest-server";

export default async function BuchungenPage() {
  const upcoming = await serverBookings("upcoming");
  return (
    <KontoShell titel="Meine Buchungen">
      <BuchungenListe initialItems={upcoming} />
    </KontoShell>
  );
}
