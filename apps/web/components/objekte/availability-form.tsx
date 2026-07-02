"use client";

// Verfügbarkeits-Seite eines Objekts (wie Lodgify „Availability").
//  Mindest-/Maximalaufenthalt, Vorbereitungszeit, Buchungsfenster,
//  Vorlaufzeit, gesperrte Check-in/out-Wochentage. Mehrere Blöcke erlauben
//  „Custom setup per channel" (NextDays / Airbnb / Booking.com / Google).
// Gespeichert per updateProperty() in type_attributes.availability.
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
import { Switch } from "@/components/ui/switch";
import {
  type Availability,
  type Channel,
  type PerChannel,
  type WeekdayFlags,
  ADVANCE_NOTICE_OPTIONS,
  BOOKING_WINDOW_OPTIONS,
  CHANNEL_LABELS,
  CHANNELS,
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
  | null;

export function AvailabilityForm({ initial }: { initial: Property }) {
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const av = readAvailability(p.type_attributes);

  async function save(next: Availability): Promise<true | string> {
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, availability: next },
    });
    if (!res.ok) return res.error;
    setP(res.data);
    setSection(null);
    // Mindestaufenthalt zusätzlich in den rate_plan schreiben (Channex versteht
    // min_stay direkt) — sofern bereits ein Preis/Plan existiert.
    if (next.minStay >= 1) {
      const rp = await setMinStay(p.id, next.minStay);
      if (!rp.ok) return rp.error;
    }
    return true;
  }

  const ALL: Channel[] = CHANNELS;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">Verfügbarkeit</h1>

      <BlockCard
        title="Mindestaufenthalt"
        hint="Lege einen Standard-Mindestaufenthalt fest. Optional Regeln nach Wochentagen."
        channels={["direct", "airbnb", "booking", "google"]}
        onEdit={() => setSection("min")}
      >
        <Pill>{av.minStay} Nächte</Pill>
      </BlockCard>

      <BlockCard
        title="Maximalaufenthalt"
        hint="Maximale Anzahl Nächte, die dein Objekt gebucht werden kann."
        channels={["direct", "airbnb", "booking"]}
        onEdit={() => setSection("max")}
      >
        <Pill>{av.maxStay} Nächte</Pill>
      </BlockCard>

      <BlockCard
        title="Vorbereitungszeit"
        hint="Zeit zwischen Buchungen, in der keine Reservierungen möglich sind."
        channels={["direct", "airbnb"]}
        actionLabel={av.preparationDays.global || av.preparationDays.custom ? "Bearbeiten" : "Hinzufügen"}
        onEdit={() => setSection("prep")}
      >
        <PerChannelPills pc={av.preparationDays} options={PREPARATION_OPTIONS} />
      </BlockCard>

      <BlockCard
        title="Buchungsfenster"
        hint="Begrenze, wie viele Tage im Voraus Gäste buchen können."
        channels={ALL}
        onEdit={() => setSection("window")}
      >
        <PerChannelPills pc={av.bookingWindowDays} options={BOOKING_WINDOW_OPTIONS} />
      </BlockCard>

      <BlockCard
        title="Vorlaufzeit"
        hint="Lege die späteste Zeit fest, zu der eine Reservierung möglich ist."
        channels={ALL}
        onEdit={() => setSection("notice")}
      >
        <PerChannelPills pc={av.advanceNotice} options={ADVANCE_NOTICE_OPTIONS} />
      </BlockCard>

      <BlockCard
        title="Gesperrte Check-in/out-Tage"
        hint="Lege fest, an welchen Wochentagen Check-in und Check-out nicht möglich sind."
        channels={["direct", "airbnb", "booking", "google"]}
        onEdit={() => setSection("days")}
      >
        <Pill>
          Check-in: {dayLabel(av.unavailableCheckIn)} · Check-out: {dayLabel(av.unavailableCheckOut)}
        </Pill>
      </BlockCard>

      {/* Editoren */}
      {section === "min" && <MinStayEditor av={av} onSave={save} onClose={() => setSection(null)} />}
      {section === "max" && <MaxStayEditor av={av} onSave={save} onClose={() => setSection(null)} />}
      {section === "prep" && (
        <PerChannelEditor
          title="Vorbereitungszeit"
          subtitle="Zeit zwischen Buchungen, in der keine Reservierungen möglich sind."
          field="preparationDays"
          options={PREPARATION_OPTIONS}
          av={av}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "window" && (
        <PerChannelEditor
          title="Buchungsfenster"
          subtitle="Wie viele Tage im Voraus Gäste buchen können."
          field="bookingWindowDays"
          options={BOOKING_WINDOW_OPTIONS}
          av={av}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "notice" && (
        <PerChannelEditor
          title="Vorlaufzeit"
          subtitle="Späteste Zeit, zu der eine Reservierung möglich ist."
          field="advanceNotice"
          options={ADVANCE_NOTICE_OPTIONS}
          av={av}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "days" && <DaysEditor av={av} onSave={save} onClose={() => setSection(null)} />}
    </div>
  );
}

// --- Karten/Bausteine ------------------------------------------------------

function BlockCard({
  title,
  hint,
  channels,
  actionLabel = "Bearbeiten",
  onEdit,
  children,
}: {
  title: string;
  hint: string;
  channels: Channel[];
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
      {CHANNELS.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-sm">
          <ChannelLogo channel={c} />
          {labelFor(options, pc.channels[c])}
        </span>
      ))}
    </span>
  );
}

