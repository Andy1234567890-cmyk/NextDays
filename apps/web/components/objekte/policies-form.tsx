"use client";

// Richtlinien-Seite eines Objekts (wie Lodgify „Policies").
//  Reservation policies: Policy (Storno/Zahlung/Kaution), Bookability,
//  Check-in/out-Zeiten. Website legal info: Rates-Info, Mietvertrag.
// Bearbeitung je Block über einen Sheet-Editor; gespeichert wird per
// updateProperty() in das flexible Feld type_attributes.policies.
import { Icon } from "@iconify/react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function PoliciesForm({ initial }: { initial: Property }) {
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
      <h1 className="font-display text-3xl font-extrabold">Richtlinien</h1>

      {/* Reservation policies */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">Reservierungs-Richtlinien</h2>

        <BlockCard
          title="Richtlinie"
          hint="Weise diesem Objekt eine Richtlinie zu (Storno, Zahlung, Kaution)."
          onEdit={() => setSection("policy")}
        >
          {pol.policy.internalName.trim() ? (
            <div className="flex flex-col gap-2.5 rounded-(--radius) bg-muted/40 p-4 text-sm">
              <p className="font-medium">{pol.policy.internalName}</p>
              <Summary title="Zahlungsplan" text={paymentSummary(pol.policy)} />
              <Summary title="Stornierung" text={CANCELLATION_OPTIONS.find((o) => o.value === pol.policy.cancellationType)?.info ?? ""} />
              {pol.policy.depositMode === "amount" && (
                <Summary title="Kaution" text={`Eine Kaution von ${pol.policy.depositAmount} € wird einbehalten.`} />
              )}
            </div>
          ) : (
            <Empty>Noch keine Richtlinie hinterlegt.</Empty>
          )}
        </BlockCard>

        <BlockCard
          title="Buchbarkeit"
          hint="Wie Reservierungen angenommen werden."
          onEdit={() => setSection("bookability")}
        >
          <Pill>{BOOKABILITY_LABELS[pol.bookability]}</Pill>
        </BlockCard>

        <BlockCard
          title="Check-in/Check-out-Zeiten"
          hint="Lege die Check-in- und Check-out-Zeiten fest."
          onEdit={() => setSection("times")}
        >
          <Pill>
            Check-in: {formatHour(pol.checkInTime)} · Check-out: {formatHour(pol.checkOutTime)}
          </Pill>
        </BlockCard>
      </section>

      {/* Website legal info */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-extrabold">Rechtliche Angaben (Website)</h2>

        <BlockCard
          title="Raten-Info"
          hint="Zusätzliche Information auf der Raten-Seite deiner Website."
          actionLabel={hasAnyText(pol.ratesInfo) ? "Bearbeiten" : "Hinzufügen"}
          onEdit={() => setSection("rates")}
        >
          {hasAnyText(pol.ratesInfo) ? (
            <LocalizedPreview value={pol.ratesInfo} />
          ) : (
            <Empty>Keine Zusatzinfo.</Empty>
          )}
        </BlockCard>

        <BlockCard
          title="Mietvertrag"
          hint="Erstelle den Mietvertrag oder verlinke ihn für deine Gäste."
          onEdit={() => setSection("agreement")}
        >
          {hasAnyText(pol.rentalAgreement) ? (
            <LocalizedPreview value={pol.rentalAgreement} clamp />
          ) : (
            <Empty>Noch kein Mietvertrag.</Empty>
          )}
        </BlockCard>
      </section>

      {/* Editoren */}
      {section === "policy" && <PolicyEditor pol={pol} onSave={save} onClose={() => setSection(null)} />}
      {section === "bookability" && <BookabilityEditor pol={pol} onSave={save} onClose={() => setSection(null)} />}
      {section === "times" && <TimesEditor pol={pol} onSave={save} onClose={() => setSection(null)} />}
      {section === "rates" && <LocalizedEditor title="Raten-Info" field="ratesInfo" pol={pol} onSave={save} onClose={() => setSection(null)} />}
      {section === "agreement" && <LocalizedEditor title="Mietvertrag" field="rentalAgreement" pol={pol} onSave={save} onClose={() => setSection(null)} />}
    </div>
  );
}

// --- Karten/Bausteine ------------------------------------------------------

