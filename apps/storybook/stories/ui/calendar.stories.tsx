import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";

const meta = {
  title: "UI-Bausteine/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Kalender-Primitiv auf Basis von react-day-picker v9 im myNextDays-Branding: " +
          "deutsche Lokalisierung ist fest eingebaut, Auswahl in Logo-Rot, Heute betont, " +
          "Navigation mit Phosphor-Pfeilen. Unterstützt Einzeldatum, Zeitraum (Anreise–Abreise), " +
          "mehrere Monate und gesperrte Tage.",
      },
    },
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Einzeldatum: ein Tag wird ausgewählt (z.B. Anreisetag einer Reservierung). */
export const Einzeldatum: Story = {
  render: () => {
    const [datum, setDatum] = useState<Date | undefined>(new Date(2026, 6, 10));
    return (
      <div className="rounded-(--radius) border border-border">
        <Calendar
          mode="single"
          selected={datum}
          onSelect={(d) => {
            setDatum(d);
            console.log("Datum gewählt:", d);
          }}
          defaultMonth={new Date(2026, 6)}
        />
      </div>
    );
  },
};

/** Zeitraum: Anreise bis Abreise als zusammenhängender Bereich (mode="range"). */
export const Zeitraum: Story = {
  render: () => {
    const [zeitraum, setZeitraum] = useState<DateRange | undefined>({
      from: new Date(2026, 6, 10),
      to: new Date(2026, 6, 17),
    });
    return (
      <div className="rounded-(--radius) border border-border">
        <Calendar
          mode="range"
          selected={zeitraum}
          onSelect={(bereich) => {
            setZeitraum(bereich);
            console.log("Zeitraum gewählt:", bereich);
          }}
          defaultMonth={new Date(2026, 6)}
        />
      </div>
    );
  },
};

/** Zwei Monate nebeneinander: praktisch für längere Aufenthalte über den Monatswechsel. */
export const ZweiMonate: Story = {
  render: () => {
    const [zeitraum, setZeitraum] = useState<DateRange | undefined>({
      from: new Date(2026, 6, 28),
      to: new Date(2026, 7, 4),
    });
    return (
      <div className="rounded-(--radius) border border-border">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={zeitraum}
          onSelect={setZeitraum}
          defaultMonth={new Date(2026, 6)}
          classNames={{ months: "flex flex-row gap-4" }}
        />
      </div>
    );
  },
};

/** Gesperrte Tage: bereits belegte Nächte (booked) und Vergangenheit sind nicht wählbar. */
export const GesperrteTage: Story = {
  render: () => {
    const [datum, setDatum] = useState<Date | undefined>(undefined);
    return (
      <div className="rounded-(--radius) border border-border">
        <Calendar
          mode="single"
          selected={datum}
          onSelect={setDatum}
          defaultMonth={new Date(2026, 6)}
          disabled={[
            // Vergangenheit ist keine gültige Anreise.
            { before: new Date(2026, 6, 2) },
            // Belegte Nächte im Ferienhaus „Strandblick“ (availability_status: booked).
            { from: new Date(2026, 6, 14), to: new Date(2026, 6, 19) },
            { from: new Date(2026, 6, 24), to: new Date(2026, 6, 26) },
          ]}
        />
      </div>
    );
  },
};
