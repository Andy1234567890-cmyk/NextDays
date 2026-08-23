"use client";

// Verfügbarkeits-Seite eines Objekts (Availability).
//  Mindest-/Maximalaufenthalt, Vorbereitungszeit, Buchungsfenster,
//  Vorlaufzeit, gesperrte Check-in/out-Wochentage. Mehrere Blöcke erlauben
//  „Custom setup per channel" (NextDays / Airbnb / Booking.com / Google).
// Gespeichert per updateProperty() in type_attributes.availability.
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  ChannelIcons,
  ChannelLogo,
  EditorShell,
  Field,
  Footer,
  Hint,
  Pill,
  useSaver,
} from "@/components/objekte/editor-primitives";
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
import { Switch } from "@nextdays/ui/switch";
import {
  type Availability,
  type Channel,
  type MinStayType,
  type PerChannel,
  type WeekdayFlags,
  ADVANCE_NOTICE_OPTIONS,
  BOOKING_WINDOW_OPTIONS,
  CHANNEL_LABELS,
  CUT_OFF_TIME_OPTIONS,
  MIN_STAY_TYPE_OPTIONS,
  PREPARATION_OPTIONS,
  WEEKDAYS,
  countDays,
  labelFor,
  readAvailability,
} from "@/lib/availability-meta";
import { type Property, updateProperty } from "@/lib/properties";
import { setMinStay } from "@/lib/rates";

type Section =
  | "min"
  | "max"
  | "prep"
  | "window"
  | "notice"
  | "days"
  | "sales"
  | null;

// Kanäle, die Vorbereitungszeit/Buchungsfenster/Vorlaufzeit wirklich erreichen.
// Channex hat für diese drei KEIN Restriktionsfeld; nur Airbnb kennt sie am
// Listing (turnover_days, max_days_notice, booking_lead_time). Sie für
// Booking.com anzubieten hieße, eine Einstellung zu erfassen, die nirgends
// ankommt — dieselbe Falle wie ein erfundener Vorgabewert (Wurzel 4).
const PER_CHANNEL_KANAELE: Channel[] = ["direct", "airbnb"];

