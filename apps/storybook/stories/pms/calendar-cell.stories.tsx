import type { Meta, StoryObj } from "@storybook/react";

import { CalendarCell, type AvailabilityStatus } from "@/components/pms/calendar-cell";

/**
 * Kalender-Tageszelle — fachliche PMS-Komponente.
 *
 * Lastenheft-Modul: §2.2 (Verfügbarkeit & Multi-Kalender / Buchungsverwaltung).
 *
 * Einzelne Tageszelle als Baustein für das Multi-Kalender-Grid: zeigt das Datum,
 * den farbcodierten Verfügbarkeits-Status, optional den Preis pro Nacht
 * (via price-display), einen optionalen Event-Punkt sowie einen Hover-Stil und
 * ein editierbar-Flag.
 *
 * Zugehörige Tabelle/Enum:
 * - availability_status → Tabelle `availability` (Single Source of Truth, kein
 *   Double-Booking)
 *
 * Echte Enum-Werte (availability_status): `open` (Frei), `booked` (Belegt),
 * `blocked` (Gesperrt).
 *
 * Farb-Konvention (Lastenheft): open = dezent/frei, booked = sekundär/belegt,
 * blocked = destructive/gesperrt. Beträge sind GLATT (ohne Cent).
 */
const meta: Meta<typeof CalendarCell> = {
  title: "PMS-Komponenten/Kalender-Tageszelle",
  component: CalendarCell,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["open", "booked", "blocked"],
      description: "Verfügbarkeits-Status (availability_status).",
    },
    currency: { control: "select", options: ["EUR", "DKK"] },
    editable: { control: "boolean" },
    selected: { control: "boolean" },
    hasEvent: { control: "boolean" },
  },
  args: {
    date: "2026-06-15",
    status: "open",
  },
  // Zellen sind schmal — Breite begrenzen für realistische Darstellung.
  decorators: [
    (Story) => (
      <div className="w-28">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CalendarCell>;

/** Standard: freier Tag mit Preis pro Nacht, bearbeitbar. */
export const Standard: Story = {
  args: {
    status: "open",
    price: 120,
    currency: "EUR",
    editable: true,
  },
};

/** Frei (open) — verfügbarer Tag mit Preis. */
export const Frei: Story = {
  args: {
    status: "open",
    price: 120,
    currency: "EUR",
    editable: true,
  },
};

/** Belegt (booked) — gebuchter Tag, Anreise als Event-Punkt. */
export const Belegt: Story = {
  args: {
    status: "booked",
    price: 120,
    currency: "EUR",
    hasEvent: true,
    eventLabel: "Anreise",
    editable: true,
  },
};

/** Gesperrt (blocked) — manuell gesperrter Tag ohne Preis. */
export const Gesperrt: Story = {
  args: {
    status: "blocked",
    editable: true,
  },
};

/** Mit Event-Punkt — z.B. Aufgabe oder Notiz an diesem Tag. */
export const MitEvent: Story = {
  args: {
    status: "open",
    price: 95,
    currency: "EUR",
    hasEvent: true,
    eventLabel: "Reinigung geplant",
    editable: true,
  },
};

/** Ausgewählt — hervorgehobene Zelle (Auswahl im Grid). */
export const Ausgewaehlt: Story = {
  args: {
    status: "open",
    price: 120,
    currency: "EUR",
    editable: true,
    selected: true,
  },
};

/** Nur Lesen — nicht editierbar, kein Hover-/Cursor-Feedback. */
export const NurLesen: Story = {
  args: {
    status: "booked",
    price: 120,
    currency: "EUR",
    editable: false,
  },
};

/** Währung DKK — Preis in Kronen (glatter Betrag ohne Cent). */
export const WaehrungDKK: Story = {
  args: {
    status: "open",
    price: 900,
    currency: "DKK",
    editable: true,
  },
};

/** Alle Status — Übersicht der echten availability_status-Werte. */
export const AlleStatus: Story = {
  render: () => {
    const states: { status: AvailabilityStatus; price?: number; event?: boolean }[] = [
      { status: "open", price: 120 },
      { status: "booked", price: 120, event: true },
      { status: "blocked" },
    ];
    return (
      <div className="flex gap-3">
        {states.map((s, i) => (
          <div key={s.status} className="flex w-24 flex-col items-center gap-2">
            <CalendarCell
              date={`2026-06-${15 + i}`}
              status={s.status}
              price={s.price}
              currency="EUR"
              hasEvent={s.event}
              eventLabel={s.event ? "Anreise" : undefined}
              editable
            />
            <code className="text-xs text-muted-foreground">{s.status}</code>
          </div>
        ))}
      </div>
    );
  },
};

/** Beispiel-Woche — Mini-Grid als Vorschau auf das Multi-Kalender-Grid. */
export const BeispielWoche: Story = {
  render: () => {
    const week: { day: number; status: AvailabilityStatus; price?: number; event?: boolean }[] = [
      { day: 15, status: "open", price: 120 },
      { day: 16, status: "open", price: 120 },
      { day: 17, status: "booked", price: 120, event: true },
      { day: 18, status: "booked", price: 120 },
      { day: 19, status: "booked", price: 120 },
      { day: 20, status: "blocked" },
      { day: 21, status: "open", price: 150 },
    ];
    return (
      <div className="grid w-104 grid-cols-7 gap-1">
        {week.map((d) => (
          <CalendarCell
            key={d.day}
            date={`2026-06-${d.day}`}
            status={d.status}
            price={d.price}
            currency="EUR"
            hasEvent={d.event}
            eventLabel={d.event ? "Anreise" : undefined}
            editable
          />
        ))}
      </div>
    );
  },
};