function dayLabel(f: WeekdayFlags): string {
  const n = countDays(f);
  return n === 0 ? "alle Tage verfügbar" : `${n} Tag(e) gesperrt`;
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
  const [v, setV] = useState(av);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Mindestaufenthalt"
      subtitle="Lege einen Standard-Mindestaufenthalt fest. Optional Regeln nach Wochentagen."
      channels={["direct", "airbnb", "booking"]}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} disabled={v.minStay < 1} />}
    >
      <Field label="Mindestaufenthalt *">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={v.minStay}
            onChange={(e) => setV({ ...v, minStay: Number(e.target.value) || 1 })}
          />
          <span className="text-sm text-muted-foreground">Nächte</span>
        </div>
      </Field>
      <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
        <span>
          <span className="font-medium">Regeln nach Buchungstagen</span>
          <span className="mt-0.5 block text-muted-foreground">
            Umfasst eine Reservierung mehrere Tage, gilt der längste Mindestaufenthalt.
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
  const [v, setV] = useState(av);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Maximalaufenthalt"
      subtitle="Maximale Anzahl Nächte, die dein Objekt gebucht werden kann."
      channels={["direct", "airbnb", "booking"]}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label="Maximalaufenthalt *">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={v.maxStay}
            onChange={(e) => setV({ ...v, maxStay: Number(e.target.value) || 1 })}
          />
          <span className="text-sm text-muted-foreground">Nächte</span>
        </div>
      </Field>
      <Hint>
        Der maximal zulässige Aufenthalt bei Booking.com beträgt 90 Nächte. Bei einem
        höheren Wert wird automatisch dieses Limit angewendet.
      </Hint>
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
  const [pc, setPc] = useState<PerChannel<T>>(av[field] as PerChannel<T>);
  const { busy, error, run } = useSaver(onSave);

  function commit() {
    run({ ...av, [field]: pc } as Availability);
  }

  return (
    <EditorShell
      title={title}
      subtitle={subtitle}
      channels={CHANNELS}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} />}
    >
      {/* Globaler Wert (deaktiviert, wenn pro Kanal) */}
      <Field label="Für alle Kanäle">
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
        <span className="font-medium">Eigene Einstellung pro Kanal</span>
        <Switch checked={pc.custom} onCheckedChange={(c) => setPc({ ...pc, custom: c })} />
      </label>

      {pc.custom && (
        <div className="flex flex-col gap-4">
          {CHANNELS.map((c) => (
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
  const [v, setV] = useState(av);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title="Gesperrte Check-in/out-Tage"
      subtitle="Lege fest, an welchen Wochentagen Check-in und Check-out nicht möglich sind."
      channels={["direct", "airbnb", "booking"]}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <div className="flex flex-col gap-3">
        <p className="font-medium">Gesperrte Tage für Check-in</p>
        <p className="text-sm text-muted-foreground">
          An den ausgewählten Tagen ist kein Check-in möglich.
        </p>
        <DayChecks
          value={v.unavailableCheckIn}
          onChange={(f) => setV({ ...v, unavailableCheckIn: f })}
        />
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-3">
        <p className="font-medium">Gesperrte Tage für Check-out</p>
        <p className="text-sm text-muted-foreground">
          An den ausgewählten Tagen ist kein Check-out möglich.
        </p>
        <DayChecks
          value={v.unavailableCheckOut}
          onChange={(f) => setV({ ...v, unavailableCheckOut: f })}
        />
      </div>
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
