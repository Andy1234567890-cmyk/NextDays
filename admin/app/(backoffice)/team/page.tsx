// Team: Backoffice-Zugänge vergeben, ändern, entziehen.
//
// Lesen darf jede:r im Backoffice (man soll sehen, wer Zugriff hat); ändern nur
// platform_admin — durchgesetzt wird das vom Server (require_platform_write),
// hier steuert die Rolle nur die Sichtbarkeit der Aktionen.
import { getPlatformMe } from "@/lib/backoffice";

import { TeamVerwaltung } from "@/components/team-verwaltung";

export default async function TeamSeite() {
  const me = await getPlatformMe();
  return (
    <TeamVerwaltung eigeneUserId={me.user_id} darfSchreiben={me.can_write} />
  );
}
