// Bewertungs-KI — der Haltungs-Katalog, die Zustellung und die Test-KI.
//
// Beide Richtungen an EINEM Ort: die Bewertung, die wir über den Gast
// schreiben, und die öffentliche Antwort auf seine Bewertung über uns. Sie
// teilen sich den Katalog, weil es derselbe Betrieb ist, der redet — die
// Zustellart steht je Richtung, weil sie unterschiedlich riskant sind.
import { notFound } from "next/navigation";

import { KiSeite } from "@/components/bewertungen/ki-seite";
import { Card } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { listProperties } from "@/lib/properties";
import { getKiKatalog, getKiSettings } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function BewertungsKiPage() {
  const [katalog, settings, me, objekte] = await Promise.all([
    getKiKatalog(),
    getKiSettings(),
    getMe(),
    listProperties(),
  ]);

  if (!katalog.ok) {
    if (katalog.status === 403) notFound();
    return <Card className="p-5 text-sm text-destructive">{katalog.error}</Card>;
  }
  if (!settings.ok) {
    return <Card className="p-5 text-sm text-destructive">{settings.error}</Card>;
  }

  return (
    <KiSeite
      katalog={katalog.data}
      settings={settings.data}
      canManage={me?.capabilities.includes("manage_reviews") ?? false}
      objekte={
        objekte.ok
          ? objekte.data.items.map((o) => ({ id: o.id, title: o.title ?? o.id }))
          : []
      }
    />
  );
}
