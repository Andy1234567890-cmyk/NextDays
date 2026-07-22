"use client";

// Richtlinien-Seite eines Objekts (Policies).
//  Reservation policies: Policy (Storno/Zahlung/Kaution), Bookability,
//  Check-in/out-Zeiten. Website legal info: Rates-Info, Mietvertrag.
// Bearbeitung je Block über einen Sheet-Editor; gespeichert wird per
// updateProperty() in das flexible Feld type_attributes.policies.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  type CancellationType,
  type DepositMode,
  type LocalizedText,
  type PaymentPlan,
  type Policies,
  type Policy,
  BOOKABILITY_LABELS,
  BOOKABILITY_OPTIONS,
  CANCELLATION_OPTIONS,
  DEFAULT_POLICY,
  HOUR_OPTIONS,
  LANG_FLAGS,
  LANG_LABELS,
  LANGS,
  PAYMENT_PLAN_OPTIONS,
  formatHour,
  hasAnyText,
  readPolicies,
  stripHtml,
} from "@/lib/policy-meta";
import { type Property, updateProperty } from "@/lib/properties";

type Section =
  | "policy"
  | "bookability"
  | "times"
  | "rates"
  | "agreement"
  | null;

// Betrag mit Objekt-Währung formatieren; ohne gültigen Code reine Zahl (kein
// erfundenes € — Projektregel: keine Fallback-Ersatzwerte, kein €-Hardcode).
function money(amount: number, currency: string | null | undefined): string {
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const valid = /^[A-Z]{3}$/.test(code);
  return amount.toLocaleString("de-DE", valid ? { style: "currency", currency: code } : {});
}

export function PoliciesForm({
  initial,
  currency,
}: {
  initial: Property;
  currency: string | null;
}) {
  const t = useTranslations("objects");
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const pol = readPolicies(p.type_attributes);

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
          actionLabel={t("policiesForm.editAction")}
          onEdit={() => setSection("policy")}
        >
          {pol.policy.internalName.trim() ? (
            <div className="flex flex-col gap-2.5 rounded-(--radius) bg-muted/40 p-4 text-sm">
              <p className="font-medium">{pol.policy.internalName}</p>
              <Summary title={t("policiesForm.paymentPlanLabel")} text={paymentSummary(pol.policy, t)} />
              <Summary title={t("policiesForm.cancellationLabel")} text={CANCELLATION_OPTIONS.find((o) => o.value === pol.policy.cancellationType)?.info ?? ""} />
              {pol.policy.depositMode === "amount" && (
                <Summary title={t("policiesForm.depositLabel")} text={t("policiesForm.depositWithheldText", { amount: money(pol.policy.depositAmount, currency) })} />
              )}
            </div>
          ) : (
            <Empty>{t("policiesForm.noPolicyYet")}</Empty>
          )}
        </BlockCard>

        <BlockCard
          title={t("policiesForm.bookabilityCardTitle")}
          hint={t("policiesForm.bookabilityCardHint")}
          actionLabel={t("policiesForm.editAction")}
          onEdit={() => setSection("bookability")}
        >
          <Pill>{BOOKABILITY_LABELS[pol.bookability]}</Pill>
        </BlockCard>

        <BlockCard
          title={t("policiesForm.timesCardTitle")}
          hint={t("policiesForm.timesCardHint")}
          actionLabel={t("policiesForm.editAction")}
          onEdit={() => setSection("times")}
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
          hint={t("policiesForm.ratesInfoCardHint")}
          actionLabel={hasAnyText(pol.ratesInfo) ? t("policiesForm.editAction") : t("policiesForm.addAction")}
          onEdit={() => setSection("rates")}
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
          actionLabel={t("policiesForm.editAction")}
          onEdit={() => setSection("agreement")}
        >
          {hasAnyText(pol.rentalAgreement) ? (
            <LocalizedPreview value={pol.rentalAgreement} clamp />
          ) : (
            <Empty>{t("policiesForm.noRentalAgreementYet")}</Empty>
          )}
        </BlockCard>
      </section>

      {/* Editoren */}
      {section === "policy" && <PolicyEditor pol={pol} onSave={save} onClose={() => setSection(null)} currency={currency} t={t} />}
      {section === "bookability" && <BookabilityEditor pol={pol} onSave={save} onClose={() => setSection(null)} t={t} />}
      {section === "times" && <TimesEditor pol={pol} onSave={save} onClose={() => setSection(null)} t={t} />}
      {section === "rates" && <LocalizedEditor title={t("policiesForm.ratesInfoCardTitle")} field="ratesInfo" pol={pol} onSave={save} onClose={() => setSection(null)} t={t} />}
      {section === "agreement" && <LocalizedEditor title={t("policiesForm.rentalAgreementCardTitle")} field="rentalAgreement" pol={pol} onSave={save} onClose={() => setSection(null)} t={t} />}
    </div>
  );
}

