import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";

const meta = {
  title: "UI-Bausteine/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Gebrandeter Datepicker (Popover + react-day-picker v9) im myNextDays-Stil: " +
          "abgerundet, Auswahl/Heute/Fokus in Logo-Rot, deutsche Lokalisierung, " +
          "Phosphor-Pfeile. Ersetzt das native <input type=date>, dessen Popup-Chrome " +
          "sich nicht branden lässt. Wert ist ein ISO-String (YYYY-MM-DD).",
      },
    },
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: { value: "", onChange: () => {}, placeholder: "Datum wählen" },
  render: (args) => {
    const [v, setV] = useState(args.value);
    return (
      <div className="w-56">
        <DatePicker {...args} value={v} onChange={setV} />
      </div>
    );
  },
};

export const Zeitraum: Story = {
  args: { value: "", onChange: () => {} },
  render: () => {
    const [from, setFrom] = useState("2026-07-01");
    const [to, setTo] = useState("2026-07-31");
    return (
      <div className="grid w-72 grid-cols-2 gap-2">
        <DatePicker value={from} onChange={setFrom} placeholder="Von" />
        <DatePicker value={to} onChange={setTo} placeholder="Bis" />
      </div>
    );
  },
};

// Der Kalender-Baustein direkt (Branding: Auswahl in Logo-Rot, Heute betont).
export const KalenderInline: Story = {
  args: { value: "", onChange: () => {} },
  render: () => {
    const [d, setD] = useState<Date | undefined>(new Date(2026, 6, 10));
    return (
      <div className="rounded-(--radius) border border-border">
        <Calendar mode="single" selected={d} onSelect={setD} />
      </div>
    );
  },
};
