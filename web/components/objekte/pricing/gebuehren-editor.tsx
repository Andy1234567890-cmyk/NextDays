"use client";

// Gebühren-Editor der Preise-Seite, im Umfang des Branchenstandards (live
// abgelesen 03.08.2026, Lodgify `/pricing/<id>/fee/<id>`):
//
//   Gebührenart (49 Arten) · Pauschalbetrag | Prozent · Wert + Währung ·
//   Berechnung (2 Achsen) · USt-Schalter mit Satz · Name · interne Beschreibung
//
// Die Kanal-Einschränkung liegt NICHT hier, sondern in einem eigenen Dialog
// (einschraenkungen-editor.tsx) — genau wie im Standard, wo sie über das
// Zeilenmenü erreichbar ist.
//
// Zwei Dinge sind dabei nicht Kosmetik, sondern Fachlogik:
//   * Die Gebührenart entscheidet, ob und als WAS die Gebühr beim Portal
//     ankommt. Die Liste kommt deshalb LIVE vom Server (eine Quelle) und wird
//     hier nicht nachgebaut.
//   * Im Prozent-Modus entfällt die Berechnung: eine prozentuale Gebühr ist
//     IMMER einmalig auf den Zimmerpreis (einschließlich Aktionen).
//
// Liegt neben steuern-editoren.tsx, statt pricing-form.tsx weiter aufzublähen.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { Input } from "@nextdays/ui/input";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import { Segmented } from "@nextdays/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { Switch } from "@nextdays/ui/switch";
import {
  type Currency,
  type Fee,
  type FeeChargeBasis,
  type FeeMode,
  type FeePeriod,
  type FeeTypeEntry,
  type Pricing,
  PET_BASIS_CATEGORIES,
  currencySymbol,
  feeBasisAchsen,
  feeBasisAus,
} from "@/lib/pricing-meta";
import { applyFeeToProperties, listFeeTypes } from "@/lib/properties";
import { ZuAnderenObjekten } from "@/components/objekte/pricing/zu-anderen-objekten";