function BlockCard({
  title,
  hint,
  actionLabel = "Bearbeiten",
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
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [v, setV] = useState<Policy>(pol.policy);
  const { busy, error, run } = useSaver(onSave);

  if (creating) {
    return (
      <EditorShell
        title="Richtlinie hinzufügen"
        subtitle="Lege die Details für diese neue Richtlinie fest."
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
        <Field label="Interner Name *">
          <Input
            value={v.internalName}
            onChange={(e) => setV({ ...v, internalName: e.target.value })}
            placeholder="z. B. Teil-Anzahlung – nicht erstattbar"
          />
        </Field>

        <Group title="Zahlungsplan">
          <Field label="Anzahl der Zahlungen">
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
              <Field label="Anzahlung (%)">
                <Input type="number" min={0} max={100} value={v.depositPercent} onChange={(e) => setV({ ...v, depositPercent: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Restbetrag (Tage vor Anreise)">
                <Input type="number" min={0} value={v.remainingDaysBefore} onChange={(e) => setV({ ...v, remainingDaysBefore: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          )}
          <Hint>{PAYMENT_PLAN_OPTIONS.find((o) => o.value === v.paymentPlan)?.info}</Hint>
        </Group>

        <Group title="Stornierung durch Gast">
          <Field label="Stornoart">
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

        <Group title="Kaution">
          <Select value={v.depositMode} onValueChange={(val) => setV({ ...v, depositMode: val as DepositMode })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Kaution erforderlich</SelectItem>
              <SelectItem value="amount">Kaution als Betrag</SelectItem>
            </SelectContent>
          </Select>
          {v.depositMode === "amount" && (
            <Field label="Kautionsbetrag (€)">
              <Input type="number" min={0} value={v.depositAmount} onChange={(e) => setV({ ...v, depositAmount: Number(e.target.value) || 0 })} />
            </Field>
          )}
        </Group>

        <Group title="Angebots-Gültigkeit">
          <Field label="Gültigkeitsdauer (Stunden) *">
            <Input type="number" min={1} value={v.quoteValidityHours} onChange={(e) => setV({ ...v, quoteValidityHours: Number(e.target.value) || 0 })} />
          </Field>
          <Hint>
            Das Angebot ist max. {v.quoteValidityHours} Stunden gültig, solange der
            Status „Wartet auf Gast" oder „Wartet auf Zahlung" ist.
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
      title="Richtlinie zuweisen"
      subtitle="Weise diesem Objekt eine Richtlinie zu oder lege eine neue an."
      onClose={onClose}
      footer={
        <Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(pol)} />
      }
    >
      <Button className="w-full" onClick={() => { setV(hasPolicy ? p : { ...DEFAULT_POLICY }); setCreating(true); }}>
        Neue Richtlinie
      </Button>

      {hasPolicy ? (
        <div className="flex items-start gap-3 rounded-(--radius) border p-4">
          <Icon icon="ph:radio-button-fill" className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="flex flex-col gap-3">
            <p className="font-semibold">{p.internalName}</p>
            <Summary title="Zahlungsplan" text={paymentSummary(p)} />
            <Summary title="Stornierung" text={CANCELLATION_OPTIONS.find((o) => o.value === p.cancellationType)?.info ?? ""} />
            {p.depositMode === "amount" && (
              <Summary title="Kaution" text={`Eine Kaution von ${p.depositAmount} € wird einbehalten.`} />
            )}
          </div>
        </div>
      ) : (
        <Empty>Noch keine Richtlinie. Lege oben eine neue an.</Empty>
      )}
    </EditorShell>
  );
}

function BookabilityEditor({
  pol,
  onSave,
  onClose,
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
}) {
  const [v, setV] = useState(pol);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Buchbarkeit"
      subtitle="Wähle, wie Reservierungen für dieses Objekt angenommen werden."
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
            className={`flex w-full items-start gap-3 rounded-(--radius) border-2 p-4 text-left transition-colors ${
              active ? "border-foreground" : "border-border hover:bg-muted/40"
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
                  Empfohlen
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
}: {
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
}) {
  const [v, setV] = useState(pol);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Check-in/Check-out-Zeiten"
      subtitle="Lege die Check-in- und Check-out-Zeiten fest."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label="Check-in-Zeit">
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
      <Field label="Check-out-Zeit">
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

function paymentSummary(p: Policy): string {
  if (p.paymentPlan === "one") {
    return "100 % bei der Reservierung fällig.";
  }
  return `${p.depositPercent} % bei Buchung, Restbetrag ${p.remainingDaysBefore} Tage vor Anreise.`;
}

// Mehrsprachiger Editor (Mietvertrag / Raten-Info): Sprachwahl + Rich-Text +
// Übersetzen. Speichert die LocalizedText-Map des jeweiligen Feldes.
function LocalizedEditor({
  title,
  field,
  pol,
  onSave,
  onClose,
}: {
  title: string;
  field: "ratesInfo" | "rentalAgreement";
  pol: Policies;
  onSave: (next: Policies) => Promise<true | string>;
  onClose: () => void;
}) {
  const [v, setV] = useState<LocalizedText>(pol[field]);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={title}
      subtitle="Erstelle den Text und übersetze ihn bei Bedarf für deine Gäste."
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run({ ...pol, [field]: v })} />}
    >
      <LocalizedTextEditor value={v} onChange={setV} placeholder={`${title} eingeben …`} />
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

