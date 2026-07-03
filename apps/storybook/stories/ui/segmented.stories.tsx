import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Segmented } from "@/components/ui/segmented";

const meta = {
  title: "UI-Bausteine/Segmented",
  component: Segmented,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Segmentierter Pill-Umschalter in Kalender-Optik: eine Option ist immer " +
          "aktiv (heller Chip mit Schatten), die übrigen bleiben gedämpft. Generisch " +
          "über string- oder number-Werte, optional mit Iconify-Icons und " +
          "deaktivierbaren Optionen.",
      },
    },
  },
  // Pflicht-Props für die Typisierung; die Stories steuern den Wert selbst.
  args: {
    value: "woche",
    options: [
      { value: "tag", label: "Tag" },
      { value: "woche", label: "Woche" },
      { value: "monat", label: "Monat" },
    ],
    onChange: (wert) => console.log("Auswahl:", wert),
  },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Standard: Kalender-Ansicht umschalten, gesteuert über useState. */
export const Standard: Story = {
  render: () => {
    const [ansicht, setAnsicht] = useState<"tag" | "woche" | "monat">("woche");
    return (
      <Segmented
        value={ansicht}
        options={[
          { value: "tag", label: "Tag" },
          { value: "woche", label: "Woche" },
          { value: "monat", label: "Monat" },
        ]}
        onChange={(wert) => {
          setAnsicht(wert);
          console.log("Ansicht:", wert);
        }}
      />
    );
  },
};

/** Mit Icons: Darstellungswechsel für die Objektliste (Liste/Raster/Karte). */
export const MitIcons: Story = {
  render: () => {
    const [darstellung, setDarstellung] = useState<"liste" | "raster" | "karte">(
      "raster",
    );
    return (
      <Segmented
        value={darstellung}
        options={[
          { value: "liste", label: "Liste", icon: "ph:list-bullets" },
          { value: "raster", label: "Raster", icon: "ph:squares-four" },
          { value: "karte", label: "Karte", icon: "ph:map-trifold" },
        ]}
        onChange={(wert) => {
          setDarstellung(wert);
          console.log("Darstellung:", wert);
        }}
      />
    );
  },
};

/** Deaktivierte Option: noch nicht verbundener Buchungskanal bleibt sichtbar, aber gesperrt. */
export const DeaktivierteOption: Story = {
  render: () => {
    const [kanal, setKanal] = useState<"portal" | "booking" | "airbnb" | "vrbo">(
      "portal",
    );
    return (
      <div className="flex flex-col items-start gap-2">
        <Segmented
          value={kanal}
          options={[
            { value: "portal", label: "Plattform" },
            { value: "booking", label: "Booking.com" },
            { value: "airbnb", label: "Airbnb" },
            { value: "vrbo", label: "Vrbo", disabled: true },
          ]}
          onChange={(wert) => {
            setKanal(wert);
            console.log("Kanal:", wert);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Vrbo ist noch nicht verbunden und daher deaktiviert.
        </p>
      </div>
    );
  },
};

/** Klein & numerisch: kompakter Zeitraum-Umschalter mit number-Werten. */
export const KleinNumerisch: Story = {
  render: () => {
    const [tage, setTage] = useState(30);
    return (
      <Segmented
        size="sm"
        value={tage}
        options={[
          { value: 7, label: "7 Tage" },
          { value: 30, label: "30 Tage" },
          { value: 90, label: "90 Tage" },
        ]}
        onChange={(wert) => {
          setTage(wert);
          console.log("Zeitraum (Tage):", wert);
        }}
      />
    );
  },
};
