// Reisebüro-/Partner-Kartei (Liste). Server Component lädt die Partner,
// Realtime hält die Liste live (WebSocket, kein Polling).
import { notFound } from "next/navigation";

import { AgenciesList } from "@/components/reisebueros/agencies-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { listAgencies } from "@/lib/travel-agencies";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const res = await listAgencies(undefined, true);
  if (!res.ok) {
    // Fehlende Berechtigung (manage_partners) ist kein Fehler, sondern „gibt es
    // für dich nicht" — die Sidebar blendet den Eintrag ohnehin aus (Wurzel 3).
    if (res.status === 403) notFound();
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">{res.error}</Card>
      </div>
    );
  }
  return (
    <>
      <RealtimeRefresh tables={["travel_agencies"]} />
      <AgenciesList initial={res.data.items} />
    </>
  );
}
