"use client";

// Richtlinien-Seite eines Objekts (Policies).
//  Reservation policies: Policy (Storno/Zahlung/Kaution), Bookability,
//  Check-in/out-Zeiten. Website legal info: Rates-Info, Mietvertrag.
// Bearbeitung je Block über einen Sheet-Editor; gespeichert wird per
// updateProperty() in das flexible Feld type_attributes.policies.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  EditorShell,
  Empty,
  Field,
  Footer,
  Hint,
  Pill,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { LocalizedTextEditor } from "@/components/objekte/localized-text-editor";
import { PortalReichweite } from "@/components/objekte/pricing/portal-reichweite";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  type AmountType,
  type CancellationType,
  type DepositMethod,
  type LocalizedText,
  type PaymentPlan,
  type Policies,
  type Policy,
  type PreAuthPeriod,
  type RefundRule,
  type RefundType,
  type SchedulePeriod,
  AMOUNT_TYPE_OPTIONS,
  BOOKABILITY_LABELS,
  BOOKABILITY_OPTIONS,
  CANCELLATION_OPTIONS,
  DEFAULT_POLICY,
  DEFAULT_REFUND_RULE,
  DEPOSIT_METHOD_OPTIONS,
  HOUR_OPTIONS,
  LANG_FLAGS,
  LANG_LABELS,
  LANGS,
  PAYMENT_PLAN_OPTIONS,
  PRE_AUTH_PERIOD_OPTIONS,
  PRE_AUTH_VALIDITY_DAYS,
  REFUND_TYPE_OPTIONS,
  SCHEDULE_PERIOD_OPTIONS,
  cancellationSummary,
  depositSummary,
  formatHour,
  hasAnyText,
  paymentPlanSummary,
  readPolicies,
  stripHtml,
} from "@/lib/policy-meta";
import { type AbgabePostenStatus, getAbgabenStatus } from "@/lib/channex";
import { type Property, updateProperty } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

/** Was `PortalReichweite` je Editor braucht: der geladene Sync-Stand und die
 *  verbundenen Portale. `null` = nicht ladbar → die Zeile bleibt weg. */
type Reichweite = { status: AbgabePostenStatus[] | null; portale: string[] };

type Section =
  | "policy"
  | "policyEdit"
  | "bookability"
  | "times"
  | "rates"
  | "agreement"
  | null;

// Betrag mit Objekt-Währung formatieren; ohne gültigen Code reine Zahl (kein
// erfundenes € — Projektregel: keine Fallback-Ersatzwerte, kein €-Hardcode).
function money(amount: number, currency: string | null | undefined, locale: string): string {
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const valid = /^[A-Z]{3}$/.test(code);
  return amount.toLocaleString(locale, valid ? { style: "currency", currency: code } : {});
}

