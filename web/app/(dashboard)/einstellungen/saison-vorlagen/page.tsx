// Einstellungen → Saison-Vorlagen (ADR-0024, 0584): tenant-weite Vorlagen aus
// Kategorien + Zeiträumen, per Checkbox auf Objekte anwendbar. Server Component
// lädt Vorlagen und die Objektliste; die Client-UI hält beides live
// (season_templates per Realtime).
import { getTranslations } from "next-intl/server";

import { SaisonVorlagen } from "@/components/einstellungen/saison-vorlagen";
import { Card } from "@nextdays/ui/card";
import { listSeasonTemplates } from "@/lib/calendar";
import { listProperties } from "@/lib/properties";

export default async function SaisonVorlagenPage() {
  const [vorlagen, objekte, t] = await Promise.all([
    listSeasonTemplates(),
    listProperties(),
    getTranslations("kalender.vorlagen"),
  ]);
  if (!vorlagen.ok) {
    return <Card className="p-5 text-sm text-destructive">{t("ladenFehler", { error: vorlagen.error })}</Card>;
  }
  if (!objekte.ok) {
    return <Card className="p-5 text-sm text-destructive">{t("ladenFehler", { error: objekte.error })}</Card>;
  }
  return (
    <SaisonVorlagen
      initial={vorlagen.data.items}
      objekte={objekte.data.items.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: [p.street, p.city].filter(Boolean).join(", ") || undefined,
        photo: p.photos[0],
      }))}
    />
  );
}
