import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { InventoryItem } from "./inventory-item";

/**
 * Inventar-Zeile (inventory-item) — fachliche PMS-Komponente.
 *
 * Lastenheft-Modul §2.5 (Inventar-Verwaltung).
 * Zugehörige Tabelle: `inventory_items` (Bestand je Artikel; optionale
 * Objekt-Zuordnung über `property_id`, sonst zentraler Pool).
 *
 * Zeigt Artikelname, aktuelle Menge mit +/- Buttons und eine Badge mit
 * der Objekt-Zuordnung oder "Zentraler Pool". Beispiel: Wäschepakete.
 * Bei Bestand am/unter Minimum wird die Menge destruktiv hervorgehoben.
 */
const meta = {
  title: "PMS-Komponenten/Inventar-Zeile",
  component: InventoryItem,
  tags: ["autodocs"],
  argTypes: {
    quantity: { control: { type: "number" } },
    min: { control: { type: "number" } },
    max: { control: { type: "number" } },
    readOnly: { control: "boolean" },
  },
} satisfies Meta<typeof InventoryItem>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: Wäschepakete im zentralen Pool (statisch, ohne State).
export const Standard: Story = {
  args: {
    name: "Wäschepakete",
    quantity: 24,
    unit: "Pakete",
    icon: "ph:tote",
  },
};

// Einem Objekt zugeordnet (Objekt-Zuordnung-Badge).
export const MitObjektZuordnung: Story = {
  args: {
    name: "Handtuch-Sets",
    quantity: 12,
    unit: "Sets",
    icon: "ph:towel",
    assignment: { propertyName: "Ferienhaus Skagen" },
  },
};

// Zentraler Pool (ohne Objekt-Zuordnung).
export const ZentralerPool: Story = {
  args: {
    name: "Bettwäsche-Garnituren",
    quantity: 48,
    unit: "Stk.",
    icon: "ph:bed",
  },
};

// Niedriger Bestand: Menge am Minimum → destruktive Hervorhebung.
export const NiedrigerBestand: Story = {
  args: {
    name: "Wäschepakete",
    quantity: 1,
    unit: "Pakete",
    icon: "ph:tote",
    min: 1,
    assignment: { propertyName: "Appartement Hafenblick" },
  },
};

// Schreibgeschützt: +/- Buttons deaktiviert.
export const Schreibgeschuetzt: Story = {
  args: {
    name: "Reinigungs-Kits",
    quantity: 7,
    unit: "Kits",
    icon: "ph:spray-bottle",
    readOnly: true,
  },
};

// Interaktiv: +/- Buttons ändern die Menge (lokaler State).
export const Interaktiv: Story = {
  args: {
    name: "Wäschepakete",
    quantity: 10,
    unit: "Pakete",
    icon: "ph:tote",
    min: 0,
    max: 50,
  },
  render: (args) => {
    const [qty, setQty] = useState(args.quantity);
    return (
      <InventoryItem {...args} quantity={qty} onQuantityChange={setQty} />
    );
  },
};

// Liste: mehrere Inventar-Zeilen untereinander.
export const Liste: Story = {
  args: {
    name: "Wäschepakete",
    quantity: 24,
  },
  render: () => (
    <div className="flex w-[480px] flex-col gap-2">
      <InventoryItem
        name="Wäschepakete"
        quantity={24}
        unit="Pakete"
        icon="ph:tote"
      />
      <InventoryItem
        name="Handtuch-Sets"
        quantity={12}
        unit="Sets"
        icon="ph:towel"
        assignment={{ propertyName: "Ferienhaus Skagen" }}
      />
      <InventoryItem
        name="Bettwäsche-Garnituren"
        quantity={1}
        unit="Stk."
        icon="ph:bed"
        min={1}
        assignment={{ propertyName: "Glamping-Lodge Seeblick" }}
      />
      <InventoryItem
        name="Reinigungs-Kits"
        quantity={7}
        unit="Kits"
        icon="ph:spray-bottle"
        readOnly
      />
    </div>
  ),
};
