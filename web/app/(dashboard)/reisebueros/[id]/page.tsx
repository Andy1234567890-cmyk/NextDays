// Reisebüro-Kartei (Detail): Stammdaten, Kontakte, Verträge nach Jahren
// mit Saison-Preisen. Kontakte + Verträge werden hier mitgeladen, damit
// Tabs sofort Zähler zeigen und die Sektionen ohne Lade-Flackern rendern
// (null = Laden fehlgeschlagen → Sektion lädt selbst und zeigt den Fehler).
import { AgencyDetail } from "@/components/reisebueros/agency-detail";
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
      {/* Kein Realtime mehr: `travel_agencies`, `travel_agency_contacts` und
        `travel_agency_contracts` sind für authenticated bewusst gesperrt
        (Wurzel 6, Migration 0337: revoke + raus aus supabase_realtime), Abos
        darauf wären stumme Attrappen. Eine offene Tabelle, die dieselben
        Ereignisse trägt, gibt es nicht. Ehrlich benannt: Stammdaten der
        Kartei, Kontaktpersonen und Verträge/Preiszeilen erscheinen erst beim
        nächsten Laden der Seite — insbesondere Änderungen durch einen ZWEITEN
        Nutzer werden hier nicht mehr sichtbar. Eigene Änderungen bleiben
        sichtbar: die Sektionen laden nach ihrer Aktion selbst nach. */}
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