// --- Karten/Bausteine ------------------------------------------------------

function BlockCard({
  title,
  hint,
  actionLabel,
  onEdit,
  children,
}: {
  title: string;
  hint: string;
  actionLabel?: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="leading-tight">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {actionLabel}
        </Button>
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
  onSave,
  onClose,
  currency,
  t,
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
  currency: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const [creating, setCreating] = useState(false);
  const [v, setV] = useState<Policy>(pol.policy);
  const { busy, error, run } = useSaver(onSave);

  if (creating) {
    return (
      <EditorShell
        title={t("policiesForm.addPolicyTitle")}
        subtitle={t("policiesForm.addPolicySubtitle")}
        onClose={onClose}
        footer={
          <Footer
            busy={busy}
            error={error}
            onCancel={() => setCreating(false)}
            onSave={() => run({ ...pol, policy: v })}
            disabled={!v.internalName.trim()}
          />
        }
      >
        <Field label={t("policiesForm.internalNameLabel")}>
          <Input
            value={v.internalName}
            onChange={(e) => setV({ ...v, internalName: e.target.value })}
            placeholder={t("policiesForm.internalNamePlaceholder")}
          />
        </Field>

        <Group title={t("policiesForm.paymentPlanGroupTitle")}>
          <Field label={t("policiesForm.paymentCountLabel")}>
            <Select value={v.paymentPlan} onValueChange={(val) => setV({ ...v, paymentPlan: val as PaymentPlan })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_PLAN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {v.paymentPlan === "split" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("policiesForm.depositPercentLabel")}>
                <Input type="number" min={0} max={100} value={v.depositPercent} onChange={(e) => setV({ ...v, depositPercent: Number(e.target.value) || 0 })} />
              </Field>
              <Field label={t("policiesForm.remainingDaysBeforeLabel")}>
                <Input type="number" min={0} value={v.remainingDaysBefore} onChange={(e) => setV({ ...v, remainingDaysBefore: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          )}
          <Hint>{PAYMENT_PLAN_OPTIONS.find((o) => o.value === v.paymentPlan)?.info}</Hint>
        </Group>

        <Group title={t("policiesForm.guestCancellationGroupTitle")}>
          <Field label={t("policiesForm.cancellationTypeLabel")}>
            <Select value={v.cancellationType} onValueChange={(val) => setV({ ...v, cancellationType: val as CancellationType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Hint>{CANCELLATION_OPTIONS.find((o) => o.value === v.cancellationType)?.info}</Hint>
        </Group>

        <Group title={t("policiesForm.depositGroupTitle")}>
          <Select value={v.depositMode} onValueChange={(val) => setV({ ...v, depositMode: val as DepositMode })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("policiesForm.depositModeNone")}</SelectItem>
              <SelectItem value="amount">{t("policiesForm.depositModeAmount")}</SelectItem>
            </SelectContent>
          </Select>
          {v.depositMode === "amount" && (
            <Field label={currency ? t("policiesForm.depositAmountLabelWithCurrency", { currency }) : t("policiesForm.depositAmountLabel")}>
              <Input type="number" min={0} value={v.depositAmount} onChange={(e) => setV({ ...v, depositAmount: Number(e.target.value) || 0 })} />
            </Field>
          )}
        </Group>

        <Group title={t("policiesForm.quoteValidityGroupTitle")}>
          <Field label={t("policiesForm.quoteValidityHoursLabel")}>
            <Input type="number" min={1} value={v.quoteValidityHours} onChange={(e) => setV({ ...v, quoteValidityHours: Number(e.target.value) || 0 })} />
          </Field>
          <Hint>
            {t("policiesForm.quoteValidityHint", { hours: v.quoteValidityHours })}
          </Hint>
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
            <Summary title={t("policiesForm.paymentPlanLabel")} text={paymentSummary(p, t)} />
            <Summary title={t("policiesForm.cancellationLabel")} text={CANCELLATION_OPTIONS.find((o) => o.value === p.cancellationType)?.info ?? ""} />
            {p.depositMode === "amount" && (
              <Summary title={t("policiesForm.depositLabel")} text={t("policiesForm.depositWithheldText", { amount: money(p.depositAmount, currency) })} />
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
  t,
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
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
  t,
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
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
      <p className="font-display text-base font-extrabold">{title}</p>
      {children}
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

function paymentSummary(p: Policy, t: ReturnType<typeof useTranslations>): string {
  if (p.paymentPlan === "one") {
    return t("policiesForm.paymentSummaryFull");
  }
  return t("policiesForm.paymentSummarySplit", {
    percent: p.depositPercent,
    days: p.remainingDaysBefore,
  });
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