export function AvailabilityForm({ initial }: { initial: Property }) {
  const t = useTranslations("objects");
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const av = readAvailability(p.type_attributes);

  async function save(next: Availability): Promise<true | string> {
    // Speichern macht ZWEI Backend-Aufrufe. Bleibt einer hängen, sah der Nutzer
    // bisher nur einen ewig drehenden Knopf und wusste nicht, ob etwas ankam —
    // live am 23.08.2026: die Verfuegbarkeit wurde nie geschrieben, es entstand
    // kein Channex-Sync-Job, und Booking blieb ohne Mindestaufenthalt. Diese
    // Logs benennen jeden Schritt mit Dauer, damit der Hänger auffindbar ist.
    const t0 = performance.now();
    const ms = () => Math.round(performance.now() - t0);
    console.info("[verfuegbarkeit] speichern start", {
      objekt: p.id,
      minStay: next.minStay,
      minStayType: next.minStayType,
      maxStay: next.maxStay,
    });
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, availability: next },
    });
    if (!res.ok) {
      console.error("[verfuegbarkeit] objekt speichern FEHLER", {
        ms: ms(), fehler: res.error,
      });
      return res.error;
    }
    const gespeichert = (res.data.type_attributes as Record<string, unknown> | undefined)
      ?.availability as Partial<Availability> | undefined;
    console.info("[verfuegbarkeit] objekt gespeichert", {
      ms: ms(),
      minStayType: gespeichert?.minStayType,
      minStay: gespeichert?.minStay,
    });
    setP(res.data);
    setSection(null);
    // Mindestaufenthalt zusätzlich in den rate_plan schreiben (Channex versteht
    // min_stay direkt) — sofern bereits ein Preis/Plan existiert.
    if (next.minStay >= 1) {
      const rp = await setMinStay(p.id, next.minStay);
      if (!rp.ok) {
        console.error("[verfuegbarkeit] rate_plan min_stay FEHLER", {
          ms: ms(), fehler: rp.error,
        });
        return rp.error;
      }
      console.info("[verfuegbarkeit] rate_plan min_stay gesetzt", { ms: ms() });
    }
    console.info("[verfuegbarkeit] speichern fertig", { ms: ms() });
    return true;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">{t("availabilityForm.title")}</h1>

      <BlockCard
        title={t("availabilityForm.minStay.title")}
        hint={t("availabilityForm.minStay.hint")}
        channels={["direct", "airbnb", "booking", "google"]}
        actionLabel={t("availabilityForm.actionEdit")}
        onEdit={() => setSection("min")}
      >
        <Pill>{t("availabilityForm.nightsCount", { count: av.minStay })}</Pill>
      </BlockCard>

      <BlockCard
        title={t("availabilityForm.maxStay.title")}
        hint={t("availabilityForm.maxStay.hint")}
        channels={["direct", "airbnb", "booking"]}
        actionLabel={t("availabilityForm.actionEdit")}
        onEdit={() => setSection("max")}
      >
        <Pill>{t("availabilityForm.nightsCount", { count: av.maxStay })}</Pill>
      </BlockCard>

      {/* Vorbereitungszeit, Buchungsfenster und Vorlaufzeit haben bei Channex
          KEIN Restriktionsfeld. Sie gehen deshalb nur an Airbnb (dessen eigene
          Listing-Settings) und gelten bei uns direkt — Booking.com hier zu
          nennen wäre ein Versprechen, das niemand einlöst. */}
      <BlockCard
        title={t("availabilityForm.preparation.title")}
        hint={t("availabilityForm.preparation.hint")}
        channels={["direct", "airbnb"]}
        actionLabel={
          av.preparationDays.global || av.preparationDays.custom
            ? t("availabilityForm.actionEdit")
            : t("availabilityForm.actionAdd")
        }
        onEdit={() => setSection("prep")}
      >
        <PerChannelPills pc={av.preparationDays} options={PREPARATION_OPTIONS} />
      </BlockCard>

      <BlockCard
        title={t("availabilityForm.bookingWindow.title")}
        hint={t("availabilityForm.bookingWindow.hint")}
        channels={["direct", "airbnb"]}
        actionLabel={t("availabilityForm.actionEdit")}
        onEdit={() => setSection("window")}
      >
        <PerChannelPills pc={av.bookingWindowDays} options={BOOKING_WINDOW_OPTIONS} />
      </BlockCard>

      <BlockCard
        title={t("availabilityForm.advanceNotice.title")}
        hint={t("availabilityForm.advanceNotice.hint")}
        channels={["direct", "airbnb"]}
        actionLabel={t("availabilityForm.actionEdit")}
        onEdit={() => setSection("notice")}
      >
        <PerChannelPills pc={av.advanceNotice} options={ADVANCE_NOTICE_OPTIONS} />
      </BlockCard>

      <BlockCard
        title={t("availabilityForm.blockedDays.title")}
        hint={t("availabilityForm.blockedDays.hint")}
        channels={["direct", "airbnb", "booking", "google"]}
        actionLabel={t("availabilityForm.actionEdit")}
        onEdit={() => setSection("days")}
      >
        <Pill>
          {t("availabilityForm.blockedDays.summary", {
            checkIn: dayLabel(av.unavailableCheckIn, t),
            checkOut: dayLabel(av.unavailableCheckOut, t),
          })}
        </Pill>
      </BlockCard>

      <BlockCard
        title={t("availabilityForm.sales.title")}
        hint={t("availabilityForm.sales.hint")}
        channels={["direct", "airbnb", "booking", "google"]}
        actionLabel={t("availabilityForm.actionEdit")}
        onEdit={() => setSection("sales")}
      >
        <Pill>{salesLabel(av, t)}</Pill>
      </BlockCard>

      {/* „Automatische Verfügbarkeit" gibt es hier bewusst NICHT mehr als
          Einstellung. Wir sind der Verfügbarkeits-Master: nach jeder Buchung/
          Storno pusht der Kalender den absoluten Wert an die Portale. Ließe man
          Channex zusätzlich relativ nachziehen, entstünde reihenfolgeabhängig
          ein Doppel-Dekrement (Einheit doppelt verkaufbar oder phantom-belegt).
          Das Backend pinnt die Schalter deshalb hart auf false
          (`common._availability_settings`) — als bedienbare Schalter waren sie
          ein Versprechen, das nie eingelöst wurde. */}

      {/* Editoren */}
      {section === "min" && <MinStayEditor av={av} onSave={save} onClose={() => setSection(null)} />}
      {section === "max" && <MaxStayEditor av={av} onSave={save} onClose={() => setSection(null)} />}
      {section === "prep" && (
        <PerChannelEditor
          title={t("availabilityForm.preparation.title")}
          subtitle={t("availabilityForm.preparation.hint")}
          field="preparationDays"
          options={PREPARATION_OPTIONS}
          av={av}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "window" && (
        <PerChannelEditor
          title={t("availabilityForm.bookingWindow.title")}
          subtitle={t("availabilityForm.bookingWindow.editorSubtitle")}
          field="bookingWindowDays"
          options={BOOKING_WINDOW_OPTIONS}
          av={av}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "notice" && (
        <PerChannelEditor
          title={t("availabilityForm.advanceNotice.title")}
          subtitle={t("availabilityForm.advanceNotice.editorSubtitle")}
          field="advanceNotice"
          options={ADVANCE_NOTICE_OPTIONS}
          av={av}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "days" && <DaysEditor av={av} onSave={save} onClose={() => setSection(null)} />}
      {section === "sales" && <SalesEditor av={av} onSave={save} onClose={() => setSection(null)} />}
    </div>
  );
}

// Kurzbeschreibung der Verkaufssteuerung für die Karte.
function salesLabel(av: Availability, t: ReturnType<typeof useTranslations>): string {
  const parts: string[] = [];
  parts.push(
    av.cutOffTime
      ? t("availabilityForm.sales.summaryStopAt", { time: av.cutOffTime })
      : t("availabilityForm.sales.summaryNoStop"),
  );
  if (av.cutOffDays > 0) {
    parts.push(t("availabilityForm.sales.summaryLeadDays", { count: av.cutOffDays }));
  }
  if (av.maxDayAdvance > 0) {
    parts.push(t("availabilityForm.sales.summaryMaxAdvance", { count: av.maxDayAdvance }));
  }
  return parts.join(" · ");
}

// --- Karten/Bausteine ------------------------------------------------------

function BlockCard({
  title,
  hint,
  channels,
  actionLabel,
  onEdit,
  children,
}: {
  title: string;
  hint: string;
  channels: Channel[];
  actionLabel: string;
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
      <div className="flex items-center">
        {children}
        <ChannelIcons channels={channels} />
      </div>
    </Card>
  );
}

// Zeigt entweder den globalen Wert oder die Werte je Kanal als Pills.
function PerChannelPills<T extends string | number>({
  pc,
  options,
}: {
  pc: PerChannel<T>;
  options: { value: T; label: string }[];
}) {
  if (!pc.custom) {
    return <Pill>{labelFor(options, pc.global)}</Pill>;
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      {PER_CHANNEL_KANAELE.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm">
          <ChannelLogo channel={c} />
          {labelFor(options, pc.channels[c])}
        </span>
      ))}
    </span>
  );
}

