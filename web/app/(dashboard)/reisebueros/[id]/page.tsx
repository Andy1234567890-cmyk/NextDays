// Reisebüro-Kartei (Detail): Stammdaten, Kontakte, Verträge nach Jahren
// mit Saison-Preisen. Kontakte + Verträge werden hier mitgeladen, damit
// Tabs sofort Zähler zeigen und die Sektionen ohne Lade-Flackern rendern
// (null = Laden fehlgeschlagen → Sektion lädt selbst und zeigt den Fehler).
// Realtime auf die Partner-Tabellen dieser Kartei.
import { AgencyDetail } from "@/components/reisebueros/agency-detail";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import {
  getAgency,
  listAgencyContacts,
  listAgencyContracts,
} from "@/lib/travel-agencies";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [agency, properties, contacts, contracts] = await Promise.all([
    getAgency(id),
    listProperties(),
    listAgencyContacts(id),
    listAgencyContracts(id),
  ]);
  // Fehler ehrlich zeigen (Backend down/403/404) statt pauschal notFound().
  if (!agency.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">{agency.error}</Card>
      </div>
    );
  }
  return (
    <>
      <RealtimeRefresh
        tables={["travel_agencies", "travel_agency_contacts", "travel_agency_contracts"]}
      />
      {!properties.ok && (
        <div className="mx-auto w-full max-w-6xl px-6 pt-6">
          <Card className="p-4 text-sm text-destructive">{properties.error}</Card>
        </div>
      )}
      <AgencyDetail
        agency={agency.data}
        properties={
          properties.ok
            ? properties.data.items.map((p) => ({ id: p.id, title: p.title }))
            : []
        }
        initialContacts={contacts.ok ? contacts.data : null}
        initialContracts={contracts.ok ? contracts.data.items : null}
      />
    </>
  );
}
