// Auto-Bewertungen — die Texte, mit denen der Betrieb seine Gäste automatisch
// bewertet. Entspricht Hostaways Reiter `AUTO-REVIEWS`: eine Karte je Vorlage,
// nicht ein Einstellungsformular.
//
// Der Unterschied ist mehr als Optik. Vorher gab es EINE Konfiguration je
// Betrieb mit EINEM Text — bei 500 Reservierungen also 500-mal derselbe Satz
// an dasselbe Portal. Genau davor warnt Hostaway in seiner eigenen Doku
// („Airbnb may penalize this practice"). Seit 0503 hält eine Vorlage mehrere
// Texte, der Versand zieht zufällig einen, und sie hängt am Objekt statt am
// Betrieb.
//
// Die Gast-Erinnerung (der zweite Teil der alten Automatik) bleibt darunter:
// sie ist kein Bewertungstext, sondern eine Mail an den Gast, und hat mit den
// Vorlagen nichts zu tun.
import { notFound } from "next/navigation";

import { AutoBewertungen } from "@/components/bewertungen/auto-bewertungen";
import { GastErinnerung } from "@/components/bewertungen/gast-erinnerung";
import { Card } from "@nextdays/ui/card";
import { getMe } from "@/lib/auth";
import { listProperties } from "@/lib/properties";
import { getReviewAutomation, listAutoTemplates } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function AutoBewertungenPage() {
  const [vorlagen, cfg, me, objekte] = await Promise.all([
    listAutoTemplates(),
    getReviewAutomation(),
    getMe(),
    listProperties(),
  ]);

  if (!vorlagen.ok) {
    if (vorlagen.status === 403) notFound();
    return <Card className="p-5 text-sm text-destructive">{vorlagen.error}</Card>;
  }

  const canManage = me?.capabilities.includes("manage_reviews") ?? false;

  return (
    <div className="flex flex-col gap-8">
      <AutoBewertungen
        initial={vorlagen.data.items}
        canManage={canManage}
        objekte={
          objekte.ok
            ? objekte.data.items.map((o) => ({ id: o.id, title: o.title ?? o.id }))
            : []
        }
      />
      {cfg.ok && <GastErinnerung initial={cfg.data} readOnly={!canManage} />}
    </div>
  );
}
