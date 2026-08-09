// Eigentümer-Portal · Benachrichtigungs-Einstellungen (§4.2).
//
// Pro Ereignis wählt der Eigentümer den Kanal: E-Mail, SMS oder aus. Der
// Contract ist GET/PATCH /api/v1/notification-settings (der Slice
// notification_settings, Katalog in katalog.py). Die Kategorien kommen vom
// Server — die UI erfindet keine eigene Liste (Wurzel 4).
import { PortalBenachrichtigungen } from "@/components/portal/portal-benachrichtigungen";
import { getBenachrichtigungen } from "@/lib/portal-benachrichtigungen";

export const dynamic = "force-dynamic";

export default async function PortalBenachrichtigungenPage() {
  const res = await getBenachrichtigungen();
  return (
    <PortalBenachrichtigungen
      overview={res.ok ? res.data : null}
      error={res.ok ? null : res.error}
    />
  );
}
