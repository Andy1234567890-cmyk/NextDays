// Buchhaltung → Artikel: Artikelstamm des Betriebs (billing_items).
// Server Component — lädt über die Server-Actions, Interaktion in ArtikelListe.
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";
import { ArtikelListe } from "@/components/buchhaltung/artikel/artikel-liste";
import { listCategories, listItems } from "@/lib/buchhaltung-artikel";

export default async function ArtikelPage() {
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const [res, kategorienRes] = await Promise.all([listItems({ limit: 500 }), listCategories()]);
  const kategorien = kategorienRes.ok ? kategorienRes.data : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Kein Realtime: `billing_items` ist für authenticated bewusst gesperrt
        (Wurzel 6, Migration 0668: revoke, keine Realtime-Publikation) — ein Abo
        darauf wäre eine stumme Attrappe. Der Artikelstamm wird hier vom Nutzer
        selbst gepflegt; nach jeder eigenen Aktion lädt die Liste per
        router.refresh() neu. Änderungen eines Kollegen erscheinen beim nächsten
        Laden der Seite. */}
      <div>
        <h2 className="font-display text-2xl font-extrabold">{t("artikelPage.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("artikelPage.subtitle")}</p>
      </div>

      {!res.ok ? (
        // 403 = Rolle ohne Finanzzugang → die Buchhaltung existiert für diesen
        // Nutzer nicht (Wurzel 3); 402 (Modul nicht gebucht) und echte Backend-
        // Fehler bleiben sichtbar.
        res.status === 403 ? (
          notFound()
        ) : (
          <Card className="p-5 text-sm text-destructive">
            {res.status === 402 ? t("artikelPage.moduleRequired") : t("artikelPage.loadError")}
          </Card>
        )
      ) : (
        <ArtikelListe items={res.data} kategorien={kategorien} locale={locale} />
      )}
    </div>
  );
}
