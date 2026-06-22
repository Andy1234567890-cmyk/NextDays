// Stop-Sell — Verkaufsstopp-Tage je Objekt verwalten. Server Component lädt die
// Objekte, der Client-Teil zeigt/setzt Stopps (Channex-Stops read-only).
import { StopSellManager } from "@/components/stop-sell/stop-sell-manager";
import { Card } from "@/components/ui/card";
import { listProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function StopSellPage() {
  const res = await listProperties();
  if (!res.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-5 text-sm text-destructive">
          Objekte konnten nicht geladen werden.
        </Card>
      </div>
    );
  }
  return (
    <StopSellManager
      properties={res.data.items.map((p) => ({ id: p.id, title: p.title }))}
    />
  );
}
