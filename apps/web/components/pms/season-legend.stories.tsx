import type { Meta, StoryObj } from "@storybook/react";

import { SeasonLegend, type SeasonCategory } from "./season-legend";

/**
 * Saison-Legende (Lastenheft §2.3).
 *
 * Farb-Legende für Saison-Kategorien: je Kategorie ein Farbkästchen, ein Label
 * und ein Badge mit dem prozentualen Aufschlag gegenüber dem Basispreis.
 * Beispiel A–D (Nebensaison, Zwischensaison, Hauptsaison, Hochsaison).
 *
 * Fachliche Regel (§2.3): Die Saison steuert den Preis-Aufschlag, der bei der
 * Tarif-/Verfügbarkeitsberechnung auf den Basispreis aufgeschlagen wird.
 *
 * Zugehörige Tabelle: `availability` (Preis je Tag) bzw. saisonale Preis-Regeln;
 * der Aufschlag fließt in die `reservations`-Summen ein. Farben rein über
 * semantische Tokens (keine Hex-Werte).
 */
const meta = {
  title: "PMS-Komponenten/Saison-Legende",
  component: SeasonLegend,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text", description: "Überschrift der Legende." },
    description: {
      control: "text",
      description: "Beschreibungstext unter der Überschrift.",
    },
  },
} satisfies Meta<typeof SeasonLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

// Beispiel A–D: vier Saison-Kategorien mit steigendem Aufschlag.
const beispielAbisD: SeasonCategory[] = [
  { key: "a", label: "Nebensaison", color: "secondary", surchargePercent: 0 },
  { key: "b", label: "Zwischensaison", color: "success", surchargePercent: 15 },
  { key: "c", label: "Hauptsaison", color: "warning", surchargePercent: 30 },
  { key: "d", label: "Hochsaison", color: "destructive", surchargePercent: 50 },
];

/** Standard: Beispiel A–D mit vier Saison-Kategorien. */
export const Standard: Story = {
  args: {
    categories: beispielAbisD,
  },
};

/** Nur zwei Kategorien (Neben- und Hauptsaison). */
export const ZweiKategorien: Story = {
  args: {
    categories: [
      { key: "a", label: "Nebensaison", color: "secondary", surchargePercent: 0 },
      { key: "b", label: "Hauptsaison", color: "warning", surchargePercent: 25 },
    ],
  },
};

/** Eigene Überschrift und Beschreibung. */
export const EigeneBeschriftung: Story = {
  args: {
    title: "Preis-Saisons 2026",
    description: "Aufschläge gelten je Übernachtung auf den Netto-Basispreis.",
    categories: beispielAbisD,
  },
};

/** Feine Abstufung mit fünf Saison-Stufen. */
export const FuenfStufen: Story = {
  args: {
    title: "Saison-Stufen",
    categories: [
      { key: "a", label: "Winterpause", color: "secondary", surchargePercent: 0 },
      { key: "b", label: "Vorsaison", color: "success", surchargePercent: 10 },
      { key: "c", label: "Zwischensaison", color: "primary", surchargePercent: 20 },
      { key: "d", label: "Hauptsaison", color: "warning", surchargePercent: 35 },
      { key: "e", label: "Hochsaison", color: "destructive", surchargePercent: 60 },
    ],
  },
};
