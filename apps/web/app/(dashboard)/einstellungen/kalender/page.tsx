// Einstellungen → Kalender importieren/exportieren (iCal-Sync).
// Server Component: lädt die Übersicht (alle Objekte + ihre externen Feeds) und
// übergibt sie an die Client-UI. Export-Links werden erst auf Klick erzeugt (das
// Token ist geheim und wird nicht vorab ausgeliefert).
import { getTranslations } from "next-intl/server";

import { CalendarSync } from "@/components/einstellungen/calendar-sync";
import { Card } from "@/components/ui/card";
import { overviewExternalCalendars } from "@/lib/external-calendar";

export default async function KalenderSyncPage() {
  const [res, t] = await Promise.all([
    overviewExternalCalendars(),
    getTranslations("calendarSync"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {!res.ok ? (
        <Card className="p-5 text-sm text-destructive">{t("loadErr")}</Card>
      ) : (
        <CalendarSync overview={res.data} />
      )}
    </div>
  );
}
