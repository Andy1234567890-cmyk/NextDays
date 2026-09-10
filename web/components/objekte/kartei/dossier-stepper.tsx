"use client";

// Objektkartei-Stepper (8 Stufen, Lastenheft §6). Alle sichtbaren Texte über
// useTranslations("dossier") — kein hart-kodierter Text. Enum-Dropdowns: Wert =
// neutraler Key, Label = t("<enum>.<key>"). Speichern je Stufe direkt gegen den
// Slice; State aus der Server-Antwort (kein Reload).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { DossierPdfButton } from "@/components/objekte/kartei/dossier-pdf-button";
import { InventarListe } from "@/components/objekte/kartei/inventar-liste";
import { MappeDokumente } from "@/components/objekte/kartei/mappe-dokumente";
import { CheckboxField, DateField, NumberField, SelectField, TextField, nulled } from "@/components/objekte/kartei/fields";
import { ListEditor } from "@/components/objekte/kartei/list-editor";
import { LocalizedTextEditor } from "@/components/objekte/localized-text-editor";
import { FeldMitPlatzhaltern, Shortcode } from "@/components/shared/shortcode";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { OverflowTabs } from "@nextdays/ui/overflow-tabs";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { type Sperrantrag, getAvailability, listBlockRequests } from "@/lib/calendar";
import { formatCurrency } from "@/lib/currency";
import { isoPlus, todayIso } from "@/lib/dates";
import { type Messaging, readMessaging } from "@/lib/messaging-meta";
import type { LocalizedText } from "@/lib/policy-meta";
import {
  type GuestPortalSettings,
  getGuestPortal,
  saveGuestPortal,
} from "@/lib/property-portal";
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
import { BOLIGTYPEN } from "@/lib/property-meta";
import {
  type Boligtype,
  type Property,
  type VertragsendeBuchung,
  getVertragsende,
  updateProperty,
} from "@/lib/properties";
import { listRatePlans } from "@/lib/rates";

// Das Inventar steht NACH der Hausmappe und VOR der Vermarktung: beim
// Rundgang durchs Haus gehoert beides zusammen (was auf Papier existiert, und
// was wirklich dasteht), die Vermarktung ist der Schritt danach.
const STEP_KEYS = [
  "object_info", "process", "access", "service_agreements",
  "tradespeople", "marketing", "housebook", "inventory", "listing",
] as const;

// Uhrzeit-Auswahl für „Code sichtbar ab" (Viertelstunden-Raster).
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

type T = ReturnType<typeof useTranslations>;

