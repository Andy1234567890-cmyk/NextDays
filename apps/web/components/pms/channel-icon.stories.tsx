/**
 * Channel-Icon — Kanal-Icon + Label für reservation_channel.
 *
 * Lastenheft-Modul: §3 (Buchungen / Reservierungen).
 * Zugehörige Tabelle: `reservations` (Feld `reservation_channel`).
 * Echte Enum-Werte: direct | portal | booking | airbnb | vrbo.
 * Deutsche Labels: Direktbuchung, Portal, Booking.com, Airbnb, Vrbo.
 */
import type { Meta, StoryObj } from "@storybook/react";

import { ChannelIcon, type ReservationChannel } from "./channel-icon";

const meta = {
  title: "PMS-Komponenten/Kanal-Icon",
  component: ChannelIcon,
  tags: ["autodocs"],
  argTypes: {
    channel: {
      control: "select",
      options: ["direct", "portal", "booking", "airbnb", "vrbo"],
      description: "Buchungskanal (reservation_channel)",
    },
    size: {
      control: "inline-radio",
      options: ["sm", "default", "lg"],
    },
    iconOnly: { control: "boolean" },
  },
  args: {
    channel: "direct",
  },
} satisfies Meta<typeof ChannelIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: Direktbuchung mit Icon und Label.
export const Standard: Story = {};

// Alle Kanäle untereinander (echte Enum-Werte).
const ALLE_KANAELE: ReservationChannel[] = [
  "direct",
  "portal",
  "booking",
  "airbnb",
  "vrbo",
];

export const AlleKanaele: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {ALLE_KANAELE.map((kanal) => (
        <ChannelIcon key={kanal} channel={kanal} />
      ))}
    </div>
  ),
};

// Nur Icon (kompakt, z.B. in dichten Tabellen) — Label per Tooltip.
export const NurIcon: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {ALLE_KANAELE.map((kanal) => (
        <ChannelIcon key={kanal} channel={kanal} iconOnly />
      ))}
    </div>
  ),
};

// Größen-Varianten.
export const Groessen: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <ChannelIcon channel="booking" size="sm" />
      <ChannelIcon channel="booking" size="default" />
      <ChannelIcon channel="booking" size="lg" />
    </div>
  ),
};

// Einsatz in einer Reservierungsliste (realistisches Beispiel).
export const InReservierungsliste: Story = {
  render: () => (
    <div className="w-80 divide-y divide-border rounded-(--radius) border border-border">
      {[
        { gast: "Lena", kanal: "direct" as const },
        { gast: "Markus", kanal: "booking" as const },
        { gast: "Sofia", kanal: "airbnb" as const },
        { gast: "Jonas", kanal: "vrbo" as const },
        { gast: "Mette", kanal: "portal" as const },
      ].map((r) => (
        <div
          key={r.gast}
          className="flex items-center justify-between px-3 py-2 text-sm"
        >
          <span className="text-foreground">{r.gast}</span>
          <ChannelIcon channel={r.kanal} size="sm" />
        </div>
      ))}
    </div>
  ),
};
