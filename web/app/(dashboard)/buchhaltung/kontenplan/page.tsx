// Buchhaltung → Kontenplan: Buchungskonten (SKR03/04), Kostenstellen,
// Nummernkreise, Zahlungsarten. Server Component — lädt über die
// Server-Actions des Bereichs, Interaktion in components/buchhaltung/kontenplan.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { KontenplanTabs } from "@/components/buchhaltung/kontenplan/kontenplan-tabs";
import { Card } from "@nextdays/ui/card";
import {
  listBookingAccounts,
  listCostCenters,
  listNumberSequences,
  listPaymentMethods,
} from "@/lib/buchhaltung-kontenplan";

export default async function KontenplanPage() {
  const t = await getTranslations("finance");
  const [konten, kostenstellen, kreise, zahlungsarten] = await Promise.all([
    listBookingAccounts(),
    listCostCenters(),
    listNumberSequences(),
    listPaymentMethods(),
  ]);

  // Fehlende Berechtigung (owner_reporting) → die Buchhaltung existiert für
  // diesen Nutzer nicht (Wurzel 3); ein echter Backend-Fehler bleibt sichtbar.
  if (!konten.ok && konten.status === 403) notFound();
  const fehler = [konten, kostenstellen, kreise, zahlungsarten].find((r) => !r.ok);

  return (
    <div className="flex flex-col gap-6">
      {/* Kein Realtime: booking_accounts, cost_centers, payment_methods und
        number_sequences sind für authenticated gesperrt (Wurzel 6, 0671–0674,
        0337) — Abos darauf wären stumme Attrappen. Stammdaten pflegt der
        Nutzer hier selbst; nach jeder Aktion lädt die Seite neu. */}
      <div>
        <h2 className="font-display text-2xl font-extrabold">{t("kontenplanPage.kontenplanTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("kontenplanPage.kontenplanDescription")}</p>
      </div>

      {fehler && !fehler.ok && (
        <Card className="p-5 text-sm text-destructive">
          {t("kontenplanPage.loadError")} {fehler.error}
        </Card>
      )}

      <Suspense fallback={null}>
        <KontenplanTabs
          accounts={konten.ok ? konten.data : []}
          costCenters={kostenstellen.ok ? kostenstellen.data : []}
          sequences={kreise.ok ? kreise.data : []}
          methods={zahlungsarten.ok ? zahlungsarten.data : []}
        />
      </Suspense>
    </div>
  );
}