export function PoliciesForm({
  initial,
  currency,
}: {
  initial: Property;
  currency: string | null;
}) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const pol = readPolicies(p.type_attributes);
  const geld = (amount: number) => money(amount, currency, locale);

  // „Gilt für / Nicht unterstützt von" je Editor — dieselbe Quelle wie auf der
  // Preise-Seite (`ota_abgaben` über `getAbgabenStatus`). Ohne diese Zeile sieht
  // jede Eingabe gleich verbindlich aus, auch die, die kein Portal je sieht:
  // Airbnb nimmt die Check-in-Zeit, Booking.com pflegt sie im Extranet.
  const [abgaben, setAbgaben] = useState<{ portals: string[]; items: AbgabePostenStatus[] } | null>(null);
  const loadAbgaben = useCallback(async () => {
    const res = await getAbgabenStatus(p.id);
    // Fehler → LEER, nicht „alles synchron" (Wurzel 4).
    setAbgaben(res.ok ? res.data : null);
  }, [p.id]);
  useEffect(() => {
    void loadAbgaben();
  }, [loadAbgaben]);
  // Verbindet/trennt der Betrieb ein Portal, ändert sich die Aussage.
  useRealtime({
    table: "channex_channel_connection",
    filter: `property_id=eq.${p.id}`,
    onChange: () => void loadAbgaben(),
  });
  const reichweite: Reichweite = {
    status: abgaben?.items ?? null,
    portale: abgaben?.portals ?? [],
  };

  async function save(next: Policies): Promise<true | string> {
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, policies: next },
    });
    if (res.ok) {
      setP(res.data);
      setSection(null);
      return true;
    }
    return res.error;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-3xl font-extrabold">{t("policiesForm.title")}</h1>

      {/* Reservation policies */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">{t("policiesForm.reservationPoliciesHeading")}</h2>

        <BlockCard
          title={t("policiesForm.policyCardTitle")}
          hint={t("policiesForm.policyCardHint")}
          action={{
            kind: "menu",
            items: [
              {
                label: t("policiesForm.editAction"),
                icon: "ph:pencil-simple",
                onSelect: () => setSection("policyEdit"),
              },
              {
                label: t("policiesForm.assignAction"),
                icon: "ph:link-simple",
                onSelect: () => setSection("policy"),
              },
            ],
          }}
        >
          {pol.policy.internalName.trim() ? (
            <div className="flex flex-col gap-2.5 rounded-(--radius) bg-muted/40 p-4 text-sm">
              <p>{pol.policy.internalName}</p>
              <p>{cancellationSummary(pol.policy, geld)}</p>
              <p>{paymentPlanSummary(pol.policy, geld)}</p>
              {pol.policy.depositRequired && <p>{depositSummary(pol.policy, geld)}</p>}
            </div>
          ) : (
            <Empty>{t("policiesForm.noPolicyYet")}</Empty>
          )}
        </BlockCard>

        <BlockCard
          title={t("policiesForm.bookabilityCardTitle")}
          hint={t("policiesForm.bookabilityCardHint")}
          action={{ kind: "pencil", onEdit: () => setSection("bookability") }}
        >
          <Pill>{BOOKABILITY_LABELS[pol.bookability]}</Pill>
        </BlockCard>

        <BlockCard
          title={t("policiesForm.timesCardTitle")}
          hint={t("policiesForm.timesCardHint")}
          action={{ kind: "pencil", onEdit: () => setSection("times") }}
        >
          <Pill>
            {t("policiesForm.checkInOutPill", { checkIn: formatHour(pol.checkInTime), checkOut: formatHour(pol.checkOutTime) })}
          </Pill>
        </BlockCard>
      </section>

      {/* Website legal info */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">{t("policiesForm.legalInfoHeading")}</h2>

        <BlockCard
          title={t("policiesForm.ratesInfoCardTitle")}
          action={
            hasAnyText(pol.ratesInfo)
              ? { kind: "pencil", onEdit: () => setSection("rates") }
              : { kind: "add", label: t("policiesForm.addAction"), onEdit: () => setSection("rates") }
          }
          hint={t("policiesForm.ratesInfoCardHint")}
        >
          {hasAnyText(pol.ratesInfo) ? (
            <LocalizedPreview value={pol.ratesInfo} />
          ) : (
            <Empty>{t("policiesForm.noAdditionalInfo")}</Empty>
          )}
        </BlockCard>

        <BlockCard
          title={t("policiesForm.rentalAgreementCardTitle")}
          hint={t("policiesForm.rentalAgreementCardHint")}
          action={
            hasAnyText(pol.rentalAgreement)
              ? { kind: "pencil", onEdit: () => setSection("agreement") }
              : { kind: "add", label: t("policiesForm.addAction"), onEdit: () => setSection("agreement") }
          }
        >
          {hasAnyText(pol.rentalAgreement) ? (
            <LocalizedPreview value={pol.rentalAgreement} clamp />
          ) : (
            <Empty>{t("policiesForm.noRentalAgreementYet")}</Empty>
          )}
        </BlockCard>
      </section>

      {/* Editoren */}
      {(section === "policy" || section === "policyEdit") && (
        <PolicyEditor
          pol={pol}
          direkt={section === "policyEdit"}
          onSave={save}
          onClose={() => setSection(null)}
          currency={currency}
          t={t}
        />
      )}
      {section === "bookability" && <BookabilityEditor pol={pol} onSave={save} onClose={() => setSection(null)} reichweite={reichweite} t={t} />}
      {section === "times" && <TimesEditor pol={pol} onSave={save} onClose={() => setSection(null)} reichweite={reichweite} t={t} />}
      {section === "rates" && <LocalizedEditor title={t("policiesForm.ratesInfoCardTitle")} field="ratesInfo" pol={pol} onSave={save} onClose={() => setSection(null)} t={t} />}
      {section === "agreement" && <LocalizedEditor title={t("policiesForm.rentalAgreementCardTitle")} field="rentalAgreement" pol={pol} onSave={save} onClose={() => setSection(null)} t={t} />}
    </div>
  );
}

