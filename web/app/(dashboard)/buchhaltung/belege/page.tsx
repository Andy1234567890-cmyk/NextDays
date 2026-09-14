// Buchhaltung → Belege: EINE Liste für alle Belegarten (Tabs je Art), mit
// „Umwandeln in …" entlang der Kette und den wiederkehrenden Rechnungen samt
// nächster Fälligkeit. Server Component — lädt über die Server-Action; die
// Belegart steht in der URL (?type=), Aktionen laufen in Client-Komponenten.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { BelegeKopfaktionen } from "@/components/buchhaltung/belege/belege-kopfaktionen";
import { BelegeTabelle } from "@/components/buchhaltung/belege/belege-tabelle";
import { BelegeTabs } from "@/components/buchhaltung/belege/belege-tabs";
import { belegartLabels } from "@/components/buchhaltung/belege/belegart-labels";
import { Card } from "@nextdays/ui/card";
import { listBelege } from "@/lib/buchhaltung-belege";
import { istBelegart, type Belegart } from "@/lib/buchhaltung-belege-typen";

export default async function BelegePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const t = await getTranslations("finance");
  const { type } = await searchParams;
  const art: Belegart = istBelegart(type) ? type : "invoice";
  const labels = belegartLabels(t);
  const res = await listBelege(art, { limit: 200 });

  return (
    <div className="flex flex-col gap-6">
      {/* Kein Realtime: `invoices` und `quotes` sind für authenticated bewusst
        gesperrt (Wurzel 6, Migration 0337), ein Abo darauf wäre eine stumme
        Attrappe. Die Seite lädt nach jeder eigenen Aktion neu
        (router.refresh in den Client-Komponenten). */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("belegePage.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("belegePage.subtitle")}</p>
        </div>
        <BelegeKopfaktionen art={art} labels={labels} />
      </div>

      <BelegeTabs aktiv={art} labels={labels} />

      {!res.ok ? (
        res.status === 403 ? (
          notFound()
        ) : res.status === 402 ? (
          <Card className="p-5 text-sm text-muted-foreground">{t("belegePage.modulRequired")}</Card>
        ) : (
          <Card className="p-5 text-sm text-destructive">{t("belegePage.loadError")}</Card>
        )
      ) : (
        <BelegeTabelle art={art} items={res.data.items} labels={labels} />
      )}
    </div>
  );
}
