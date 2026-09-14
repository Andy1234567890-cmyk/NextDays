// Buchhaltung → DATEV: EXTF-CSV-Export für den Steuerberater.
// Server Component — lädt Einstellungen + Historie über die Server-Actions,
// Interaktion in den Client-Komponenten unter components/buchhaltung/datev/.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DatevEinstellungen } from "@/components/buchhaltung/datev/datev-einstellungen";
import { DatevExportDialog } from "@/components/buchhaltung/datev/datev-export-dialog";
import { DatevExportHistorie } from "@/components/buchhaltung/datev/datev-export-historie";
import { Card } from "@nextdays/ui/card";
import { getDatevSettings, listDatevExports } from "@/lib/buchhaltung-datev";

export default async function DatevPage() {
  const t = await getTranslations("finance");
  const [settingsRes, exportsRes] = await Promise.all([getDatevSettings(), listDatevExports()]);

  // Fehlende Berechtigung (owner_reporting) → die Buchhaltung existiert für
  // diesen Nutzer nicht (Wurzel 3); ein echter Backend-Fehler bleibt sichtbar.
  if (!settingsRes.ok && settingsRes.status === 403) notFound();

  return (
    <div className="flex flex-col gap-6">
      {/* Kein Realtime: `datev_settings`/`datev_exports` sind für authenticated
        bewusst gesperrt (Wurzel 6, 0685/0686: revoke, keine Publikation). Die
        Seite lädt nach eigener Aktion per router.refresh() neu; ein Export ist
        immer die eigene Aktion. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("datevPage.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("datevPage.subtitle")}</p>
        </div>
        <DatevExportDialog configured={settingsRes.ok && settingsRes.data.configured} />
      </div>

      {!settingsRes.ok ? (
        <Card className="p-5 text-sm text-destructive">
          {t("datevPage.loadError")} {settingsRes.error}
        </Card>
      ) : (
        <DatevEinstellungen settings={settingsRes.data} />
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">{t("datevPage.history.title")}</h3>
        {!exportsRes.ok ? (
          <Card className="p-5 text-sm text-destructive">
            {t("datevPage.loadError")} {exportsRes.error}
          </Card>
        ) : (
          <DatevExportHistorie laeufe={exportsRes.data} />
        )}
      </section>
    </div>
  );
}