export function DossierStepper({ property, initial }: { property: Property; initial: DossierFull }) {
  const t = useTranslations("dossier");
  const [step, setStep] = useState(0);
  const pid = property.id;

  // Alle acht Stufen bleiben GEMOUNTET und werden per `hidden` gewechselt —
  // aus zwei Gründen: (1) der Druck (`window.print`) gibt alle Stufen auf
  // einmal aus, `@media print` hebt `hidden` für [data-kartei-stufe] wieder auf
  // (globals.css); (2) ein Entwurf in Stufe 3 überlebt den Blick in Stufe 5.
  // Vorher wurde nur die aktive Stufe gerendert; ein Wechsel verwarf die
  // Eingaben, und Drucken hätte nur eine Stufe gezeigt.
  const stufen = [
    <Stufe1 key="s1" t={t} property={property} owner={initial.owner} />,
    <Stufe2 key="s2" t={t} pid={pid} initial={initial.process} />,
    <Stufe3 key="s3" t={t} pid={pid} initial={initial.access} property={property} />,
    <Stufe4 key="s4" t={t} pid={pid} initial={initial.service_agreements} />,
    <Stufe5 key="s5" t={t} pid={pid} initial={initial} />,
    <Stufe6 key="s6" t={t} pid={pid} initial={initial.marketing} />,
    <Stufe7 key="s7" t={t} pid={pid} initial={initial.housebook} />,
    // Eigene Stufe, kein Abschnitt in der Hausmappe: die Inventarliste ist
    // ein eigenstaendiger Arbeitsbereich mit Raeumen, Mengen und Schaeden —
    // in der Hausmappe verschwaende sie unter drei Statusfeldern.
    // Sie laedt selbst und braucht deshalb kein `initial`.
    <InventarListe key="s9" pid={pid} />,
    <Stufe8 key="s8" t={t} pid={pid} initial={initial.platform_launches} />,
  ];

  return (
    <div className="flex flex-col gap-4" data-kartei-druck>
      {/* Rotes Band wie die Gästekartei: Titel + Aktionen oben, darunter die
          einzeilige Stufen-Leiste (Overflow hinter „⋯"). Farbe = Akzent-Token.
          Im Druck ausgeblendet (data-kartei-druck-aus) — dort steht statt
          dessen die schlichte Druck-Kopfzeile darunter. */}
      <div className="rounded-2xl bg-accent px-6 pb-3 pt-5 text-white" data-kartei-druck-aus>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-2 bg-card text-foreground hover:bg-card/90"
              onClick={() => window.print()}
            >
              <Icon icon="ph:printer" className="size-4" />
              {t("print")}
            </Button>
            <DossierPdfButton property={property} />
          </div>
        </div>
        <OverflowTabs
          tone="accent"
          active={STEP_KEYS[step]}
          onSelect={(k) => setStep(STEP_KEYS.indexOf(k as (typeof STEP_KEYS)[number]))}
          tabs={STEP_KEYS.map((k) => ({ key: k, label: t(`step.${k}`) }))}
        />
      </div>
      <div className="hidden" data-kartei-druck-kopf>
        <h1 className="font-display text-2xl font-extrabold">{t("title")} — {property.title}</h1>
      </div>

      {STEP_KEYS.map((k, i) => (
        <Card key={k} className="p-6" data-kartei-stufe hidden={step !== i}>
          {/* Nur im Druck sichtbar: die Stufen-Nummer als Kapitelmarke. */}
          <p className="hidden text-xs font-bold uppercase tracking-wide text-muted-foreground" data-kartei-druck-kopf>
            {i + 1} · {t(`step.${k}`)}
          </p>
          {stufen[i]}
        </Card>
      ))}
    </div>
  );
}

