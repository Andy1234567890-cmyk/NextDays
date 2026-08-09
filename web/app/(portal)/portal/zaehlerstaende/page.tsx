// Eigentümer-Portal · Zählerstände (§4.2).
//
// Historie einsehen + neuen Wert hinzufügen. Überschreiben und Löschen sind
// gesperrt — nicht nur in der UI: der Contract kennt für meter_readings kein
// PATCH und kein DELETE, und Migration 0229 entzieht `authenticated` auch am
// DB-Direktpfad update/delete. Append-only heißt hier wirklich append-only.
import { PortalZaehlerstaende } from "@/components/portal/portal-zaehlerstaende";
import { getOwnerProperties } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function PortalZaehlerstaendePage() {
  const objekte = await getOwnerProperties();
  return (
    <PortalZaehlerstaende
      properties={objekte.ok ? objekte.data.items : []}
      error={objekte.ok ? null : objekte.error}
    />
  );
}
