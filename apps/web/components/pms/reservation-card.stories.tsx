/**
 * Reservierungs-Karte — fachliche PMS-Komponente.
 *
 * Lastenheft-Modul: §2.2 (Reservierungsverwaltung) / §5 (Daten-Split & Rollen).
 * Zugehörige Tabelle: `reservations`
 * (Felder u.a. guest_first_name, check_in, check_out, reservation_status,
 *  reservation_channel, amount).
 *
 * Daten-Split (§5): Der Eigentümer sieht von Gästen NUR den Vornamen und
 * Netto/Nacht; Mitarbeiter (staff/cleaner) sehen keine Finanzen/Namen.
 * Die Komponente erhält daher bewusst nur den Vornamen.
 *
 * Es werden ausschließlich die echten Enum-Werte verwendet:
 * - reservation_status: pending | confirmed | cancelled | completed
 * - reservation_channel: direct | portal | booking | airbnb | vrbo
 */
import type { Meta, StoryObj } from "@storybook/react";

import { ReservationCard } from "./reservation-card";

const meta = {
  title: "PMS-Komponenten/Reservierungs-Karte",
  component: ReservationCard,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["pending", "confirmed", "cancelled", "completed"],
    },
    channel: {
      control: "select",
      options: ["direct", "portal", "booking", "airbnb", "vrbo"],
    },
    currency: {
      control: "inline-radio",
      options: ["EUR", "DKK"],
    },
  },
  args: {
    guestFirstName: "Lena",
    checkIn: "2026-07-14",
    checkOut: "2026-07-21",
    status: "confirmed",
    channel: "direct",
    amount: 1250,
    currency: "EUR",
    messageCount: 3,
  },
} satisfies Meta<typeof ReservationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: bestätigte Direktbuchung.
export const Standard: Story = {};

// Ausstehend — Buchung über Booking.com, noch nicht bestätigt.
export const Ausstehend: Story = {
  args: {
    guestFirstName: "Markus",
    status: "pending",
    channel: "booking",
    checkIn: "2026-08-02",
    checkOut: "2026-08-09",
    amount: 980,
    messageCount: 1,
  },
};

// Storniert — Airbnb-Buchung wurde abgebrochen.
export const Storniert: Story = {
  args: {
    guestFirstName: "Sophie",
    status: "cancelled",
    channel: "airbnb",
    checkIn: "2026-06-20",
    checkOut: "2026-06-27",
    amount: 1540,
    messageCount: 0,
  },
};

// Abgeschlossen — vergangener Aufenthalt über Vrbo.
export const Abgeschlossen: Story = {
  args: {
    guestFirstName: "Jonas",
    status: "completed",
    channel: "vrbo",
    checkIn: "2026-05-03",
    checkOut: "2026-05-10",
    amount: 2100,
    messageCount: 5,
  },
};

// Portal-Buchung mit dänischer Währung (glatte Beträge, Lastenheft §5).
export const DaenischeKrone: Story = {
  args: {
    guestFirstName: "Freja",
    status: "confirmed",
    channel: "portal",
    checkIn: "2026-07-01",
    checkOut: "2026-07-08",
    amount: 8500,
    currency: "DKK",
    messageCount: 2,
  },
};

// Viele ungelesene Nachrichten.
export const VieleNachrichten: Story = {
  args: {
    guestFirstName: "Anna",
    status: "confirmed",
    channel: "direct",
    messageCount: 12,
  },
};

// Übersicht: alle Status-Zustände nebeneinander.
export const AlleStatus: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <ReservationCard
        guestFirstName="Markus"
        status="pending"
        channel="booking"
        checkIn="2026-08-02"
        checkOut="2026-08-09"
        amount={980}
        messageCount={1}
      />
      <ReservationCard
        guestFirstName="Lena"
        status="confirmed"
        channel="direct"
        checkIn="2026-07-14"
        checkOut="2026-07-21"
        amount={1250}
        messageCount={3}
      />
      <ReservationCard
        guestFirstName="Sophie"
        status="cancelled"
        channel="airbnb"
        checkIn="2026-06-20"
        checkOut="2026-06-27"
        amount={1540}
        messageCount={0}
      />
      <ReservationCard
        guestFirstName="Jonas"
        status="completed"
        channel="vrbo"
        checkIn="2026-05-03"
        checkOut="2026-05-10"
        amount={2100}
        messageCount={5}
      />
    </div>
  ),
};