// --- Karten/Bausteine ------------------------------------------------------

/** Aktion oben rechts auf einer Karte. Der Standard führt hier DREI Formen und
 *  nicht einen Button überall (live abgelesen 05.08.2026): ein Stift, wenn es
 *  genau eine Bearbeitung gibt; ein Kebab, wenn es mehrere Wege gibt
 *  (bearbeiten/zuweisen/löschen); ein Textlink „Hinzufügen", solange nichts
 *  hinterlegt ist. Die Form sagt dem Betrieb also schon vor dem Klick, was ihn
 *  erwartet. */
type KartenAktion =
  | { kind: "pencil"; onEdit: () => void }
  | { kind: "add"; label: string; onEdit: () => void }
  | { kind: "menu"; items: { label: string; icon: string; onSelect: () => void }[] };

function BlockCard({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint: string;
  action: KartenAktion;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="leading-tight">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
        {action.kind === "pencil" && (
          <Button variant="ghost" size="icon" onClick={action.onEdit} aria-label={title}>
            <Icon icon="ph:pencil-simple" className="size-5" />
          </Button>
        )}
        {action.kind === "add" && (
          <button
            type="button"
            onClick={action.onEdit}
            className="shrink-0 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            {action.label}
          </button>
        )}
        {action.kind === "menu" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={title}>
                <Icon icon="ph:dots-three-vertical-bold" className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {action.items.map((i) => (
                <DropdownMenuItem key={i.label} onSelect={i.onSelect}>
                  <Icon icon={i.icon} className="size-4" />
                  {i.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {children}
    </Card>
  );
}

// --- Editoren ---------------------------------------------------------------

// „Richtlinie zuweisen": bestehende Richtlinie wählen ODER neue anlegen
// (öffnet das Add-policy-Formular). Wir führen genau EINE Richtlinie pro
// Objekt (am Objekt gespeichert) — „Neue Richtlinie" überschreibt sie.
function PolicyEditor({
  pol,
  direkt,
  onSave,
  onClose,
  currency,
  t,
}: {
  pol: Policies;
  /** true = direkt im Bearbeiten-Formular öffnen (Kebab „Bearbeiten"), statt
   *  in der Zuweisungs-Liste. */
  direkt: boolean;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
  currency: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const locale = useLocale();
  const [creating, setCreating] = useState(direkt);
  const [v, setV] = useState<Policy>(pol.policy);
  const { busy, error, run } = useSaver(onSave);
  const geld = (amount: number) => money(amount, currency, locale);

  if (creating) {
    const zeigtProzent = v.firstAmountType !== "fixed";
    const zeigtBetrag = v.firstAmountType !== "percentage";
    const kautionProzent = v.depositAmountType !== "fixed";
    const kautionBetrag = v.depositAmountType !== "percentage";
    const setzeRegel = (i: number, teil: Partial<RefundRule>) =>
      setV({ ...v, refundRules: v.refundRules.map((r, n) => (n === i ? { ...r, ...teil } : r)) });

    return (
      <EditorShell
        title={t("policiesForm.editPolicyTitle")}
        subtitle={t("policiesForm.addPolicySubtitle")}
        onClose={onClose}
        footer={
          <Footer
            busy={busy}
            error={error}
            onCancel={() => (direkt ? onClose() : setCreating(false))}
            onSave={() => run({ ...pol, policy: v })}
            disabled={!v.internalName.trim()}
          />
        }
      >
        <Field label={t("policiesForm.internalNameLabel")} required>
          <Input
            value={v.internalName}
            onChange={(e) => setV({ ...v, internalName: e.target.value })}
            placeholder={t("policiesForm.internalNamePlaceholder")}
          />
        </Field>

        {/* Zahlungsplan */}
        <Group title={t("policiesForm.paymentPlanGroupTitle")}>
          <Field label={t("policiesForm.paymentCountLabel")}>
            <Auswahl
              value={v.paymentPlan}
              onChange={(val) => setV({ ...v, paymentPlan: val as PaymentPlan })}
              options={PAYMENT_PLAN_OPTIONS}
            />
          </Field>

          {v.paymentPlan === "one" ? (
            <Hint>{t("policiesForm.singlePaymentHint")}</Hint>
          ) : (
            <>
              <SubHeading>{t("policiesForm.firstPaymentHeading")}</SubHeading>
              {/* Bei drei Zahlungen sind die Teilbeträge immer Prozente — ein
                  Pauschalbetrag ließe den Rest nicht mehr eindeutig aufteilen. */}
              {v.paymentPlan === "two" && (
                <Field label={t("policiesForm.amountTypeLabel")}>
                  <Auswahl
                    value={v.firstAmountType}
                    onChange={(val) => setV({ ...v, firstAmountType: val as AmountType })}
                    options={AMOUNT_TYPE_OPTIONS}
                  />
                </Field>
              )}
              {(v.paymentPlan === "three" || zeigtProzent) && (
                <Field label={t("policiesForm.percentLabel")} required>
                  <ZahlMitEinheit
                    value={v.firstPercent}
                    onChange={(n) => setV({ ...v, firstPercent: n })}
                    einheit="%"
                    max={100}
                  />
                </Field>
              )}
              {v.paymentPlan === "two" && zeigtBetrag && (
                <BetragUndWaehrung
                  value={v.firstAmount}
                  onChange={(n) => setV({ ...v, firstAmount: n })}
                  currency={currency}
                  t={t}
                />
              )}
              <Hint>{t("policiesForm.firstPaymentHint")}</Hint>

              <SubHeading>{t("policiesForm.secondPaymentHeading")}</SubHeading>
              {v.paymentPlan === "three" && (
                <Field label={t("policiesForm.percentLabel")} required>
                  <ZahlMitEinheit
                    value={v.secondPercent}
                    onChange={(n) => setV({ ...v, secondPercent: n })}
                    einheit="%"
                    max={100}
                  />
                </Field>
              )}
              <p className="text-sm text-muted-foreground">{t("policiesForm.remainderHint")}</p>
              <TerminZeile
                tage={v.secondDays}
                onTage={(n) => setV({ ...v, secondDays: n })}
                periode={v.secondPeriod}
                onPeriode={(p) => setV({ ...v, secondPeriod: p })}
                // „Nicht einplanen" gibt es nur für die LETZTE Zahlung.
                mitNichtEinplanen={v.paymentPlan === "two"}
                t={t}
              />

              {v.paymentPlan === "three" && (
                <>
                  <SubHeading>{t("policiesForm.thirdPaymentHeading")}</SubHeading>
                  <p className="text-sm text-muted-foreground">{t("policiesForm.remainderHint")}</p>
                  <TerminZeile
                    tage={v.thirdDays}
                    onTage={(n) => setV({ ...v, thirdDays: n })}
                    periode={v.thirdPeriod}
                    onPeriode={(p) => setV({ ...v, thirdPeriod: p })}
                    mitNichtEinplanen
                    t={t}
                  />
                </>
              )}
            </>
          )}
        </Group>

        {/* Gast-Stornierung */}
        <Group title={t("policiesForm.guestCancellationGroupTitle")}>
          <Field label={t("policiesForm.cancellationTypeLabel")}>
            <Auswahl
              value={v.cancellationType}
              onChange={(val) => {
                const art = val as CancellationType;
                setV({
                  ...v,
                  cancellationType: art,
                  refundRules:
                    art === "partial" && v.refundRules.length === 0
                      ? [{ ...DEFAULT_REFUND_RULE }]
                      : v.refundRules,
                });
              }}
              options={CANCELLATION_OPTIONS}
            />
          </Field>

          {v.cancellationType === "partial" ? (
            <>
              <p className="text-sm text-muted-foreground">{t("policiesForm.partialRulesHint")}</p>
              {v.refundRules.map((r, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <SubHeading>{t("policiesForm.ruleHeading", { number: i + 1 })}</SubHeading>
                    {i > 0 && (
                      <button
                        type="button"
                        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() =>
                          setV({ ...v, refundRules: v.refundRules.filter((_, n) => n !== i) })
                        }
                      >
                        {t("policiesForm.ruleDelete")}
                      </button>
                    )}
                  </div>
                  <Field label={t("policiesForm.refundTypeLabel")}>
                    <Auswahl
                      value={r.refundType}
                      onChange={(val) => setzeRegel(i, { refundType: val as RefundType })}
                      options={REFUND_TYPE_OPTIONS}
                    />
                  </Field>
                  <Field label={t("policiesForm.refundLabel")} required>
                    <ZahlMitEinheit
                      value={r.value}
                      onChange={(n) => setzeRegel(i, { value: n })}
                      einheit={r.refundType === "flat" ? (currency ?? "") : "%"}
                      max={r.refundType === "flat" ? undefined : 100}
                    />
                  </Field>
                  <Field label={t("policiesForm.whenCancelledLabel")} required>
                    <ZahlMitEinheit
                      value={r.daysBefore}
                      onChange={(n) => setzeRegel(i, { daysBefore: n })}
                    />
                  </Field>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setV({ ...v, refundRules: [...v.refundRules, { ...DEFAULT_REFUND_RULE }] })
                }
              >
                <Icon icon="ph:plus" className="size-4" />
                {t("policiesForm.ruleAdd")}
              </Button>
            </>
          ) : (
            <Hint>{CANCELLATION_OPTIONS.find((o) => o.value === v.cancellationType)?.info}</Hint>
          )}
        </Group>

        {/* Kaution */}
        <Group title={t("policiesForm.depositGroupTitle")}>
          <Auswahl
            className="w-fit"
            value={v.depositRequired ? "required" : "not_required"}
            onChange={(val) => setV({ ...v, depositRequired: val === "required" })}
            options={[
              { value: "not_required", label: t("policiesForm.depositNotRequired") },
              { value: "required", label: t("policiesForm.depositRequired") },
            ]}
          />
          {v.depositRequired && (
            <>
              <Field label={t("policiesForm.depositMethodLabel")}>
                <Auswahl
                  value={v.depositMethod}
                  onChange={(val) => setV({ ...v, depositMethod: val as DepositMethod })}
                  options={DEPOSIT_METHOD_OPTIONS}
                />
              </Field>
              <Hint>{DEPOSIT_METHOD_OPTIONS.find((o) => o.value === v.depositMethod)?.info}</Hint>

              <Field label={t("policiesForm.amountTypeLabel")}>
                <Auswahl
                  value={v.depositAmountType}
                  onChange={(val) => setV({ ...v, depositAmountType: val as AmountType })}
                  options={AMOUNT_TYPE_OPTIONS}
                />
              </Field>
              {kautionProzent && (
                <Field label={t("policiesForm.percentLabel")}>
                  <ZahlMitEinheit
                    value={v.depositPercentOfBooking}
                    onChange={(n) => setV({ ...v, depositPercentOfBooking: n })}
                    einheit="%"
                    max={100}
                  />
                </Field>
              )}
              {kautionBetrag && (
                <BetragUndWaehrung
                  value={v.depositAmount}
                  onChange={(n) => setV({ ...v, depositAmount: n })}
                  currency={currency}
                  t={t}
                />
              )}

              {v.depositMethod === "card" && (
                <>
                  <SubHeading>{t("policiesForm.preAuthTimesHeading")}</SubHeading>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("policiesForm.daysLabel")}>
                      <Auswahl
                        value={String(v.preAuthDays)}
                        onChange={(val) => setV({ ...v, preAuthDays: Number(val) })}
                        options={[
                          { value: "0", label: "0" },
                          { value: "1", label: "1" },
                        ]}
                      />
                    </Field>
                    <Field label={t("policiesForm.periodLabel")}>
                      <Auswahl
                        value={v.preAuthPeriod}
                        onChange={(val) => setV({ ...v, preAuthPeriod: val as PreAuthPeriod })}
                        options={PRE_AUTH_PERIOD_OPTIONS}
                      />
                    </Field>
                  </div>
                  <Field label={t("policiesForm.preAuthValidityLabel")}>
                    <Auswahl
                      value={String(v.preAuthValidityDays)}
                      onChange={(val) => setV({ ...v, preAuthValidityDays: Number(val) })}
                      options={PRE_AUTH_VALIDITY_DAYS.map((d) => ({
                        value: String(d),
                        label: String(d),
                      }))}
                    />
                  </Field>
                  <Warn title={t("policiesForm.preAuthWarnTitle")}>
                    {t("policiesForm.preAuthWarnBody")}
                  </Warn>
                </>
              )}
            </>
          )}
        </Group>

        {/* Angebotsgültigkeit */}
        <Group title={t("policiesForm.quoteValidityGroupTitle")}>
          <Field label={t("policiesForm.quoteValidityHoursLabel")} required>
            <Input
              type="number"
              min={1}
              value={v.quoteValidityHours}
              onChange={(e) => setV({ ...v, quoteValidityHours: Number(e.target.value) || 0 })}
            />
          </Field>
          <Hint>{t("policiesForm.quoteValidityHint", { hours: v.quoteValidityHours })}</Hint>
        </Group>
      </EditorShell>
    );
  }

  // Zuweisungs-Ansicht: aktuelle Richtlinie + „Neue Richtlinie".
  const p = pol.policy;
  const hasPolicy = !!p.internalName.trim();
  return (
    <EditorShell
      title={t("policiesForm.assignPolicyTitle")}
      subtitle={t("policiesForm.assignPolicySubtitle")}
      onClose={onClose}
      footer={
        <Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(pol)} />
      }
    >
      <Button className="w-full" onClick={() => { setV(hasPolicy ? p : { ...DEFAULT_POLICY }); setCreating(true); }}>
        {t("policiesForm.newPolicyButton")}
      </Button>

      {hasPolicy ? (
        <div className="flex items-start gap-3 rounded-(--radius) border p-4">
          <Icon icon="ph:radio-button-fill" className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="flex flex-col gap-3">
            <p className="font-semibold">{p.internalName}</p>
            <Summary title={t("policiesForm.paymentPlanLabel")} text={paymentPlanSummary(p, geld)} />
            <Summary title={t("policiesForm.cancellationLabel")} text={cancellationSummary(p, geld)} />
            {p.depositRequired && (
              <Summary title={t("policiesForm.depositLabel")} text={depositSummary(p, geld)} />
            )}
          </div>
        </div>
      ) : (
        <Empty>{t("policiesForm.noPolicyAddOneAbove")}</Empty>
      )}
    </EditorShell>
  );
}

function BookabilityEditor({
  pol,
  onSave,
  onClose,
  reichweite,
  t,
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
  reichweite: Reichweite;
  t: ReturnType<typeof useTranslations>;
}) {
  const [v, setV] = useState(pol);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("policiesForm.bookabilityCardTitle")}
      subtitle={t("policiesForm.bookabilityEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <PortalReichweite schluessel="bookability" {...reichweite} />
      {BOOKABILITY_OPTIONS.map((o) => {
        const active = v.bookability === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setV({ ...v, bookability: o.value })}
            className={`flex w-full items-start gap-3 rounded-(--radius) border-2 p-4 text-left transition-colors ${active ? "border-foreground" : "border-border hover:bg-muted/40"
              }`}
          >
            <Icon
              icon={active ? "ph:radio-button-fill" : "ph:circle"}
              className={`mt-0.5 size-5 shrink-0 ${active ? "text-foreground" : "text-muted-foreground"}`}
            />
            <div className="flex flex-col gap-1.5">
              <span className="font-display text-base font-extrabold">{o.label}</span>
              <span className="text-sm text-muted-foreground">{o.description}</span>
              {o.recommended && (
                <span className="w-fit rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {t("policiesForm.recommendedBadge")}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </EditorShell>
  );
}

function TimesEditor({
  pol,
  onSave,
  onClose,
  reichweite,
  t,
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
  reichweite: Reichweite;
  t: ReturnType<typeof useTranslations>;
}) {
  const [v, setV] = useState(pol);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("policiesForm.timesCardTitle")}
      subtitle={t("policiesForm.timesCardHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <PortalReichweite schluessel="check_in_out" {...reichweite} />
      <Field label={t("policiesForm.checkInTimeLabel")}>
        <Select value={v.checkInTime} onValueChange={(val) => setV({ ...v, checkInTime: val })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOUR_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("policiesForm.checkOutTimeLabel")}>
        <Select value={v.checkOutTime} onValueChange={(val) => setV({ ...v, checkOutTime: val })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOUR_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </EditorShell>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-lg font-extrabold">{title}</p>
      {children}
    </div>
  );
}

// Zwischen-Titel innerhalb einer Gruppe („Erste Zahlung", „Regel 1").
function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-bold">{children}</p>;
}

// Warn-Hinweis (Vorautorisierung): sieht anders aus als der Info-Hinweis, weil
// er eine Einschränkung ankündigt, keine Erklärung.
function Warn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-(--radius) bg-warning/10 p-3 text-sm">
      <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0 text-warning" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

// Auswahlfeld über einer Options-Liste (label/value) — spart in diesem Formular
// ein Dutzend gleiche Select-Blöcke.
function Auswahl({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Zahlenfeld mit Einheit am rechten Rand („%", Währungscode). Ohne `einheit`
// ein reines Zahlenfeld (Tage).
function ZahlMitEinheit({
  value,
  onChange,
  einheit,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  einheit?: string;
  max?: number;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={einheit ? "pr-10" : undefined}
      />
      {einheit && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {einheit}
        </span>
      )}
    </div>
  );
}

// Betrag + Währung. Die Währung ist die des Objekts (`properties.currency`) und
// deshalb NICHT wählbar — ein zweiter Währungsschalter hier würde einen
// Betrag in einer Währung erlauben, in der das Objekt nicht verkauft wird.
// Fehlt sie, bleibt das Feld leer (kein erfundenes „EUR").
function BetragUndWaehrung({
  value,
  onChange,
  currency,
  t,
}: {
  value: number;
  onChange: (value: number) => void;
  currency: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t("policiesForm.amountLabel")} required>
        <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      </Field>
      <Field label={t("policiesForm.currencyLabel")}>
        <Input value={currency ?? ""} readOnly disabled />
      </Field>
    </div>
  );
}

// „Tage" + „Zeitraum" einer geplanten Zahlung.
function TerminZeile({
  tage,
  onTage,
  periode,
  onPeriode,
  mitNichtEinplanen,
  t,
}: {
  tage: number;
  onTage: (value: number) => void;
  periode: SchedulePeriod;
  onPeriode: (value: SchedulePeriod) => void;
  mitNichtEinplanen: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const optionen = mitNichtEinplanen
    ? SCHEDULE_PERIOD_OPTIONS
    : SCHEDULE_PERIOD_OPTIONS.filter((o) => o.value !== "not_scheduled");
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t("policiesForm.daysLabel")} required>
        <Input
          type="number"
          min={0}
          value={tage}
          onChange={(e) => onTage(Number(e.target.value) || 0)}
          disabled={periode === "not_scheduled"}
        />
      </Field>
      <Field label={t("policiesForm.periodLabel")}>
        <Auswahl
          value={periode}
          onChange={(val) => onPeriode(val as SchedulePeriod)}
          options={optionen}
        />
      </Field>
    </div>
  );
}

function Summary({ title, text }: { title: string; text: string }) {
  return (
    <div className="leading-snug">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// Mehrsprachiger Editor (Mietvertrag / Raten-Info): Sprachwahl + Rich-Text +
// Übersetzen. Speichert die LocalizedText-Map des jeweiligen Feldes.
function LocalizedEditor({
  title,
  field,
  pol,
  onSave,
  onClose,
  t,
}: {
  title: string;
  field: "ratesInfo" | "rentalAgreement";
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [v, setV] = useState<LocalizedText>(pol[field]);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={title}
      subtitle={t("policiesForm.localizedEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run({ ...pol, [field]: v })} />}
    >
      <LocalizedTextEditor value={v} onChange={setV} placeholder={t("policiesForm.localizedEditorPlaceholder", { title })} />
    </EditorShell>
  );
}

// Mehrsprachige Vorschau: zeigt die Sprachen mit Inhalt (HTML gerendert).
function LocalizedPreview({ value, clamp }: { value: LocalizedText; clamp?: boolean }) {
  const filled = LANGS.filter((l) => stripHtml(value[l]).trim().length > 0);
  return (
    <div className="flex flex-col gap-3">
      {filled.map((l) => (
        <div key={l} className="rounded-(--radius) bg-muted/40 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Icon icon={LANG_FLAGS[l]} className="size-3.5" />
            {LANG_LABELS[l]}
          </div>
          <div
            className={`prose prose-sm max-w-none text-sm text-muted-foreground ${clamp ? "line-clamp-6" : ""}`}
            // Inhalt stammt aus dem eigenen Rich-Text-Editor des Vermieters.
            dangerouslySetInnerHTML={{ __html: value[l] }}
          />
        </div>
      ))}
    </div>
  );
}

