import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { MultiSelect } from "@/components/ui/multi-select";

const meta = {
  title: "UI-Bausteine/MultiSelect",
  component: MultiSelect,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Durchsuchbares Multiselect (cmdk + Popover). Für große Listen — z. B. " +
          "eine Agentur mit 100+ Unterkünften: Suchfeld + scrollbare Treffer statt " +
          "langer Checkbox-Spalte. Auswahl als Chips; leere Auswahl = alle.",
      },
    },
  },
} satisfies Meta<typeof MultiSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

// Beispiel: viele Unterkünfte (wie in der Automail-Zuweisung / Inbox-Filter).
const PROPERTIES = Array.from({ length: 24 }, (_, i) => ({
  value: `p-${i + 1}`,
  label:
    [
      "Haus Max",
      "Doppelzimmer Nord",
      "Lærkevej 10",
      "Rævlingevej 4",
      "Oddenvej 3",
      "Stjerneskud",
      "Mosbjergvej 439",
      "Strandhaus See",
    ][i % 8] + ` ${Math.floor(i / 8) + 1}`,
}));

export const Unterkuenfte: Story = {
  args: {
    options: PROPERTIES,
    selected: [],
    onChange: () => {},
    placeholder: "Alle Unterkünfte",
    searchPlaceholder: "Unterkunft suchen …",
    allLabel: "Alle Unterkünfte",
  },
  render: (args) => {
    const [sel, setSel] = useState<string[]>(args.selected);
    return (
      <div className="w-80">
        <MultiSelect {...args} selected={sel} onChange={setSel} />
      </div>
    );
  },
};

export const MitVorauswahl: Story = {
  ...Unterkuenfte,
  args: { ...Unterkuenfte.args, selected: ["p-1", "p-3"] },
};

export const Kanaele: Story = {
  args: {
    options: ["myNextDays", "Booking.com", "Airbnb", "Vrbo", "Expedia"].map(
      (c) => ({ value: c, label: c }),
    ),
    selected: ["Airbnb"],
    onChange: () => {},
    placeholder: "Alle Kanäle",
    searchPlaceholder: "Kanal suchen …",
    allLabel: "Alle Kanäle",
  },
  render: (args) => {
    const [sel, setSel] = useState<string[]>(args.selected);
    return (
      <div className="w-72">
        <MultiSelect {...args} selected={sel} onChange={setSel} />
      </div>
    );
  },
};