function dayLabel(f: WeekdayFlags, t: ReturnType<typeof useTranslations>): string {
  const n = countDays(f);
  return n === 0
    ? t("availabilityForm.blockedDays.allAvailable")
    : t("availabilityForm.blockedDays.blockedCount", { count: n });
}

// --- Editoren ---------------------------------------------------------------

function MinStayEditor({
  av,
  onSave,
  onClose,
}: {
  av: Availability;
  onSave: (next: Availability) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(av);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("availabilityForm.minStay.title")}
      subtitle={t("availabilityForm.minStay.hint")}
      channels={["direct", "airbnb", "booking"]}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} disabled={v.minStay < 1} />}
    >
      <Field label={t("availabilityForm.minStay.fieldLabel")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={v.minStay}
            onChange={(e) => setV({ ...v, minStay: Number(e.target.value) || 1 })}
          />
          <span className="text-sm text-muted-foreground">{t("availabilityForm.nights")}</span>
        </div>
      </Field>
      <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
        <span>
          <span className="font-medium">{t("availabilityForm.minStay.byDaysTitle")}</span>
          <span className="mt-0.5 block text-muted-foreground">
            {t("availabilityForm.minStay.byDaysHint")}
          </span>
        </span>
        <Switch checked={v.minStayByDays} onCheckedChange={(c) => setV({ ...v, minStayByDays: c })} />
      </label>
    </EditorShell>
  );
}

function MaxStayEditor({
  av,
  onSave,
  onClose,
}: {
  av: Availability;
  onSave: (next: Availability) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(av);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("availabilityForm.maxStay.title")}
      subtitle={t("availabilityForm.maxStay.hint")}
      channels={["direct", "airbnb", "booking"]}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("availabilityForm.maxStay.fieldLabel")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={v.maxStay}
            onChange={(e) => setV({ ...v, maxStay: Number(e.target.value) || 1 })}
          />
          <span className="text-sm text-muted-foreground">{t("availabilityForm.nights")}</span>
        </div>
      </Field>
      <Hint>{t("availabilityForm.maxStay.limitHint")}</Hint>
    </EditorShell>
  );
}

