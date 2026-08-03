"use client";

// „Promotions — neue oder bestehende Promotion hinzufügen."
//
// Der Zwischenschritt, den der Branchenstandard vor dem Formular setzt (live
// abgelesen 03.08.2026 und im Hilfeartikel beschrieben: „Es öffnet sich ein
// Fenster, in dem Sie durch Klicken auf ‚Neue Werbeaktion erstellen' eine neue
// erstellen oder eine Ihrer bestehenden auf diese spezielle Vermietung anwenden
// können.").
//
// Warum ein eigener Schritt: wer zwanzig Objekte pflegt, tippt dieselbe
// Sommeraktion sonst zwanzigmal ab — mit zwanzig Chancen für einen anderen
// Prozentsatz. Die Übernahme kopiert genau die gespeicherte Aktion.
//
// Dieselbe Mechanik wie bei den Gebühren (gebuehr-auswahl.tsx); die Liste kommt
// vom Server (`/pricing/discounts/{id}/library`), weil dort der Tenant-Scope und
// die Währungsprüfung liegen — eine Pauschale aus einem DKK-Objekt ist auf einem
// EUR-Objekt keine übernehmbare Zahl (Wurzel 4).
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { EditorShell } from "@/components/objekte/editor-primitives";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import {
  applyPromotionToProperties,
  listPromotionLibrary,
  type Promotion,
  type PromotionLibraryEntry,
} from "@/lib/promotions";

export function PromotionAuswahl({
  propertyId,
  /** Kurzfassung einer Promotion — dieselbe Funktion wie in der Listenzeile,
   *  damit hier und dort dasselbe steht. */
  summary,
  /** Gastseitiger Name in der aktuellen Sprache. */
  nameOf,
  onNew,
  /** Übernahme geklappt → Liste neu laden und Dialog schließen. */
  onApplied,
  onError,
  onClose,
}: {
  propertyId: string;
  summary: (promotion: Promotion) => string;
  nameOf: (promotion: Promotion, locale: string) => string;
  onNew: () => void;
  onApplied: () => void;
  onError: (error: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const [items, setItems] = useState<PromotionLibraryEntry[]>([]);
  const [waehrungFehlt, setWaehrungFehlt] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [suche, setSuche] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await listPromotionLibrary(propertyId);
      if (res.ok) {
        setItems(res.data.items);
        setWaehrungFehlt(res.data.currency === null);
      }
      setGeladen(true);
    })();
  }, [propertyId]);

  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? items.filter((e) => nameOf(e.promotion, locale).toLowerCase().includes(q))
    : items;

  async function uebernehmen(eintrag: PromotionLibraryEntry) {
    setBusy(eintrag.promotion.id);
    // Geschrieben wird über DENSELBEN Endpunkt wie „auf weitere Objekte
    // übertragen" — aus Sicht des Servers ist es dieselbe Operation, nur mit
    // diesem Objekt als Ziel. Ein zweiter Schreibpfad wäre eine zweite Wahrheit.
    const res = await applyPromotionToProperties(
      eintrag.property_id,
      eintrag.promotion.id,
      [propertyId],
    );
    setBusy(null);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onApplied();
  }

  return (
    <EditorShell
      title={t("pricingForm.promotionsTitle")}
      subtitle={t("pricingForm.promoAssignSubtitle")}
      onClose={onClose}
    >
      <Button onClick={onNew} className="w-full">
        {t("pricingForm.promoCreateNew")}
      </Button>

      {/* Suchfeld und Liste erscheinen nur, wenn es etwas zu wählen gibt — ein
          leeres Suchfeld über einer leeren Liste ist eine Attrappe. */}
      {items.length > 0 && (
        <>
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground"
            />
            <Input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t("pricingForm.searchPromosPlaceholder")}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            {gefiltert.length === 0 ? (
              <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
                {t("pricingForm.noMatches")}
              </p>
            ) : (
              gefiltert.map((eintrag) => (
                <div
                  key={`${eintrag.property_id}:${eintrag.promotion.id}`}
                  className="flex items-start justify-between gap-3 rounded-(--radius) border border-border p-4"
                >
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold">
                      {nameOf(eintrag.promotion, locale) ||
                        t("pricingForm.promoUnnamed")}
                    </p>
                    <span className="mt-2 inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                      {summary(eintrag.promotion)}
                    </span>
                    {/* Woher sie stammt: bei „Frühbucher" ist das der Unterschied
                        zwischen zwei gleich benannten Aktionen. */}
                    {eintrag.property_title && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {t("pricingForm.feeFromProperty", {
                          title: eintrag.property_title,
                        })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    disabled={busy !== null}
                    onClick={() => void uebernehmen(eintrag)}
                  >
                    {busy === eintrag.promotion.id
                      ? t("editorPrimitives.saving")
                      : t("pricingForm.add")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Warum nichts zur Auswahl steht, wird gesagt statt weggelassen: ohne
          Objektwährung ist eine Pauschale nicht übernehmbar, und „noch nirgends
          eine Promotion angelegt" ist eine andere Aussage als „lädt noch". */}
      {geladen && items.length === 0 && (
        <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
          {waehrungFehlt
            ? t("pricingForm.promoLibraryNoCurrency")
            : t("pricingForm.promoLibraryEmpty")}
        </p>
      )}
    </EditorShell>
  );
}
