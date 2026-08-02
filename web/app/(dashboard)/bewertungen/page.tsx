// Bewertungen (alle Kanäle). Server Component lädt erste Seite + Kennzahlen,
// Realtime hält die Liste live (WebSocket, kein Polling): `reviews` speist die
// myBestDays-Bewertungen, `channex_review` die der Portale.
import { notFound } from "next/navigation";

import { BewertungsCockpit } from "@/components/bewertungen/bewertungs-cockpit";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { listReviews, reviewSummary } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function BewertungenPage() {
  const [liste, kennzahlen, me] = await Promise.all([
    listReviews({ limit: 25, offset: 0 }),
    reviewSummary(),
    getMe(),
  ]);

  if (!liste.ok) {
    // Fehlende Berechtigung ist kein Fehler, sondern „gibt es für dich nicht" —
    // die Sidebar blendet den Eintrag ohnehin aus (Wurzel 3).
    if (liste.status === 403) notFound();
    return (
      <Card className="p-5 text-sm text-destructive">{liste.error}</Card>
    );
  }

  // Eigentümer sind read-only (§4.2): kein Antworten, kein Abgleich.
  const canManage = me?.capabilities.includes("manage_reviews") ?? false;

  return (
    <>
      <RealtimeRefresh tables={["reviews", "channex_review"]} />
      <BewertungsCockpit
        initial={liste.data.items}
        initialTotal={liste.data.total}
        summary={kennzahlen.ok ? kennzahlen.data : null}
        canManage={canManage}
      />
    </>
  );
}
