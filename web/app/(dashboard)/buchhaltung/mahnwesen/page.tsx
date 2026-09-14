// Buchhaltung → Mahnwesen: überfällige Rechnungen und Mahnungen in drei Stufen.
// Server Component — lädt über die Server-Actions, Interaktion in
// components/buchhaltung/mahnwesen/*.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import { MahnwesenUebersicht } from "@/components/buchhaltung/mahnwesen/mahnwesen-uebersicht";
import {
  getFirmaKopf,
  getReminderSettings,
  listOverdueInvoices,
  listReminders,
} from "@/lib/buchhaltung-mahnwesen";
import type { FirmaKopf } from "@/lib/buchhaltung-mahnwesen-typen";

const LEERE_FIRMA: FirmaKopf = {
  companyName: "",
  companyStreet: "",
  companyHouseNumber: "",
  companyPostalCode: "",
  companyCity: "",
  companyCountry: "",
  email: "",
  phoneNumber: "",
  vatId: "",
  iban: "",
  bic: "",
  bankName: "",
};

export default async function MahnwesenPage() {
  const t = await getTranslations("finance");
  const [overdueRes, remindersRes, settingsRes, firmaRes] = await Promise.all([
    listOverdueInvoices(),
    listReminders({ limit: 500 }),
    getReminderSettings(),
    getFirmaKopf(),
  ]);

  // Kein Realtime: `reminders`, `reminder_settings` und `invoices` sind für
  // authenticated gesperrt (Wurzel 6, 0337/0640/0641) — ein Abo darauf wäre
  // eine stumme Attrappe. Nach jeder eigenen Aktion lädt die Seite neu
  // (router.refresh/revalidatePath); Änderungen anderer erscheinen beim
  // nächsten Laden.
  if (!overdueRes.ok || !remindersRes.ok) {
    const status = !overdueRes.ok ? overdueRes.status : !remindersRes.ok ? remindersRes.status : undefined;
    // Fehlende Berechtigung → die Buchhaltung existiert für diesen Nutzer nicht.
    if (status === 403) notFound();
    const fehler = !overdueRes.ok ? overdueRes.error : !remindersRes.ok ? remindersRes.error : "";
    return (
      <Card className="p-5 text-sm text-destructive">
        {t("mahnwesenPage.loadError")}
        {fehler ? ` (${fehler})` : ""}
      </Card>
    );
  }

  return (
    <MahnwesenUebersicht
      overdue={overdueRes.data}
      reminders={remindersRes.data.items}
      settings={settingsRes.ok ? settingsRes.data : null}
      // Firmenprofil hat einen eigenen Guard; scheitert es, bleibt der PDF-Kopf
      // leer statt erfunden (Wurzel 4).
      firma={firmaRes.ok ? firmaRes.data : LEERE_FIRMA}
    />
  );
}