export function GebuehrEditor({
  pr,
  propertyId,
  editId,
  vorlage,
  onSave,
  onApplyError,
  onClose,
}: {
  pr: Pricing;
  propertyId: string;
  editId?: string;
  /** Bestehende Gebühr des Betriebs als Startwert („bestehende Gebühr
   *  hinzufügen"): dieselben Felder, aber EIGENE Kennung — sonst überschriebe
   *  die Übernahme die Gebühr, aus der sie kommt. */
  vorlage?: Fee;
  onSave: (next: Pricing) => Promise<true | string>;
  /** Fehler beim Übertragen auf weitere Objekte — gemeldet an die SEITE, weil
   *  dieser Dialog nach erfolgreichem Speichern nicht mehr steht. */
  onApplyError: (error: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const vorhanden = editId ? pr.fees.find((x) => x.id === editId) : undefined;
  const [v, setV] = useState<Fee>(
    vorhanden ??
      (vorlage ? { ...vorlage, id: "" } : undefined) ?? {
        id: "",
        name: "",
        amount: 0,
        mode: "amount",
        basis: "per_stay",
        optional: false,
      },
  );
  const [ziele, setZiele] = useState<string[]>([]);
  const [arten, setArten] = useState<FeeTypeEntry[]>([]);
  // USt-Satz als eigener Schalter wie im Standard: aus = die Gebühr folgt dem
  // Übernachtungssatz des Objekts (kein erfundener eigener Satz, Wurzel 4).
  const [ustAn, setUstAn] = useState<boolean>(v.taxRate != null);
  const { busy, error, run } = useSaver(onSave);

  useEffect(() => {
    void (async () => {
      const res = await listFeeTypes();
      if (res.ok) setArten(res.data.items);
    })();
  }, []);

  const prozent = (v.mode ?? "amount") === "percent";
  const achsen = feeBasisAchsen(v.basis);
  // „Pro Tier" gibt es nur an der Haustiergebühr — der Server weist alles
  // andere ab, also darf es hier gar nicht erst wählbar sein.
  const tierBasisMoeglich = PET_BASIS_CATEGORIES.includes(
    arten.find((a) => a.value === v.feeType)?.category ?? "",
  );
  const waehrung: Currency | "" = pr.currency;

  async function commit() {
    const eintrag: Fee = {
      ...v,
      id: v.id || crypto.randomUUID(),
      // Der Schalter ist die Wahrheit: aus heißt „kein eigener Satz", nicht
      // „Satz 0" — sonst stünde 0 % USt auf der Rechnung.
      taxRate: ustAn ? (v.taxRate ?? 0) : null,
    };
    const liste = vorhanden
      ? pr.fees.map((x) => (x.id === eintrag.id ? eintrag : x))
      : [...pr.fees, eintrag];
    // Übernahme auf weitere Objekte erst NACH dem Speichern — vorher gibt es die
    // Gebühr am Quell-Objekt noch nicht. Und nur, wenn das Speichern geklappt
    // hat: sonst verteilte ein fehlgeschlagener Vorgang trotzdem Gebühren.
    //
    // Der FEHLER geht nach oben, nicht in diesen Dialog: erfolgreiches Speichern
    // schließt ihn (die Seite ruft `setSection(null)`), eine Meldung hier stünde
    // also auf einer Fläche, die es nicht mehr gibt — der Betrieb würde glauben,
    // die Gebühr liege auf allen ausgewählten Objekten.
    const ok = await run({ ...pr, fees: liste });
    if (ok && ziele.length > 0) {
      const res = await applyFeeToProperties(propertyId, eintrag.id, ziele);
      onApplyError(res.ok ? null : res.error);
    }
  }

  return (
    <EditorShell
      title={vorhanden ? t("pricingForm.feeEditTitle") : t("pricingForm.feeAddTitle")}
      subtitle={t("pricingForm.feeEditorSubtitle")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => void commit()}
          disabled={!v.name.trim() || !v.feeType}
        />
      }
    >
      <Field label={t("pricingForm.feeTypeLabel")} hint={t("pricingForm.feeTypeHint")} required>
        <Select
          value={v.feeType ?? ""}
          onValueChange={(x) =>
            setV({
              ...v,
              feeType: x,
              // Weg von der Haustiergebühr heißt weg von „pro Tier" — sonst
              // stünde eine Basis im Formular, die der Server ablehnt.
              basis:
                v.basis === "per_pet_stay" &&
                !PET_BASIS_CATEGORIES.includes(
                  arten.find((a) => a.value === x)?.category ?? "",
                )
                  ? "per_stay"
                  : v.basis,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("pricingForm.feeTypePlaceholder")} />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {arten.map((art) => (
              <SelectItem key={art.value} value={art.value}>
                {art.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.amountSectionTitle")}
        </h3>
        <Segmented
          value={v.mode ?? "amount"}
          onChange={(m) => setV({ ...v, mode: m as FeeMode })}
          variant="solid"
          block
          options={[
            { value: "amount" as const, label: t("pricingForm.feeModeAmount") },
            { value: "percent" as const, label: t("pricingForm.feeModePercent") },
          ]}
        />
        {prozent ? (
          <>
            <Field label={t("pricingForm.rateLabel")} required>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={v.amount}
                  placeholder={t("pricingForm.feePercentPlaceholder")}
                  onChange={(e) =>
                    setV({
                      ...v,
                      amount: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                    })
                  }
                  className="pr-8"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </Field>
            {/* Im Prozent-Modus gibt es KEINE Berechnungsfelder: die Gebühr ist
                einmalig auf den Zimmerpreis. Genau so führt es der Standard. */}
            <p className="text-sm text-muted-foreground">
              {t("pricingForm.feePercentHint")}
            </p>
          </>
        ) : (
          <>
            <Field label={t("pricingForm.amountLabel")} required>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={v.amount}
                  onChange={(e) => setV({ ...v, amount: Number(e.target.value) || 0 })}
                />
                {/* Währung kommt aus dem Objekt, ist hier keine Wahl. Ohne
                    gewählte Objektwährung bleibt die Fläche leer statt „€". */}
                <span className="min-w-8 text-sm text-muted-foreground">
                  {currencySymbol(waehrung)}
                </span>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={achsen.charge}
                onValueChange={(val) =>
                  setV({
                    ...v,
                    basis: feeBasisAus(val as FeeChargeBasis, achsen.period),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SingleCharge">
                    {t("pricingForm.chargeSingle")}
                  </SelectItem>
                  <SelectItem value="PerPerson">
                    {t("pricingForm.chargePerPerson")}
                  </SelectItem>
                  {tierBasisMoeglich && (
                    <SelectItem value="PerPet">
                      {t("pricingForm.chargePerPet")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select
                value={achsen.period}
                disabled={achsen.charge === "PerPet"}
                onValueChange={(val) =>
                  setV({
                    ...v,
                    basis: feeBasisAus(achsen.charge, val as FeePeriod),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PerStay">{t("pricingForm.periodPerStay")}</SelectItem>
                  <SelectItem value="PerNight">
                    {t("pricingForm.periodPerNight")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="font-display text-lg font-extrabold">
            {t("pricingForm.vatLabel")}
          </span>
          <Switch
            checked={ustAn}
            onCheckedChange={(c) => {
              setUstAn(c);
              if (!c) setV({ ...v, taxRate: null });
            }}
          />
        </label>
        {ustAn && (
          <>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={v.taxRate ?? 0}
                onChange={(e) =>
                  setV({
                    ...v,
                    taxRate: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="pr-8"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                %
              </span>
            </div>
            {/* Steckt der Satz schon im Betrag oder kommt er obendrauf? Der
                Standard fragt es genau hier. Ohne die Angabe wäre der Betrag
                zweideutig — und der Betrieb müsste raten, was auf der Rechnung
                herauskommt. Standard ist „inklusive" (bisheriges Verhalten). */}
            <Select
              value={(v.taxIncluded ?? true) ? "included" : "excluded"}
              onValueChange={(val) => setV({ ...v, taxIncluded: val === "included" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="included">{t("pricingForm.vatIncluded")}</SelectItem>
                <SelectItem value="excluded">{t("pricingForm.vatExcluded")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="font-display text-lg font-extrabold">
            {t("pricingForm.feeShortStayOnlyLabel")}
          </span>
          <Switch
            checked={v.shortStayOnly ?? false}
            onCheckedChange={(c) => setV({ ...v, shortStayOnly: c })}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.feeShortStayOnlyHint")}
        </p>
        {/* „Kurz" ist keine zweite Zahl an der Gebühr, sondern die EINE Grenze
            des Objekts. Ist sie nicht gepflegt, greift die Gebühr nie — das
            muss hier stehen, sonst sieht der Schalter aktiv aus und wirkt nicht. */}
        {v.shortStayOnly &&
          (pr.shortStayMaxNights > 0 ? (
            <Hint>
              {t("pricingForm.feeShortStayOnlyBound", {
                nights: pr.shortStayMaxNights,
              })}
            </Hint>
          ) : (
            <Hint>{t("pricingForm.feeShortStayOnlyMissing")}</Hint>
          ))}
      </section>

      <Field label={t("pricingForm.nameLabel")} required>
        <Input
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          placeholder={t("pricingForm.feeNamePlaceholder")}
        />
      </Field>
      <RichTextEditor
        value={v.descriptionHtml ?? ""}
        onChange={(html) => setV({ ...v, descriptionHtml: html })}
        placeholder={t("pricingForm.internalDescriptionPlaceholder")}
      />

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.feeOptionalLabel")}</span>
        <Switch
          checked={v.optional}
          onCheckedChange={(c) => setV({ ...v, optional: c })}
        />
      </label>
      {v.optional && <Hint>{t("pricingForm.feeOptionalHint")}</Hint>}

      <ZuAnderenObjekten
        propertyId={propertyId}
        kind="fee"
        selected={ziele}
        onChange={setZiele}
      />
    </EditorShell>
  );
}
