"use client";

// Objektkartei-Stepper (8 Stufen, Lastenheft §6). Alle sichtbaren Texte über
// useTranslations("dossier") — kein hart-kodierter Text. Enum-Dropdowns: Wert =
// neutraler Key, Label = t("<enum>.<key>"). Speichern je Stufe direkt gegen den
// Slice; State aus der Server-Antwort (kein Reload).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DossierPdfButton } from "@/components/objekte/kartei/dossier-pdf-button";
import { CheckboxField, DateField, NumberField, SelectField, TextField, nulled } from "@/components/objekte/kartei/fields";
import { ListEditor } from "@/components/objekte/kartei/list-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OverflowTabs } from "@/components/ui/overflow-tabs";
import {
  type AccessData,
  type DossierFull,
  type EmergencyAuthority,
  type HousebookData,
  type LinkedOwner,
  type MarketingData,
  type PlatformLaunchInput,
  type ProcessData,
  type ServiceAgreementInput,
  type TradespersonInput,
  addPlatformLaunch,
  addServiceAgreement,
  addTradesperson,
  deletePlatformLaunch,
  deleteServiceAgreement,
  deleteTradesperson,
  saveAccess,
  saveEmergencyAuthority,
  saveHousebook,
  saveMarketing,
  saveProcess,
  updatePlatformLaunch,
  updateServiceAgreement,
  updateTradesperson,
} from "@/lib/property-dossier";
import { type Property, updateProperty } from "@/lib/properties";

const STEP_KEYS = [
  "object_info", "process", "access", "service_agreements",
  "tradespeople", "marketing", "housebook", "listing",
] as const;

type T = ReturnType<typeof useTranslations>;

export function DossierStepper({ property, initial }: { property: Property; initial: DossierFull }) {
  const t = useTranslations("dossier");
  const [step, setStep] = useState(0);
  const pid = property.id;

  return (
    <div className="flex flex-col gap-4">
      {/* Rotes Band wie die Gästekartei: Titel + Aktionen oben, darunter die
          einzeilige Stufen-Leiste (Overflow hinter „⋯"). Farbe = Akzent-Token. */}
      <div className="rounded-2xl bg-accent px-6 pb-3 pt-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
          <DossierPdfButton property={property} />
        </div>
        <OverflowTabs
          tone="accent"
          active={STEP_KEYS[step]}
          onSelect={(k) => setStep(STEP_KEYS.indexOf(k as (typeof STEP_KEYS)[number]))}
          tabs={STEP_KEYS.map((k) => ({ key: k, label: t(`step.${k}`) }))}
        />
      </div>

      <Card className="p-6">
        {step === 0 && <Stufe1 t={t} property={property} owner={initial.owner} />}
        {step === 1 && <Stufe2 t={t} pid={pid} initial={initial.process} />}
        {step === 2 && <Stufe3 t={t} pid={pid} initial={initial.access} />}
        {step === 3 && <Stufe4 t={t} pid={pid} initial={initial.service_agreements} />}
        {step === 4 && <Stufe5 t={t} pid={pid} initial={initial} />}
        {step === 5 && <Stufe6 t={t} pid={pid} initial={initial.marketing} />}
        {step === 6 && <Stufe7 t={t} pid={pid} initial={initial.housebook} />}
        {step === 7 && <Stufe8 t={t} pid={pid} initial={initial.platform_launches} />}
      </Card>
    </div>
  );
}

