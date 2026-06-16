import type { Meta, StoryObj } from "@storybook/react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta = {
  title: "UI-Bausteine/Select",
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

// Beispiel: property_type-Werte (echte Enum-Werte aus den Migrationen).
function PropertyTypeSelect(props: React.ComponentProps<typeof Select>) {
  return (
    <Select {...props}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Objektart wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ferienhaus">Ferienhaus</SelectItem>
        <SelectItem value="appartement">Appartement</SelectItem>
        <SelectItem value="glamping">Glamping</SelectItem>
        <SelectItem value="tiny_house">Tiny House</SelectItem>
        <SelectItem value="stellplatz">Stellplatz</SelectItem>
        <SelectItem value="hausboot">Hausboot</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Standard: leerer Auswahlzustand mit Platzhalter.
export const Standard: Story = {
  render: () => <PropertyTypeSelect />,
};

// Vorausgewählt: ein Wert ist bereits gesetzt.
export const Vorausgewaehlt: Story = {
  render: () => <PropertyTypeSelect defaultValue="ferienhaus" />,
};

// Mit Gruppen-Label und Trennlinie.
export const MitGruppe: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Objektart wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Gebäude</SelectLabel>
          <SelectItem value="ferienhaus">Ferienhaus</SelectItem>
          <SelectItem value="appartement">Appartement</SelectItem>
          <SelectItem value="tiny_house">Tiny House</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Outdoor &amp; Wasser</SelectLabel>
          <SelectItem value="glamping">Glamping</SelectItem>
          <SelectItem value="stellplatz">Stellplatz</SelectItem>
          <SelectItem value="hausboot">Hausboot</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

// Deaktiviert: gesamtes Feld nicht bedienbar.
export const Deaktiviert: Story = {
  render: () => <PropertyTypeSelect disabled defaultValue="appartement" />,
};

// Einzelne Option deaktiviert.
export const OptionDeaktiviert: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Objektart wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ferienhaus">Ferienhaus</SelectItem>
        <SelectItem value="appartement">Appartement</SelectItem>
        <SelectItem value="glamping" disabled>
          Glamping (nicht verfügbar)
        </SelectItem>
        <SelectItem value="hausboot">Hausboot</SelectItem>
      </SelectContent>
    </Select>
  ),
};
