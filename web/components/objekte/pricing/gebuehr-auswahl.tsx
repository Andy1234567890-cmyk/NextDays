"use client";

// „Gebühren — Fügen Sie eine neue oder bestehende Gebühr hinzu."
//
// Der Zwischenschritt, den der Branchenstandard vor dem Gebühren-Formular
// setzt (live abgelesen 03.08.2026, `/pricing/<id>/assign-fee`): oben ein
// Primär-Button „Neue Gebühr erstellen", darunter ein Suchfeld und die Liste der
// Gebühren, die der Betrieb schon irgendwo angelegt hat — je Zeile Name,
// Kurzfassung („kr 955 Einmaliger Betrag Pro Aufenthalt") und rechts
// „Hinzufügen".
//
// Warum das ein eigener Schritt ist und nicht direkt das Formular: wer zwanzig
// Objekte pflegt, tippt dieselbe Reinigungsgebühr sonst zwanzigmal ab — mit
// zwanzig Chancen für einen anderen Betrag. Die Übernahme kopiert genau den
// gespeicherten Eintrag und gibt ihm nur eine neue Kennung.
//
// Die Liste kommt vom Server (`fee_library`), NICHT aus dem Browser
// zusammengesucht: dort liegt der Tenant-Scope, und dort wird auch die Währung
// geprüft — ein Betrag aus einem DKK-Objekt ist auf einem EUR-Objekt keine
// übernehmbare Zahl (Wurzel 4).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { EditorShell } from "@/components/objekte/editor-primitives";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import type { Fee } from "@/lib/pricing-meta";
import { listFeeLibrary, type FeeLibraryEntry } from "@/lib/properties";

export function GebuehrAuswahl({
  propertyId,
  /** Kurzfassung einer Gebühr — dieselbe Funktion, die die Listenzeile nutzt,
   *  damit hier und dort dasselbe steht. */
  summary,
  onNew,
  onPick,
  onClose,
}: {
  propertyId: string;
  summary: (fee: Fee) => string;
  onNew: () => void;
  onPick: (fee: Fee) => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [items, setItems] = useState<FeeLibraryEntry[]>([]);
  const [waehrungFehlt, setWaehrungFehlt] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const [suche, setSuche] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await listFeeLibrary(propertyId);
      if (res.ok) {
        setItems(res.data.items);
        setWaehrungFehlt(res.data.currency === null);
      }
      setGeladen(true);
    })();
  }, [propertyId]);

  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? items.filter((e) => e.fee.name.toLowerCase().includes(q))
    : items;

  return (
    <EditorShell
      title={t("pricingForm.feesTitle")}
      subtitle={t("pricingForm.feeAssignSubtitle")}
      onClose={onClose}
    >
      <Button onClick={onNew} className="w-full">
        {t("pricingForm.feeCreateNew")}
      </Button>

      {/* Suchfeld und Liste erscheinen nur, wenn es überhaupt etwas zu wählen
          gibt — ein leeres Suchfeld über einer leeren Liste ist eine Attrappe. */}
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
              placeholder={t("pricingForm.searchFeesPlaceholder")}
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
                  key={`${eintrag.property_id}:${eintrag.fee.id}`}
                  className="flex items-start justify-between gap-3 rounded-(--radius) border border-border p-4"
                >
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold">{eintrag.fee.name}</p>
                    <span className="mt-2 inline-flex w-fit items-center rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                      {summary(eintrag.fee)}
                    </span>
                    {/* Woher sie stammt: bei „Reinigungsgebühr" ist das der
                        Unterschied zwischen zwei gleich benannten Gebühren. */}
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
                    onClick={() => onPick(eintrag.fee)}
                  >
                    {t("pricingForm.add")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Warum nichts zur Auswahl steht, wird gesagt statt weggelassen: ohne
          Objektwährung ist ein Betrag nicht übernehmbar, und „noch nirgends eine
          Gebühr angelegt" ist eine andere Aussage als „lädt noch". */}
      {geladen && items.length === 0 && (
        <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
          {waehrungFehlt
            ? t("pricingForm.feeLibraryNoCurrency")
            : t("pricingForm.feeLibraryEmpty")}
        </p>
      )}
    </EditorShell>
  );
}