// Generischer Pro-Kanal-Editor (Vorbereitungszeit / Buchungsfenster / Vorlaufzeit).
function PerChannelEditor<T extends string | number>({
  title,
  subtitle,
  field,
  options,
  av,
  onSave,
  onClose,
}: {
  title: string;
  subtitle: string;
  field: "preparationDays" | "bookingWindowDays" | "advanceNotice";
  options: { value: T; label: string }[];
  av: Availability;
  onSave: (next: Availability) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [pc, setPc] = useState<PerChannel<T>>(av[field] as PerChannel<T>);
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    run({ ...av, [field]: pc } as Availability);
  }

  return (
    <EditorShell
      title={title}
      subtitle={subtitle}
      channels={PER_CHANNEL_KANAELE}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      {/* Globaler Wert (deaktiviert, wenn pro Kanal) */}
      <Field label={t("availabilityForm.perChannel.forAllChannels")}>
        <Select
          value={String(pc.global)}
          onValueChange={(val) => setPc({ ...pc, global: cast(options, val) })}
        >
          <SelectTrigger disabled={pc.custom}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="h-px bg-border" />

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("availabilityForm.perChannel.customPerChannel")}</span>
        <Switch checked={pc.custom} onCheckedChange={(c) => setPc({ ...pc, custom: c })} />
      </label>

      {pc.custom && (
        <div className="flex flex-col gap-4">
          {PER_CHANNEL_KANAELE.map((c) => (
            <Field
              key={c}
              label={
                <span className="flex items-center gap-1.5">
                  <ChannelLogo channel={c} big />
                  {CHANNEL_LABELS[c]}
                </span>
              }
            >
              <Select
                value={String(pc.channels[c])}
                onValueChange={(val) =>
                  setPc({ ...pc, channels: { ...pc.channels, [c]: cast(options, val) } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ))}
        </div>
      )}
    </EditorShell>
  );
}

// String aus dem Select zurück in den Optionstyp (number|string) wandeln.
function cast<T extends string | number>(
  options: { value: T; label: string }[],
  val: string,
): T {
  const match = options.find((o) => String(o.value) === val);
  return (match ? match.value : (val as T)) as T;
}

function DaysEditor({
  av,
  onSave,
  onClose,
}: {
  av: Availability;
  onSave: (next: Availability) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(av);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("availabilityForm.blockedDays.title")}
      subtitle={t("availabilityForm.blockedDays.hint")}
      channels={["direct", "airbnb", "booking"]}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <div className="flex flex-col gap-3">
        <p className="font-medium">{t("availabilityForm.blockedDays.checkInTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {t("availabilityForm.blockedDays.checkInHint")}
        </p>
        <DayChecks
          value={v.unavailableCheckIn}
          onChange={(f) => setV({ ...v, unavailableCheckIn: f })}
        />
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <p className="font-medium">{t("availabilityForm.blockedDays.checkOutTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {t("availabilityForm.blockedDays.checkOutHint")}
        </p>
        <DayChecks
          value={v.unavailableCheckOut}
          onChange={(f) => setV({ ...v, unavailableCheckOut: f })}
        />
      </div>
    </EditorShell>
  );
}

// Verkaufssteuerung: Cut-Off-Zeit, Cut-Off-Tage, Max-Days-Advance, min_stay-Typ.
// Alle Werte gehen 1:1 in die Channex-property.settings → an Booking/Airbnb & Co.
function SalesEditor({
  av,
  onSave,
  onClose,
}: {
  av: Availability;
  onSave: (next: Availability) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(av);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("availabilityForm.sales.title")}
      subtitle={t("availabilityForm.sales.editorSubtitle")}
      channels={["direct", "airbnb", "booking", "google"]}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("availabilityForm.sales.cutOffTimeLabel")}>
        <Select
          value={v.cutOffTime}
          onValueChange={(val) => setV({ ...v, cutOffTime: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CUT_OFF_TIME_OPTIONS.map((o) => (
              <SelectItem key={o.value || "off"} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Hint>{t("availabilityForm.sales.cutOffTimeHint")}</Hint>

      <Field label={t("availabilityForm.sales.cutOffDaysLabel")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={v.cutOffDays}
            onChange={(e) => setV({ ...v, cutOffDays: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="text-sm text-muted-foreground">{t("availabilityForm.daysOffWhenZero")}</span>
        </div>
      </Field>

      <Field label={t("availabilityForm.sales.maxDayAdvanceLabel")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={v.maxDayAdvance}
            onChange={(e) => setV({ ...v, maxDayAdvance: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="text-sm text-muted-foreground">{t("availabilityForm.daysOffWhenZero")}</span>
        </div>
      </Field>
      <Hint>{t("availabilityForm.sales.maxDayAdvanceHint")}</Hint>

      <div className="h-px bg-border" />

      <Field label={t("availabilityForm.sales.minStayTypeLabel")}>
        <Select
          value={v.minStayType}
          onValueChange={(val) => setV({ ...v, minStayType: val as MinStayType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MIN_STAY_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Hint>{t("availabilityForm.sales.minStayTypeHint")}</Hint>
    </EditorShell>
  );
}

function DayChecks({
  value,
  onChange,
}: {
  value: WeekdayFlags;
  onChange: (f: WeekdayFlags) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {WEEKDAYS.map((d) => (
        <label key={d.key} className="flex cursor-pointer items-center gap-3 py-1 text-sm">
          <input
            type="checkbox"
            checked={value[d.key]}
            onChange={(e) => onChange({ ...value, [d.key]: e.target.checked })}
            className="size-4 rounded border-input accent-foreground"
          />
          {d.label}
        </label>
      ))}
    </div>
  );
}
