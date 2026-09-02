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

import { Icon } from "@iconify/react";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  SectionTitle,
  SwitchRow,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
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
import { type Locale, LOCALES, LOCALE_LABELS } from "@/i18n/locales";
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
  const [sprache, setSprache] = useState<Locale>("de");
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
  // „Gilt bis" vor „gilt ab": der Server weist es mit 422 ab — hier wird der
  // Speichern-Knopf gesperrt und der Grund genannt, statt eine Fehlermeldung
  // nach dem Klick zu zeigen.
  const zeitraumVerkehrt = Boolean(
    v.validFrom && v.validUntil && v.validUntil < v.validFrom,
  );

  /** Gastseitiger Name in der offenen Sprache. Der INTERNE `name` folgt der
   *  deutschen Eingabe, damit Listen und Bestands-Rechnungen einen Namen haben,
   *  auch ohne Übersetzungen — dieselbe Regel wie bei der lokalen Steuer. */
  const setzeName = (text: string) =>
    setV((alt) => ({
      ...alt,
      names: { ...(alt.names ?? {}), [sprache]: text },
      // Auch die ERSTE gepflegte Sprache füllt den internen Namen, wenn er noch
      // leer ist: der Server verlangt ihn (422), und wer nur Dänisch pflegt,
      // stünde sonst vor einem Speichern-Knopf, der nicht sagt, was fehlt.
      name: sprache === "de" || !alt.name.trim() ? text : alt.name,
    }));

  async function commit() {
    const eintrag: Fee = {
      ...v,
      id: v.id || crypto.randomUUID(),
      // Leere Grenzen nicht als "" mitschicken — der Server ließe sie weg, der
      // Zustand hier soll aber dasselbe sagen wie das Gespeicherte.
      validFrom: v.validFrom || undefined,
      validUntil: v.validUntil || undefined,
      ownerStatementOnly: v.ownerStatementOnly || undefined,
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
          disabled={!v.name.trim() || !v.feeType || zeitraumVerkehrt}
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
        {/* Der Prozent-Hinweis („immer einmalig auf den Zimmerpreis") gehört zu
            DIESEM Abschnitt und steht deshalb an seiner Überschrift — nur im
            Prozent-Modus, weil er im Betrags-Modus nichts erklärt. */}
        <SectionTitle hint={prozent ? t("pricingForm.feePercentHint") : undefined}>
          {t("pricingForm.amountSectionTitle")}
        </SectionTitle>
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
            {/* Eine Haustiergebühr setzt ein Tier voraus — in JEDER
                Berechnungsart, auch als Pauschale. Der Hinweis hängt an der
                Berechnung, weil genau dort die falsche Annahme entsteht („die
                Pauschale bekommt jeder Gast"). */}
            <Field
              label={t("pricingForm.feeCalculationLabel")}
              hint={
                tierBasisMoeglich ? t("pricingForm.feePetsOnlyNote") : undefined
              }
            >
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
            </Field>
          </>
        )}
        {/* Eine Haustiergebühr setzt ein Tier voraus — in JEDER Berechnungsart,
            auch als Pauschale. Das steht hier, weil der Betrieb sonst annimmt,
            die Pauschale werde jedem Gast berechnet (so war es bis 23.08.2026,
            und niemandem fiel es auf: 150 kr sehen auf einer Rechnung
            unauffällig aus). Kein Schalter, sondern eine Aussage: die Umkehrung
            „auch ohne Tier erheben" hat keinen fachlichen Fall. */}
      </section>

      <section className="flex flex-col gap-3">
        <SwitchRow
          label={t("pricingForm.vatLabel")}
          hint={t("pricingForm.feeVatHint")}
          checked={ustAn}
          onCheckedChange={(c) => {
            setUstAn(c);
            if (!c) setV({ ...v, taxRate: null });
          }}
        />
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
            {/* Steckt der Satz schon im Betrag oder kommt er obendrauf? Ohne
                die Angabe wäre der Betrag zweideutig. Standard ist „inklusive"
                (bisheriges Verhalten). */}
            <Field
              label={t("pricingForm.feeVatIncludedLabel")}
              hint={t("pricingForm.feeVatIncludedHint")}
            >
              <Select
                value={(v.taxIncluded ?? true) ? "included" : "excluded"}
                onValueChange={(val) => setV({ ...v, taxIncluded: val === "included" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="included">
                    {t("pricingForm.vatIncluded")}
                  </SelectItem>
                  <SelectItem value="excluded">
                    {t("pricingForm.vatExcluded")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SwitchRow
          label={t("pricingForm.feeShortStayOnlyLabel")}
          hint={t("pricingForm.feeShortStayOnlyHint")}
          checked={v.shortStayOnly ?? false}
          onCheckedChange={(c) => setV({ ...v, shortStayOnly: c })}
        />
        {/* Diese zwei bleiben SICHTBAR und wandern nicht hinter das „i": sie
            gelten nur bei eingeschaltetem Schalter und sagen, ob er überhaupt
            wirkt. Hinter einem Symbol versteckt sähe ein Schalter aktiv aus,
            der ohne gepflegte Kurzaufenthalts-Grenze nichts tut. */}
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

      <section className="flex flex-col gap-3">
        <SectionTitle hint={t("pricingForm.feeValidityHint")}>
          {t("pricingForm.feeValidityTitle")}
        </SectionTitle>
        {/* Maß ist die ANREISE der Buchung, nicht das Buchungsdatum — der Server
            rechnet genauso (gebuehr_gilt_am). Leer = ohne Grenze. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("pricingForm.feeValidFromLabel")}>
            <Input
              type="date"
              value={v.validFrom ?? ""}
              onChange={(e) => setV({ ...v, validFrom: e.target.value || null })}
            />
          </Field>
          <Field label={t("pricingForm.feeValidUntilLabel")}>
            <Input
              type="date"
              value={v.validUntil ?? ""}
              onChange={(e) => setV({ ...v, validUntil: e.target.value || null })}
            />
          </Field>
        </div>
        {zeitraumVerkehrt && <Hint>{t("pricingForm.feeValidityOrderError")}</Hint>}
      </section>

      <section className="flex flex-col gap-2">
        <SwitchRow
          label={t("pricingForm.feeOwnerStatementOnlyLabel")}
          hint={t("pricingForm.feeOwnerStatementOnlyHint")}
          checked={v.ownerStatementOnly ?? false}
          onCheckedChange={(c) => setV({ ...v, ownerStatementOnly: c })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle hint={t("pricingForm.guestFacingNameHint")}>
          {t("pricingForm.guestFacingNameTitle")}
        </SectionTitle>
        {/* 24 EU-Amtssprachen als Dropdown, genau wie im Steuer-Editor. Die
            Gebühr steht in der Preisaufschlüsselung des Gastes — ohne
            Übersetzung liest ein dänischer Gast „Reinigungsgebühr". */}
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                {LOCALE_LABELS[sprache]}
                <Icon icon="ph:caret-down" className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {LOCALES.map((l) => (
                <DropdownMenuItem key={l} onClick={() => setSprache(l)}>
                  {LOCALE_LABELS[l]}
                  {v.names?.[l]?.trim() && (
                    <Icon icon="ph:check" className="ml-auto size-4 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs text-muted-foreground">
            {t("pricingForm.languagesFilled", {
              count: Object.values(v.names ?? {}).filter((x) => x?.trim()).length,
              total: LOCALES.length,
            })}
          </span>
        </div>
        <Field label={t("pricingForm.nameLabel")} required>
          <Input
            value={v.names?.[sprache] ?? (sprache === "de" ? v.name : "")}
            onChange={(e) => setzeName(e.target.value)}
            placeholder={t("pricingForm.feeNamePlaceholder")}
          />
        </Field>
        <RichTextEditor
          value={v.descriptionHtml ?? ""}
          onChange={(html) => setV({ ...v, descriptionHtml: html })}
          placeholder={t("pricingForm.internalDescriptionPlaceholder")}
        />
      </section>

      <SwitchRow
        size="sm"
        label={t("pricingForm.feeOptionalLabel")}
        hint={t("pricingForm.feeOptionalHint")}
        checked={v.optional}
        onCheckedChange={(c) => setV({ ...v, optional: c })}
      />

      <ZuAnderenObjekten
        propertyId={propertyId}
        kind="fee"
        selected={ziele}
        onChange={setZiele}
      />
    </EditorShell>
  );
}
