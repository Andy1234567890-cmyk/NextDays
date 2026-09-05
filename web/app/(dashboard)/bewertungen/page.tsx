// Bewertungen (alle Kanäle). Server Component lädt erste Seite + Kennzahlen,
// Realtime hält die Liste live (WebSocket, kein Polling): `reviews` speist die
// myBestDays-Bewertungen, `channex_review` die der Portale.
import { notFound } from "next/navigation";

import { BewertungsTabelle } from "@/components/bewertungen/bewertungs-tabelle";
import { KiStatusBadge } from "@/components/bewertungen/ki-status-badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { listProperties } from "@/lib/properties";
import { getKiDiagnose, listReviews, reviewSummary } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function BewertungenPage() {
  const [liste, kennzahlen, me, kiDiagnose, objekte] = await Promise.all([
    listReviews({ limit: 25, offset: 0 }),
    reviewSummary(),
    getMe(),
    // KI-Status-Badge (0568): Freigaben offen? Nächster Lauf? Erster Stand
    // vom Server, danach hält das Realtime-Signal `review_ki_stand` es aktuell.
    getKiDiagnose(),
    // Für den Objektfilter. Ein Dropdown ohne Inhalt wäre eine Attrappe —
    // schlägt das Laden fehl, entfällt der Filter, statt leer dazustehen.
    listProperties(),
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
      {/* channex_review ist für authenticated gesperrt (Wurzel 6, Migration
          0337): guest_name + Bewertungstext, über ota_reservation_id mit dem
          Gast verknüpfbar, dazu die noch unveröffentlichte Antwort.
          KEIN Ersatz-Abo: eine neue OTA-Bewertung kommt per Channex-Feed herein
          und erzeugt weder eine Reservierungs- noch eine Objekt-Änderung — ein
          Umhängen wäre ein stiller Ersatz. Ersatzlos gestrichen.
          `reviews` (Marktplatz myBestDays) bleibt offen und weiterhin live;
          NICHT mehr live sind die Bewertungen der Portale — sie erscheinen beim
          nächsten Seitenaufruf. */}
      <RealtimeRefresh tables={["reviews"]} />
      <BewertungsTabelle
        initial={liste.data.items}
        initialTotal={liste.data.total}
        summary={kennzahlen.ok ? kennzahlen.data : null}
        canManage={canManage}
        kiStatus={<KiStatusBadge initial={kiDiagnose.ok ? kiDiagnose.data : null} />}
        objekte={
          objekte.ok
            ? objekte.data.items.map((o) => ({
                id: o.id,
                title: o.title ?? o.id,
              }))
            : []
        }
      />
    </>
  );
}
