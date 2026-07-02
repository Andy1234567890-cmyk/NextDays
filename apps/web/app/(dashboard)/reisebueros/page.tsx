// Reisebüro-/Partner-Kartei (Liste). Server Component lädt die Partner,
// Realtime hält die Liste live (WebSocket, kein Polling).
import { AgenciesList } from "@/components/reisebueros/agencies-list";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@/components/ui/card";
import { listAgencies } from "@/lib/travel-agencies";

export const dynamic = "force-dynamic";

export default async function AgenciesPage() {
  const res = await listAgencies(undefined, true);
  if (!res.ok) {
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
