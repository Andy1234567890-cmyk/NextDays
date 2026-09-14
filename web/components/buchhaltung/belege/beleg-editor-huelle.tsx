"use client";

// Dünne Hülle um den EINEN Beleg-Editor des Bestands (create-invoice/container.tsx,
// Fassade create-invoice-page.tsx). Der Editor kennt keine Belegart-Prop —
// sie kommt aus der URL (`?belegart=`), diese Hülle liefert den sichtbaren
// Kontext: Titel, Nummernkreis, Pflichtfelder je Art (ins ℹ-Symbol, nie als
// Absatz), Warnung bei Gutschrift (Vorzeichen dreht der Server).
//
// Solange der Bestand den Parameter noch nicht liest (Koordinator-Aufgabe im
// BERICHT-belege.md), speichert der Editor über /invoices als Rechnung; die
// Hülle sagt das ehrlich an, statt einen anderen Belegtyp vorzutäuschen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import CreateInvoiceForm from "@/components/finance/create-invoice-page";
import { NUMMERNKREIS_PRAEFIX, type Belegart } from "@/lib/buchhaltung-belege-typen";

export function BelegEditorHuelle({
  belegart,
  label,
  bestandLiestBelegart,
}: {
  belegart: Belegart;
  label: string;
  /** true, sobald container.tsx `?belegart=` auswertet (Koordinator-Diff). */
  bestandLiestBelegart: boolean;
}) {
  const t = useTranslations("finance");
  const pflicht = t(`belegePage.required_${belegart}`);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/buchhaltung/belege?type=${belegart}`}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("belegePage.backToList")}
          >
            <Icon icon="ph:arrow-left" className="size-5" />
          </Link>
          <h2 className="font-display text-2xl font-extrabold">
            {t("belegePage.newTitle", { art: label })}
          </h2>
          <InfoHinweis
            ariaLabel={t("belegePage.requiredInfoAria", { art: label })}
            titel={t("belegePage.requiredTitle")}
            text={[
              pflicht,
              t("belegePage.numberInfo", { praefix: NUMMERNKREIS_PRAEFIX[belegart] }),
              ...(belegart === "credit_note" ? [t("belegePage.creditNoteSign")] : []),
            ]}
          />
        </div>
        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium">
          {t("belegePage.numberSequence")}: {NUMMERNKREIS_PRAEFIX[belegart]}
        </span>
      </div>

      {!bestandLiestBelegart && belegart !== "invoice" && (
        <p role="alert" className="rounded-(--radius) border border-border bg-muted p-3 text-sm">
          {t("belegePage.editorSavesAsInvoice", { art: label })}
        </p>
      )}

      <CreateInvoiceForm />
    </div>
  );
}
