"use client";

// „Preise von einem anderen Objekt übernehmen" — Branchenstandard im Seitenmenü
// der Preise-Seite (live abgelesen 04.08.2026, Lodgify `/pricing/<id>` → ⋯:
// „Preise einer bestehenden Unterkunft kopieren"). Wer zehn gleich ausgestattete
// Ferienhäuser führt, richtet Gebühren, Steuern und Aufschläge sonst zehnmal von
// Hand ein.
//
// Der Dialog sagt AN, was übernommen wird und was nicht (Aktionen, Verfügbarkeit)
// — genau wie im Standard. Ein Kopieren, das stillschweigend die Hälfte weglässt,
// wäre schlimmer als keins: der Betrieb hielte das Ziel-Objekt für fertig.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Icon } from "@iconify/react";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  useSaver,
} from "@/components/objekte/editor-primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { copyPricingFrom, listProperties, type Property } from "@/lib/properties";

export function PreiseUebernehmen({
  propertyId,
  onDone,
  onClose,
}: {
  propertyId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [objekte, setObjekte] = useState<Property[] | null>(null);
  const [quelle, setQuelle] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const res = await listProperties();
      // Bei Fehler bleibt die Liste LEER, nicht „keine weiteren Objekte": ein
      // nicht ladbares Portfolio darf nicht wie ein leeres aussehen (Wurzel 4).
      setObjekte(res.ok ? res.data.items.filter((p) => p.id !== propertyId) : []);
    })();
  }, [propertyId]);

  const { busy, error, run } = useSaver(async (): Promise<true | string> => {
    const res = await copyPricingFrom(propertyId, quelle);
    if (!res.ok) return res.error;
    onDone();
    return true;
  });

  return (
    <EditorShell
      title={t("pricingForm.copyPricingTitle")}
      subtitle={t("pricingForm.copyPricingSubtitle")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => void run()}
          saveLabel={t("pricingForm.copyPricingAction")}
          disabled={!quelle}
        />
      }
    >
      <Field label={t("pricingForm.copyPricingSourceLabel")} required>
        <Select value={quelle || undefined} onValueChange={setQuelle}>
          <SelectTrigger>
            <SelectValue placeholder={t("pricingForm.copyPricingSourcePlaceholder")} />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {(objekte ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {objekte !== null && objekte.length === 0 && (
        <Hint>{t("pricingForm.copyPricingNoSource")}</Hint>
      )}

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("pricingForm.copyPricingIncludes")}</p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {[
            "copyPricingItemBase",
            "copyPricingItemSurcharges",
            "copyPricingItemLength",
            "copyPricingItemFees",
            "copyPricingItemTaxes",
          ].map((key) => (
            <li key={key} className="flex items-start gap-2">
              <Icon icon="ph:check" className="mt-0.5 size-4 shrink-0" />
              <span>{t(`pricingForm.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("pricingForm.copyPricingExcludes")}</p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {["copyPricingSkipPromos", "copyPricingSkipExtras", "copyPricingSkipAvailability"].map(
            (key) => (
              <li key={key} className="flex items-start gap-2">
                <Icon icon="ph:minus" className="mt-0.5 size-4 shrink-0" />
                <span>{t(`pricingForm.${key}`)}</span>
              </li>
            ),
          )}
        </ul>
      </section>

      <Hint>{t("pricingForm.copyPricingOverwriteWarning")}</Hint>
    </EditorShell>
  );
}
