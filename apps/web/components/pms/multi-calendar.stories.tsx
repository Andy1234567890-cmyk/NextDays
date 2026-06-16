/**
 * Multi-Kalender — das Herzstück des PMS (Belegungs-Übersicht).
 *
 * Lastenheft-Modul: §2.2 Herzstück (Multi-Objekt-Kalender).
 * Zugehörige Tabellen: `properties` (Zeilen/Objekte), `reservations`
 * (Buchungen, Feld `reservation_channel` & `status`) sowie `availability`
 * (Sperrungen, `availability_status = blocked`).
 *
 * Darstellung: Objekte als Zeilen × Tage als Spalten. Jede Zelle ist farb-
 * codiert nach Belegungs-Status (frei / bestätigt / Anfrage / abgeschlossen /
 * gesperrt), zeigt die Saison als dezenten Hintergrund und Buchungsdetails per
 * Tooltip. Eine Legende erläutert die Farben.
 *
 * Echte Enum-Werte (BUILD_REFERENCE):
 *  - reservation_channel: direct | portal | booking | airbnb | vrbo
 *  - reservation_status:  pending | confirmed | cancelled | completed
 *  - availability_status: open | booked | blocked
 *  - property_type: ferienhaus | appartement | glamping | tiny_house | stellplatz | hausboot
 */
import type { Meta, StoryObj } from "@storybook/react";

import {
  MultiCalendar,
  type CalendarBlock,
  type CalendarProperty,
  type CalendarReservation,
  type Season,
} from "./multi-calendar";

const meta = {
  title: "PMS-Komponenten/Multi-Kalender",
  component: MultiCalendar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    days: { control: { type: "number", min: 7, max: 31, step: 1 } },
    showLegend: { control: "boolean" },
  },
} satisfies Meta<typeof MultiCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/*  Realistische Beispieldaten                                                  */
/* -------------------------------------------------------------------------- */

// Fester Startpunkt, damit die Stories deterministisch aussehen.
const START = "2026-06-01";

// 3 Objekte unterschiedlichen Typs (echte property_type-Enums).
const OBJEKTE: CalendarProperty[] = [
  { id: "p1", name: "Strandhaus Düne 7", type: "ferienhaus" },
  { id: "p2", name: "Hafenblick Whg. 3", type: "appartement" },
  { id: "p3", name: "Hausboot „Möwe\"", type: "hausboot" },
];

// Mehrere Reservierungen über verschiedene Kanäle und Status hinweg.
const RESERVIERUNGEN: CalendarReservation[] = [
  // Objekt 1 — Strandhaus
  {
    id: "r1",
    propertyId: "p1",
    guestFirstName: "Lena",
    channel: "direct",
    status: "completed",
    from: "2026-06-01",
    to: "2026-06-05",
  },
  {
    id: "r2",
    propertyId: "p1",
    guestFirstName: "Markus",
    channel: "booking",
    status: "confirmed",
    from: "2026-06-06",
    to: "2026-06-13",
  },
  {
    id: "r3",
    propertyId: "p1",
    guestFirstName: "Sofia",
    channel: "airbnb",
    status: "pending",
    from: "2026-06-15",
    to: "2026-06-19",
  },
  // Objekt 2 — Appartement
  {
    id: "r4",
    propertyId: "p2",
    guestFirstName: "Jonas",
    channel: "vrbo",
    status: "confirmed",
    from: "2026-06-02",
    to: "2026-06-09",
  },
  {
    id: "r5",
    propertyId: "p2",
    guestFirstName: "Mette",
    channel: "portal",
    status: "confirmed",
    from: "2026-06-10",
    to: "2026-06-14",
  },
  {
    id: "r6",
    propertyId: "p2",
    guestFirstName: "Storniert",
    channel: "booking",
    status: "cancelled", // belegt den Kalender NICHT (zur Demo)
    from: "2026-06-16",
    to: "2026-06-20",
  },
  // Objekt 3 — Hausboot
  {
    id: "r7",
    propertyId: "p3",
    guestFirstName: "Anders",
    channel: "airbnb",
    status: "confirmed",
    from: "2026-06-07",
    to: "2026-06-12",
  },
  {
    id: "r8",
    propertyId: "p3",
    guestFirstName: "Clara",
    channel: "direct",
    status: "pending",
    from: "2026-06-18",
    to: "2026-06-21",
  },
];

// Sperrungen (availability_status = blocked): Eigennutzung & Wartung.
const SPERRUNGEN: CalendarBlock[] = [
  {
    id: "b1",
    propertyId: "p1",
    reason: "Wartung Heizung",
    from: "2026-06-13",
    to: "2026-06-15",
  },
  {
    id: "b2",
    propertyId: "p3",
    reason: "Eigennutzung Eigentümer",
    from: "2026-06-01",
    to: "2026-06-05",
  },
];

// Saison-Logik: Juni-zweite-Hälfte = Hauptsaison, sonst Zwischensaison.
const seasonFor = (date: Date): Season => {
  const tag = date.getDate();
  if (date.getMonth() === 5 && tag >= 15) return "high";
  if (date.getMonth() === 5) return "mid";
  return "low";
};

/* -------------------------------------------------------------------------- */
/*  Stories                                                                     */
/* -------------------------------------------------------------------------- */

// Standard: 3 Objekte, 21 Tage, gemischte Buchungen + Sperrungen + Saison.
export const Standard: Story = {
  args: {
    properties: OBJEKTE,
    reservations: RESERVIERUNGEN,
    blocks: SPERRUNGEN,
    startDate: START,
    days: 21,
    seasonFor,
    showLegend: true,
  },
};

// Kompakte Wochenansicht (7 Tage) — für enge Layouts/Seitenleisten.
export const Wochenansicht: Story = {
  args: {
    ...Standard.args,
    days: 7,
  },
};

// Voller Monat (30 Tage) — zeigt horizontales Scrollen & sticky Objekt-Spalte.
export const Monatsansicht: Story = {
  args: {
    ...Standard.args,
    days: 30,
  },
};

// Ohne Saison-Hintergrund (alles Nebensaison) — reine Status-Farben.
export const OhneSaison: Story = {
  args: {
    ...Standard.args,
    seasonFor: undefined,
  },
};

// Leerer Kalender: alle Tage frei (keine Buchungen/Sperrungen).
export const AllesFrei: Story = {
  args: {
    properties: OBJEKTE,
    reservations: [],
    blocks: [],
    startDate: START,
    days: 14,
    seasonFor,
  },
};

// Einzelnes Objekt im Fokus (z.B. Detailseite eines Objekts).
export const EinObjekt: Story = {
  args: {
    properties: [OBJEKTE[0]],
    reservations: RESERVIERUNGEN.filter((r) => r.propertyId === "p1"),
    blocks: SPERRUNGEN.filter((b) => b.propertyId === "p1"),
    startDate: START,
    days: 21,
    seasonFor,
  },
};

// Interaktiv: Klick auf eine Zelle (z.B. Buchung anlegen) — Demo via alert.
export const MitZellklick: Story = {
  args: {
    ...Standard.args,
    onCellClick: (propertyId, dateKey) =>
      // eslint-disable-next-line no-alert
      window.alert(`Objekt ${propertyId} · Tag ${dateKey}`),
  },
};
