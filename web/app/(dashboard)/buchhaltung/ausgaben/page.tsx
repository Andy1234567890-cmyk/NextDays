// Buchhaltung → Ausgaben: Eingangsbelege des Betriebs.
// Server Component — liest die Filter aus der URL, lädt über die Server-Actions
// und rendert die Client-Liste (Filterleiste, Formular-Sheet, Kategorien).
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { AusgabenListe } from "@/components/buchhaltung/ausgaben/ausgaben-liste";
import { listExpenseCategories, listExpenses } from "@/lib/buchhaltung-ausgaben";
import type { ExpenseFilter, PaymentStatus } from "@/lib/buchhaltung-ausgaben-typen";
import { PAYMENT_STATUSES } from "@/lib/buchhaltung-ausgaben-typen";

type Suche = Record<string, string | string[] | undefined>;

function einzel(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : undefined;
}

function filterAusUrl(sp: Suche): ExpenseFilter {
  const status = einzel(sp.status);
  const recurring = einzel(sp.recurring);
  return {
    from: einzel(sp.from),
    to: einzel(sp.to),
    status: status && (PAYMENT_STATUSES as readonly string[]).includes(status)
      ? (status as PaymentStatus)
      : undefined,
    categoryId: einzel(sp.categoryId),
    recurring: recurring === "true" ? true : recurring === "false" ? false : undefined,
    search: einzel(sp.search),
  };
}

export default async function AusgabenPage({
  searchParams,
}: {
  searchParams: Promise<Suche>;
}) {
  const t = await getTranslations("finance");
  const filter = filterAusUrl(await searchParams);
  // Kein Realtime: `expenses`/`expense_categories` sind für authenticated
  // gesperrt (Wurzel 6, 0655/0656: revoke + keine Publikation) — ein Abo wäre
  // eine stumme Attrappe. Die Seite lädt nach jeder eigenen Aktion neu
  // (router.refresh/revalidatePath); fremde Änderungen erscheinen beim
  // nächsten Laden.
  const [liste, kategorien] = await Promise.all([
    listExpenses(filter),
    listExpenseCategories(true),
  ]);

  // Fehlende Berechtigung (owner_reporting/Owner) → die Buchhaltung existiert
  // für diesen Nutzer nicht (Sidebar blendet sie aus, Wurzel 3). 402 (Modul
  // nicht gebucht) und echte Fehler bleiben sichtbar.
  if (!liste.ok && liste.status === 403) notFound();

  const alleKategorien = kategorien.ok ? kategorien.data : [];
  const ladeFehler = !liste.ok
    ? liste.status === 402
      ? t("ausgabenPage.moduleRequired")
      : t("ausgabenPage.loadError", { error: liste.error })
    : null;

  return (
    <AusgabenListe
      liste={liste.ok ? liste.data : null}
      categories={alleKategorien}
      filter={filter}
      ladeFehler={ladeFehler}
    />
  );
}