/** Speichern-Leiste mit Rückmeldung.
 *
 *  `onSave` gibt `true` (gespeichert) oder den Fehlertext zurück. Ein leerer
 *  Text wird nicht angezeigt — so kann ein Aufrufer den Grund selbst darstellen,
 *  ohne dass dieselbe Aussage zweimal untereinander steht. */
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
      {msg && msg.text && (
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

/** Überschrift mit einer oder mehreren Platzhalter-Marken dahinter. */
function TitelMitPlatzhaltern({ titel, codes }: { titel: string; codes: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-display text-lg font-extrabold">{titel}</h2>
      {codes.map((c) => (
        <Shortcode key={c}>{c}</Shortcode>
      ))}
    </div>
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
  // DK-Wohnstatus (0581): flexbolig | helaarsbolig | fritidshus. Leer = nicht
  // erfasst — kein geratener Wert (Wurzel 4).
  const [boligtype, setBoligtype] = useState<Boligtype | null>(property.boligtype);
  const boligOpts = BOLIGTYPEN.map((k) => ({ value: k, label: t(`boligtype.${k}`) }));
  // Vertragsende (0355): der erste Tag OHNE Vermarktungsvertrag. Leer =
  // unbefristet — kein Ersatzdatum (Wurzel 4).
  const [vertragsende, setVertragsende] = useState(property.contract_end_date);
  // Buchungen, die über das Vertragsende hinausreichen. Sie VERHINDERN es nicht
  // (0359) — eine bestätigte Portal-Buchung verschwindet nicht dadurch, dass
  // der Vertrag endet; sie wird bedient und der Vertrag läuft für sie aus.
  // Angezeigt werden sie trotzdem: sonst steht das Objekt gesperrt im Kalender,
  // mit Gästen darin, und niemand kann sagen, welche das sind.
  const [offen, setOffen] = useState<VertragsendeBuchung[]>([]);

  // Beim Öffnen laden, nicht erst nach dem Speichern: der Betrieb muss sehen,
  // was noch abzuwickeln ist, ohne dafür etwas ändern zu müssen.
  const laden = useCallback(async () => {
    const r = await getVertragsende(property.id);
    setOffen(r.ok ? r.data.buchungen : []);
  }, [property.id]);

  useEffect(() => {
    void laden();
  }, [laden]);

  async function save(): Promise<true | string> {
    const r = await updateProperty(property.id, {
      bfe_number: bfe?.trim() || null,
      boligtype,
      contract_end_date: vertragsende || null,
    });
    // In BEIDEN Fällen neu laden: nach dem Speichern hat sich die Liste
    // geändert, und bei einem Fehler soll die Anzeige nicht auf einem Stand
    // stehen bleiben, der nicht mehr gilt.
    await laden();
    return r.ok ? true : r.error;
  }

  // Alles außer der DK-Katasternummer kommt read-only aus dem Bestand — Name =
  // title, Typ = property_type, Kapazität = max_guests / size_value (0249)
  // (im Übersichts-Tab gepflegt). Keine zweite Wahrheit.
  const sizeM2 = property.size_value;

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
        <SelectField
          label={t("objectInfo.boligtype")}
          value={boligtype}
          onChange={(v) => setBoligtype((v as Boligtype | null) ?? null)}
          options={boligOpts}
        />
        <DateField
          label={t("objectInfo.contractEnd")}
          value={vertragsende}
          onChange={setVertragsende}
        />
      </Section>
      <Hint>{t("objectInfo.contractEndHint")}</Hint>
      {offen.length > 0 && (
        <div className="flex flex-col gap-2 rounded-(--radius) border bg-secondary/40 p-3">
          <span className="text-sm font-medium">
            {t("objectInfo.contractEndOpenBookings")}
          </span>
          <ul className="flex flex-col gap-1 text-sm">
            {offen.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <Icon icon="ph:calendar-check" className="size-4 shrink-0 text-muted-foreground" />
                <span>{b.gast || t("objectInfo.contractEndNoGuest")}</span>
                <span className="text-muted-foreground">
                  {b.check_in} – {b.check_out}
                </span>
                {/* Bei einer Portal-Buchung sagen, dass sie nur DORT storniert
                    werden kann — der lokale Storno wird abgelehnt, weil er den
                    Portalen verfügbar meldete, während der Gast dort gebucht
                    bleibt (Überbuchung). */}
                {!b.lokal_stornierbar && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t("objectInfo.contractEndPortalOnly")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
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
              <ReadTile label={t("owner.bankRegNr")} value={owner.bank_reg_nr} />
              <ReadTile label={t("owner.bankKontoNr")} value={owner.bank_konto_nr} />
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
// DREI Quellen auf EINER Fläche (seit dem Wegfall des Gastmoduls, 14.08.2026):
//   • Schlüssel        → property_dossier      (saveAccess)
//   • Kontakt/WLAN/Code → property_guest_portal (saveGuestPortal)
//   • WLAN-/Türtexte   → properties.type_attributes.messaging (updateProperty)
// Die Datenhaltung bleibt getrennt (eine Wahrheit je Datenart) — nur die
// Oberfläche ist eine. Vorher lagen Türcode und WLAN unter
// /reservierungen/unterkuenfte/[id]/gastmodul, also in einem ANDEREN Hauptmenü
// als der Türzugangs-Text unter /objekte/[id]/nachrichten. Wer den Zugang dort
// pflegte, hatte keinen Anlass zu ahnen, dass `{{door_code}}` und
// `{{wifi_ssid}}` woanders wohnen — und eine Vorlage mit diesen Platzhaltern
// wurde deshalb NIE gesendet (Versand meldet „Feld ohne Wert", live 09.–14.08.2026).
function Stufe3({
  t,
  pid,
  initial,
  property,
}: {
  t: T;
  pid: string;
  initial: AccessData;
  property: Property;
}) {
  const [d, setD] = useState<AccessData>(initial);
  const [portal, setPortal] = useState<GuestPortalSettings | null>(null);
  const [messaging, setMessaging] = useState<Messaging>(() =>
    readMessaging(property.type_attributes),
  );
  // Frischer Property-Stand nach dem Speichern: sonst setzt ein zweites
  // Speichern auf veraltetem `type_attributes` auf und verwirft die eben
  // geschriebenen Texte (stale read).
  const [prop, setProp] = useState<Property>(property);
  // Kaution als TEXT im State: ein leeres Feld muss von „0" unterscheidbar
  // bleiben (leer = keine Kaution → null, nicht 0,00).
  const [kaution, setKaution] = useState(
    property.deposit_amount == null ? "" : String(property.deposit_amount),
  );
  const keyOpts = ["agency_extra", "owner_only"].map((k) => ({ value: k, label: t(`keyStatus.${k}`) }));

  useEffect(() => {
    let aktiv = true;
    void (async () => {
      const res = await getGuestPortal(pid);
      if (aktiv && res.ok) setPortal(res.data);
    })();
    return () => {
      aktiv = false;
    };
  }, [pid]);

  const setP = <K extends keyof GuestPortalSettings>(key: K, value: GuestPortalSettings[K]) =>
    setPortal((s) => (s ? { ...s, [key]: value } : s));
  const setText = (key: keyof Messaging, value: LocalizedText) =>
    setMessaging((m) => ({ ...m, [key]: value }));

  async function speichern(): Promise<true | string> {
    // Leeres Feld = keine Kaution (null). Eine unbrauchbare Eingabe wird
    // abgewiesen, statt sie als 0 zu speichern — „Kaution: 0,00" behauptet
    // etwas anderes als „keine Kaution" (Wurzel 4).
    const betrag = kaution.trim().replace(",", ".");
    if (betrag && !Number.isFinite(Number(betrag))) {
      return t("access.securityDepositInvalid");
    }
    const [accessRes, portalRes, msgRes] = await Promise.all([
      saveAccess(pid, nulled(d)),
      portal ? saveGuestPortal(pid, portal) : Promise.resolve({ ok: true } as const),
      updateProperty(pid, {
        type_attributes: { ...prop.type_attributes, messaging },
        deposit_amount: betrag ? Number(betrag) : null,
      }),
    ]);
    if (msgRes.ok && "data" in msgRes) setProp(msgRes.data);
    if (accessRes.ok && portalRes.ok && msgRes.ok) return true;
    return (
      (!accessRes.ok && accessRes.error) ||
      (!portalRes.ok && "error" in portalRes && portalRes.error) ||
      (!msgRes.ok && msgRes.error) ||
      t("saved")
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-extrabold">{t("step.access")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label={t("access.keyStatus")} value={d.key_status} onChange={(v) => setD({ ...d, key_status: v })} options={keyOpts} />
          <TextField label={t("access.keyPlacement")} value={d.key_placement} onChange={(v) => setD({ ...d, key_placement: v })} />
          {/* Kaution: die Spalte `properties.deposit_amount`, NICHT der
              Richtlinien-Text und nicht die Anzahlungsregel der
              Buchungsstrecke. Sie hatte bis 14.08.2026 kein Eingabefeld —
              `{{security_deposit}}` war damit tot. */}
          <FeldMitPlatzhaltern label={t("access.securityDeposit")} codes={["{{security_deposit}}"]}>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={kaution}
              onChange={(e) => setKaution(e.target.value)}
            />
          </FeldMitPlatzhaltern>
        </div>
      </section>

      {portal === null ? (
        <p className="text-sm text-muted-foreground">{t("access.loading")}</p>
      ) : (
        <>
          {/* Die Marken hängen hier am FELD, nicht an der Überschrift: die drei
              Felder speisen verschiedene Platzhalter, und „Name der
              Kontaktperson" speist gar keinen (steht in keinem `Kontext`-Feld,
              feld_kontext.py). Eine Marke an der Überschrift behauptete, sie
              gälte für alle drei. */}
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-extrabold">{t("access.contactTitle")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label={t("access.contactName")} value={portal.contact_name} onChange={(v) => setP("contact_name", v)} />
              <FeldMitPlatzhaltern label={t("access.contactPhone")} codes={["{{property_phone}}"]}>
                <Input
                  value={portal.contact_phone ?? ""}
                  onChange={(e) => setP("contact_phone", e.target.value || null)}
                />
              </FeldMitPlatzhaltern>
              <FeldMitPlatzhaltern
                label={t("access.maintenancePhone")}
                codes={["{{emergency_phone}}", "{{emergency_contact}}"]}
              >
                <Input
                  value={portal.maintenance_phone ?? ""}
                  onChange={(e) => setP("maintenance_phone", e.target.value || null)}
                />
              </FeldMitPlatzhaltern>
            </div>
          </section>

          {/* WLAN — zwei Ebenen, bewusst beide:
              • Netz + Passwort STRUKTURIERT (property_guest_portal, 0296) — die
                Heimat von {{wifi_ssid}}/{{wifi_password}} und Quelle des
                WLAN-QR-Codes im Gastportal.
              • Der FREITEXT (messaging.wifi, {{WifiInformation}}) daneben für
                den ganzen Satz („Router steht im Flur"). */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-lg font-extrabold">{t("access.wifiTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("access.wifiDescription")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FeldMitPlatzhaltern label={t("access.wifiSsid")} codes={["{{wifi_ssid}}"]}>
                <Input
                  value={portal.wifi_ssid ?? ""}
                  onChange={(e) => setP("wifi_ssid", e.target.value || null)}
                />
              </FeldMitPlatzhaltern>
              <FeldMitPlatzhaltern label={t("access.wifiPassword")} codes={["{{wifi_password}}"]}>
                <Input
                  value={portal.wifi_password ?? ""}
                  onChange={(e) => setP("wifi_password", e.target.value || null)}
                />
              </FeldMitPlatzhaltern>
            </div>
            <div className="flex flex-col gap-1">
              <TitelMitPlatzhaltern
                titel={t("access.wifiTextTitle")}
                codes={["{{WifiInformation}}"]}
              />
              <p className="text-sm text-muted-foreground">{t("access.wifiTextHint")}</p>
            </div>
            <LocalizedTextEditor
              value={messaging.wifi}
              onChange={(v) => setText("wifi", v)}
              placeholder={t("access.wifiFieldPlaceholder")}
            />
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-extrabold">{t("access.selfCheckinTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("access.selfCheckinDescription")}</p>
              </div>
              <Switch checked={portal.self_checkin} onCheckedChange={(v) => setP("self_checkin", v)} />
            </div>

            {portal.self_checkin && (
              <div className="flex flex-col gap-4 border-t pt-4">
                <div className="flex flex-col gap-2">
                  <TitelMitPlatzhaltern
                    titel={t("access.doorInstructions")}
                    codes={["{{DoorInstructions}}"]}
                  />
                  <LocalizedTextEditor
                    value={messaging.doorInstructions}
                    onChange={(v) => setText("doorInstructions", v)}
                    placeholder={t("access.doorInstructionsPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FeldMitPlatzhaltern label={t("access.doorCode")} codes={["{{door_code}}"]}>
                    <Input
                      value={portal.door_code ?? ""}
                      onChange={(e) => setP("door_code", e.target.value || null)}
                    />
                  </FeldMitPlatzhaltern>
                  <SelectField
                    label={t("access.codeVisibleFrom")}
                    value={portal.code_visible_from}
                    onChange={(v) => setP("code_visible_from", v)}
                    options={TIME_OPTIONS.map((z) => ({ value: z, label: z }))}
                  />
                </div>
                <CheckboxField
                  label={t("access.showCodeOnlyIfPaid")}
                  checked={portal.show_code_only_if_paid}
                  onChange={(v) => setP("show_code_only_if_paid", v)}
                />
                <CheckboxField
                  label={t("access.hideCodeUntilCheckin")}
                  checked={portal.hide_code_until_checkin}
                  onChange={(v) => setP("hide_code_until_checkin", v)}
                />
              </div>
            )}
          </section>
        </>
      )}

      <SaveBar t={t} onSave={speichern} />
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
      {/* Geheimtipps (0582): die Onboarding-Notiz der Agentur — was der
          Eigentümer beim Rundgang erzählt. Der Gasttext entsteht daraus im
          Nachrichten-Bereich; hier wird festgehalten, nicht versendet. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="housebook-secret-tips">{t("housebook.secretTips")}</Label>
        <Textarea
          id="housebook-secret-tips"
          rows={6}
          maxLength={5000}
          value={d.secret_tips ?? ""}
          onChange={(e) => setD({ ...d, secret_tips: e.target.value })}
          placeholder={t("housebook.secretTipsPlaceholder")}
        />
        <span className="text-xs text-muted-foreground">
          {t("housebook.secretTipsHint", { count: (d.secret_tips ?? "").length })}
        </span>
      </div>
      <Hint>{t("housebook.textsHint")}</Hint>
      <SaveBar t={t} onSave={async () => (await saveHousebook(pid, nulled(d))).ok || t("saved")} />

      {/* Die digitale Mappe (0619). Zwei getrennte Ablagen im selben Schritt:
          was der GAST sehen darf und was intern bleibt. Das PDF wird gelesen,
          die erkannten Angaben werden VORGESCHLAGEN — geschrieben wird erst
          nach einem Klick. */}
      <Section title={t("mappe.gastTitel")}>
        <div className="col-span-full">
          <MappeDokumente pid={pid} mappe="gast" />
        </div>
      </Section>
      <Section title={t("mappe.hausTitel")}>
        <div className="col-span-full">
          <MappeDokumente pid={pid} mappe="haus" />
        </div>
      </Section>

    </div>
  );
}

// --- Stufe 8: Vermarktung (Plattform-Launches 1:n) -------------------------
function Stufe8({ t, pid, initial }: { t: T; pid: string; initial: DossierFull["platform_launches"] }) {
  const listLabels = { add: t("add"), save: t("save"), saving: t("saving"), cancel: t("cancel"), empty: t("empty") };
  const platOpts = ["native", "airbnb", "booking", "vrbo"].map((k) => ({ value: k, label: t(`platform.${k}`) }));
  // Anzeige-Stand aus den Quellen, die die Wahrheit halten (0127: Grundpreis
  // und Sperrungen liegen NICHT in der Kartei): erster Preisplan des Objekts,
  // gesperrte Tage der nächsten 12 Monate, offene Sperranträge. Kein zweiter
  // Schreibweg — geändert wird über die Links darunter.
  const [stand, setStand] = useState<{
    basePrice: number | null;
    currency: string | null;
    plans: number;
    blockedDays: number | null;
    openRequests: number | null;
    fehler: string | null;
  } | null>(null);

  useEffect(() => {
    let aktiv = true;
    void (async () => {
      const heute = todayIso();
      const [plans, avail, requests] = await Promise.all([
        listRatePlans(pid),
        getAvailability(pid, heute, isoPlus(heute, 365)),
        listBlockRequests("pending"),
      ]);
      if (!aktiv) return;
      const erster = plans.ok ? plans.data.items[0] : undefined;
      const fehler = [plans, avail, requests].find((r) => !r.ok);
      setStand({
        basePrice: erster ? erster.base_price : null,
        currency: erster ? erster.currency : null,
        plans: plans.ok ? plans.data.items.length : 0,
        blockedDays: avail.ok ? avail.data.filter((d) => d.status === "blocked").length : null,
        openRequests: requests.ok
          ? requests.data.items.filter((r: Sperrantrag) => r.property_id === pid).length
          : null,
        fehler: fehler && !fehler.ok ? fehler.error : null,
      });
    })();
    return () => {
      aktiv = false;
    };
  }, [pid]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-extrabold">{t("listing.standHeading")}</h2>
        {stand === null ? (
          <p className="text-sm text-muted-foreground">{t("listing.standLoading")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ReadTile
                label={t("listing.basePrice")}
                value={
                  stand.basePrice == null
                    ? null
                    : formatCurrency(stand.basePrice, stand.currency) || String(stand.basePrice)
                }
              />
              <ReadTile
                label={t("listing.blockedDays12m")}
                value={stand.blockedDays == null ? null : String(stand.blockedDays)}
              />
              <ReadTile
                label={t("listing.openBlockRequests")}
                value={stand.openRequests == null ? null : String(stand.openRequests)}
              />
            </div>
            {stand.plans === 0 && <Hint>{t("listing.noRatePlan")}</Hint>}
            {stand.fehler && <p className="text-sm text-destructive">{stand.fehler}</p>}
            <div className="flex flex-wrap items-center gap-4" data-kartei-druck-aus>
              <Link href={`/objekte/${pid}/preise`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                <Icon icon="ph:currency-circle-dollar" className="size-4" />
                {t("listing.pricesLink")}
              </Link>
              <Link href="/kalender" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                <Icon icon="ph:calendar-blank" className="size-4" />
                {t("listing.calendarLink")}
              </Link>
            </div>
          </>
        )}
      </section>
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
