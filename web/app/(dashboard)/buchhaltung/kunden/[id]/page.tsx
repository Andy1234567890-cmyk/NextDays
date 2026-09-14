// Buchhaltung → Kunden → Detail: Kopf mit Kennzahlen (serverseitig je Währung
// gerechnet), Reiter Belege / Ansprechpartner / Adressen / Notizen.
// Server Component — lädt alles über die Server-Actions parallel; Interaktion
// in web/components/buchhaltung/kontakte/*.
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import { Kennzahlen } from "@/components/buchhaltung/kontakte/kennzahlen";
import { KundenDetail } from "@/components/buchhaltung/kontakte/kunden-detail";
import {
  getKunde,
  getKundenUebersicht,
  listAnschriften,
  listAnsprechpartner,
  listNotizen,
} from "@/lib/buchhaltung-kontakte";

export default async function KundenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, locale, kundeRes, uebersichtRes, kontakteRes, anschriftenRes, notizenRes] =
    await Promise.all([
      getTranslations("finance"),
      getLocale(),
      getKunde(id),
      getKundenUebersicht(id, 50),
      listAnsprechpartner(id),
      listAnschriften(id),
      listNotizen(id),
    ]);

  // Kein Realtime: customers, invoices, customer_contacts/_addresses/_notes
  // sind für authenticated bewusst gesperrt (Wurzel 6), ein Abo wäre eine
  // stumme Attrappe. Nach jeder eigenen Aktion lädt die Seite per
  // router.refresh()/revalidatePath neu.

  // 403 (Rolle ohne Finanzzugang) und 404 (fremder/gelöschter Kunde) → die
  // Seite existiert für diesen Nutzer nicht (Wurzel 3, kein Existenz-Leak).
  if (!kundeRes.ok) {
    if (kundeRes.status === 403 || kundeRes.status === 404) notFound();
    return <Card className="p-5 text-sm text-destructive">{t("kontaktePage.loadError")}</Card>;
  }
  if (!uebersichtRes.ok) {
    // 422 = Datenfehler (Beleg ohne Währung): die Meldung des Servers zeigen,
    // nicht eine erfundene Zahl (Wurzel 4/5).
    return (
      <Card className="p-5 text-sm text-destructive">
        {t("kontaktePage.overviewError")}: {uebersichtRes.error}
      </Card>
    );
  }

  const kennzahlen = (
    <Kennzahlen
      uebersicht={uebersichtRes.data}
      locale={locale}
      texte={{
        revenue: t("kontaktePage.kennzahlen.revenue"),
        open: t("kontaktePage.kennzahlen.open"),
        overdue: t("kontaktePage.kennzahlen.overdue"),
        invoices: t("kontaktePage.kennzahlen.invoices"),
        lastInvoice: t("kontaktePage.kennzahlen.lastInvoice"),
        none: t("kontaktePage.kennzahlen.none"),
        truncated: t("kontaktePage.kennzahlen.truncated"),
        noInvoices: t("kontaktePage.kennzahlen.noInvoices"),
      }}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {(!kontakteRes.ok || !anschriftenRes.ok || !notizenRes.ok) && (
        <Card className="p-4 text-sm text-destructive">{t("kontaktePage.partialError")}</Card>
      )}
      <KundenDetail
        kunde={kundeRes.data}
        uebersicht={uebersichtRes.data}
        kontakte={kontakteRes.ok ? kontakteRes.data : []}
        anschriften={anschriftenRes.ok ? anschriftenRes.data : []}
        notizen={notizenRes.ok ? notizenRes.data : []}
        kennzahlen={kennzahlen}
      />
    </div>
  );
}