function SaveBar({ t, onSave }: { t: T; onSave: () => Promise<true | string> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function handle() {
    setBusy(true);
    setMsg(null);
    const r = await onSave();
    setBusy(false);
    setMsg(r === true ? { ok: true, text: t("saved") } : { ok: false, text: r });
  }
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
      {msg && (
        <span className={`mr-auto text-sm ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>
          {msg.text}
        </span>
      )}
      <Button onClick={handle} disabled={busy}>
        {busy ? t("saving") : t("save")}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-extrabold">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-(--radius) bg-muted/50 p-3 text-sm text-muted-foreground">
      <Icon icon="ph:info" className="size-4 shrink-0" />
      {children}
    </div>
  );
}

// --- Stufe 1: Objektinformation + Eigentümer (read-only) -------------------
function Stufe1({ t, property, owner }: { t: T; property: Property; owner: LinkedOwner | null }) {
  const [bfe, setBfe] = useState(property.bfe_number);

  async function save(): Promise<true | string> {
    const r = await updateProperty(property.id, { bfe_number: bfe?.trim() || null });
    return r.ok ? true : r.error;
  }

  // Alles außer der DK-Katasternummer kommt read-only aus dem Bestand — Name =
  // title, Typ = property_type, Kapazität = max_guests / type_attributes.size_m2
  // (im Übersichts-Tab gepflegt). Keine zweite Wahrheit.
  const sizeM2 = property.type_attributes?.size_m2;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReadTile label={t("objectInfo.name")} value={property.title} />
        <ReadTile label={t("objectInfo.type")} value={property.property_type} />
        <ReadTile label={t("objectInfo.capacityPersons")} value={property.max_guests == null ? null : String(property.max_guests)} />
        <ReadTile label={t("objectInfo.capacitySqm")} value={typeof sizeM2 === "number" ? String(sizeM2) : null} />
      </div>

      <Section title={t("step.object_info")}>
        <TextField label={t("objectInfo.bfeNumber")} value={bfe} onChange={setBfe} />
      </Section>
      <SaveBar t={t} onSave={save} />

      <section className="flex flex-col gap-4 border-t pt-6">
        <h2 className="font-display text-lg font-extrabold">{t("owner.heading")}</h2>
        {owner ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ReadTile label={t("owner.name")} value={owner.name} />
              <ReadTile label={t("owner.company")} value={owner.company} />
              <ReadTile label={t("owner.email")} value={owner.email} />
              <ReadTile label={t("owner.phone")} value={owner.phone} />
              <ReadTile label={t("owner.iban")} value={owner.iban} />
              <ReadTile label={t("owner.bic")} value={owner.bic} />
              <ReadTile label={t("owner.bankName")} value={owner.bank_name} />
              <ReadTile label={t("owner.accountHolder")} value={owner.account_holder} />
              <ReadTile label={t("owner.taxId")} value={owner.tax_id} />
              <ReadTile label={t("owner.vatId")} value={owner.vat_id} />
              <ReadTile label={t("owner.cprNumber")} value={owner.cpr_number} />
              <ReadTile label={t("owner.ownershipShare")} value={owner.ownership_share == null ? null : String(owner.ownership_share)} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{t("owner.readOnlyHint")}</span>
              <Link href={`/eigentuemer/${owner.owner_id}`} className="text-sm font-medium text-accent hover:underline">
                {t("ownerLink")}
              </Link>
            </div>
          </>
        ) : (
          <Hint>{t("noOwner")}</Hint>
        )}
      </section>
    </div>
  );
}

// Read-only Bestandsfeld als kompakte Kachel (Label oben, Wert darunter) — kein
// linien-getrenntes Layout, damit leere Felder nicht „ausgeräumt" wirken.
function ReadTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-(--radius) bg-muted/40 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium" title={value ?? undefined}>
        {value ?? "—"}
      </span>
    </div>
  );
}

// --- Stufe 2: Prozess & Vertrag --------------------------------------------
function Stufe2({ t, pid, initial }: { t: T; pid: string; initial: ProcessData }) {
  const [d, setD] = useState<ProcessData>(initial);
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("step.process")}>
        <DateField label={t("process.firstMeeting")} value={d.first_meeting_at} onChange={(v) => setD({ ...d, first_meeting_at: v })} placeholder={t("pickDate")} />
        <DateField label={t("process.contractSent")} value={d.contract_sent_at} onChange={(v) => setD({ ...d, contract_sent_at: v })} placeholder={t("pickDate")} />
        <DateField label={t("process.contractSigned")} value={d.contract_signed_at} onChange={(v) => setD({ ...d, contract_signed_at: v })} placeholder={t("pickDate")} />
        <DateField label={t("process.invoiceSent")} value={d.onboarding_invoice_sent_at} onChange={(v) => setD({ ...d, onboarding_invoice_sent_at: v })} placeholder={t("pickDate")} />
        <DateField label={t("process.invoicePaid")} value={d.onboarding_invoice_paid_at} onChange={(v) => setD({ ...d, onboarding_invoice_paid_at: v })} placeholder={t("pickDate")} />
      </Section>
      <SaveBar t={t} onSave={async () => (await saveProcess(pid, d)).ok || t("saved")} />
    </div>
  );
}

// --- Stufe 3: Zugang & Technik ---------------------------------------------
function Stufe3({ t, pid, initial }: { t: T; pid: string; initial: AccessData }) {
  const [d, setD] = useState<AccessData>(initial);
  const keyOpts = ["agency_extra", "owner_only"].map((k) => ({ value: k, label: t(`keyStatus.${k}`) }));
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("step.access")}>
        <SelectField label={t("access.keyStatus")} value={d.key_status} onChange={(v) => setD({ ...d, key_status: v })} options={keyOpts} />
        <TextField label={t("access.keyPlacement")} value={d.key_placement} onChange={(v) => setD({ ...d, key_placement: v })} />
      </Section>
      <Hint>{t("access.fromGuestModule")}</Hint>
      <SaveBar t={t} onSave={async () => (await saveAccess(pid, nulled(d))).ok || t("saved")} />
    </div>
  );
}

// --- Stufe 4: Serviceverträge (1:n) ----------------------------------------
function Stufe4({ t, pid, initial }: { t: T; pid: string; initial: DossierFull["service_agreements"] }) {
  const listLabels = { add: t("add"), save: t("save"), saving: t("saving"), cancel: t("cancel"), empty: t("empty") };
  const typeOpts = ["caretaker", "window_cleaning", "lawn_mowing"].map((k) => ({ value: k, label: t(`serviceType.${k}`) }));
  return (
    <ListEditor
      heading={t("service.heading")}
      labels={listLabels}
      initial={initial}
      empty={(): ServiceAgreementInput => ({ service_type: "caretaker", frequency: null, price: null, currency: null, notes: null })}
      rowLabel={(s) => t(`serviceType.${s.service_type}`)}
      onAdd={(v) => addServiceAgreement(pid, nulled(v))}
      onUpdate={(id, v) => updateServiceAgreement(pid, id, nulled(v))}
      onDelete={(id) => deleteServiceAgreement(pid, id)}
      render={(v, set) => (
        <>
          <SelectField label={t("service.serviceType")} value={v.service_type} onChange={(x) => set({ ...v, service_type: x ?? "caretaker" })} options={typeOpts} />
          <TextField label={t("service.frequency")} value={v.frequency} onChange={(x) => set({ ...v, frequency: x })} />
          <NumberField label={t("service.price")} value={v.price} onChange={(x) => set({ ...v, price: x })} />
          <TextField label={t("service.currency")} value={v.currency} onChange={(x) => set({ ...v, currency: x })} />
          <TextField label={t("service.notes")} value={v.notes} onChange={(x) => set({ ...v, notes: x })} />
        </>
      )}
    />
  );
}

// --- Stufe 5: Handwerker (1:n) + Vollmacht (1:1) ---------------------------
function Stufe5({ t, pid, initial }: { t: T; pid: string; initial: DossierFull }) {
  const [auth, setAuth] = useState<EmergencyAuthority>(initial.emergency_authority);
  const listLabels = { add: t("add"), save: t("save"), saving: t("saving"), cancel: t("cancel"), empty: t("empty") };
  const tradeOpts = ["electrician", "plumbing", "carpenter", "locksmith"].map((k) => ({ value: k, label: t(`trade.${k}`) }));
  const modeOpts = ["up_to_amount", "always_owner"].map((k) => ({ value: k, label: t(`authorityMode.${k}`) }));
  return (
    <div className="flex flex-col gap-8">
      <ListEditor
        heading={t("trades.heading")}
        labels={listLabels}
        initial={initial.tradespeople}
        empty={(): TradespersonInput => ({ trade: "electrician", name: null, phone: null, notes: null })}
        rowLabel={(x) => `${t(`trade.${x.trade}`)}${x.name ? ` · ${x.name}` : ""}`}
        onAdd={(v) => addTradesperson(pid, nulled(v))}
        onUpdate={(id, v) => updateTradesperson(pid, id, nulled(v))}
        onDelete={(id) => deleteTradesperson(pid, id)}
        render={(v, set) => (
          <>
            <SelectField label={t("trades.trade")} value={v.trade} onChange={(x) => set({ ...v, trade: x ?? "electrician" })} options={tradeOpts} />
            <TextField label={t("trades.name")} value={v.name} onChange={(x) => set({ ...v, name: x })} />
            <TextField label={t("trades.phone")} value={v.phone} onChange={(x) => set({ ...v, phone: x })} />
            <TextField label={t("trades.notes")} value={v.notes} onChange={(x) => set({ ...v, notes: x })} />
          </>
        )}
      />
      <Section title={t("trades.authorityHeading")}>
        <SelectField label={t("trades.authorityMode")} value={auth.authority_mode} onChange={(v) => setAuth({ ...auth, authority_mode: v })} options={modeOpts} />
        <NumberField label={t("trades.authorityLimit")} value={auth.authority_limit} onChange={(v) => setAuth({ ...auth, authority_limit: v })} />
        <TextField label={t("trades.currency")} value={auth.currency} onChange={(v) => setAuth({ ...auth, currency: v })} />
      </Section>
      <SaveBar t={t} onSave={async () => (await saveEmergencyAuthority(pid, nulled(auth))).ok || t("saved")} />
    </div>
  );
}

// --- Stufe 6: Marketing ----------------------------------------------------
function Stufe6({ t, pid, initial }: { t: T; pid: string; initial: MarketingData }) {
  const [d, setD] = useState<MarketingData>(initial);
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("step.marketing")}>
        <DateField label={t("marketing.photographerBooked")} value={d.photographer_booked_at} onChange={(v) => setD({ ...d, photographer_booked_at: v })} placeholder={t("pickDate")} />
        <DateField label={t("marketing.mediaReceived")} value={d.media_received_at} onChange={(v) => setD({ ...d, media_received_at: v })} placeholder={t("pickDate")} />
        <DateField label={t("marketing.siteWalkthrough")} value={d.site_walkthrough_at} onChange={(v) => setD({ ...d, site_walkthrough_at: v })} placeholder={t("pickDate")} />
        <DateField label={t("marketing.defectsListSent")} value={d.defects_list_sent_at} onChange={(v) => setD({ ...d, defects_list_sent_at: v })} placeholder={t("pickDate")} />
      </Section>
      <SaveBar t={t} onSave={async () => (await saveMarketing(pid, d)).ok || t("saved")} />
    </div>
  );
}

// --- Stufe 7: Hausmappe (Status; Texte im Nachrichten-Bereich) -------------
function Stufe7({ t, pid, initial }: { t: T; pid: string; initial: HousebookData }) {
  const [d, setD] = useState<HousebookData>(initial);
  const statusOpts = ["received", "open"].map((k) => ({ value: k, label: t(`welcomeStatus.${k}`) }));
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("step.housebook")}>
        <SelectField label={t("housebook.welcomeStatus")} value={d.welcome_text_status} onChange={(v) => setD({ ...d, welcome_text_status: v })} options={statusOpts} />
        <CheckboxField label={t("housebook.physicalPlaced")} checked={d.physical_folder_placed} onChange={(v) => setD({ ...d, physical_folder_placed: v })} />
      </Section>
      <Hint>{t("housebook.textsHint")}</Hint>
      <SaveBar t={t} onSave={async () => (await saveHousebook(pid, nulled(d))).ok || t("saved")} />
    </div>
  );
}

// --- Stufe 8: Vermarktung (Plattform-Launches 1:n) -------------------------
function Stufe8({ t, pid, initial }: { t: T; pid: string; initial: DossierFull["platform_launches"] }) {
  const listLabels = { add: t("add"), save: t("save"), saving: t("saving"), cancel: t("cancel"), empty: t("empty") };
  const platOpts = ["native", "airbnb", "booking", "vrbo"].map((k) => ({ value: k, label: t(`platform.${k}`) }));
  return (
    <div className="flex flex-col gap-8">
      <ListEditor
        heading={t("listing.heading")}
        labels={listLabels}
        initial={initial}
        empty={(): PlatformLaunchInput => ({ platform: "native", launch_at: null, status: null })}
        rowLabel={(p) => `${t(`platform.${p.platform}`)}${p.launch_at ? ` · ${p.launch_at}` : ""}`}
        onAdd={(v) => addPlatformLaunch(pid, nulled(v))}
        onUpdate={(id, v) => updatePlatformLaunch(pid, id, nulled(v))}
        onDelete={(id) => deletePlatformLaunch(pid, id)}
        render={(v, set) => (
          <>
            <SelectField label={t("listing.platform")} value={v.platform} onChange={(x) => set({ ...v, platform: x ?? "native" })} options={platOpts} />
            <DateField label={t("listing.launchAt")} value={v.launch_at} onChange={(x) => set({ ...v, launch_at: x })} placeholder={t("pickDate")} />
            <TextField label={t("listing.status")} value={v.status} onChange={(x) => set({ ...v, status: x })} />
          </>
        )}
      />
      <Hint>{t("listing.sourcesHint")}</Hint>
    </div>
  );
}
