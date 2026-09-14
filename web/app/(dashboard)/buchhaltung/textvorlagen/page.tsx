// Buchhaltung → Textvorlagen: Kopf-/Fußtexte der Belege, Betreff und Nachricht
// der Versand-Mails. Server Component — lädt über die Server-Action; alle
// Interaktion in der Client-Komponente. Kein Realtime: `text_templates` ist
// server-only (Wurzel 6, Migration 0695), Abos darauf wären stumme Attrappen.
// Nach eigener Aktion lädt die Komponente per `router.refresh()` neu.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { TextvorlagenVerwaltung } from "@/components/buchhaltung/versand/TextvorlagenVerwaltung";
import { Card } from "@nextdays/ui/card";
import { listTextTemplates } from "@/lib/buchhaltung-versand";

export default async function TextvorlagenPage() {
  const t = await getTranslations("finance");
  const res = await listTextTemplates();

  if (!res.ok) {
    // Fehlende Berechtigung → die Buchhaltung existiert für diesen Nutzer nicht
    // (Sidebar blendet sie aus, Wurzel 3); echter Backend-Fehler bleibt sichtbar.
    if (res.status === 403) notFound();
    return (
      <Card className="p-5 text-sm text-destructive">
        {t("textvorlagenPage.loadError", { error: res.error })}
      </Card>
    );
  }

  return <TextvorlagenVerwaltung templates={res.data} />;
}
