import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { type FontEntry, FontPicker } from "@/components/builder/font-picker";

/**
 * Font-Picker des Page-Builders (Framer-artig).
 *
 * Suchfeld, Kategorie-Filter (Sans/Serif/Display/Schreib/Mono) und
 * Schriftenliste mit Vorschau in der jeweiligen Familie. Im Produkt kommt
 * der volle Google-Fonts-Katalog über den server-seitigen Proxy
 * `/api/google-fonts` und wird zur Laufzeit per `<link>` geladen — global
 * (Typografie der Seite) oder je Element überschreibbar.
 */
const meta = {
  title: "Page-Builder/Font-Picker",
  component: FontPicker,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof FontPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

// Ausschnitt des Katalogs — Vorschau über lokal verfügbare/ähnliche Familien.
const FONTS: FontEntry[] = [
  { family: "Inter", category: "sans-serif" },
  { family: "Roboto", category: "sans-serif" },
  { family: "Open Sans", category: "sans-serif" },
  { family: "Montserrat", category: "sans-serif" },
  { family: "Poppins", category: "sans-serif" },
  { family: "Playfair Display", category: "serif" },
  { family: "Merriweather", category: "serif" },
  { family: "Lora", category: "serif" },
  { family: "Noto Serif", category: "serif" },
  { family: "Oswald", category: "display" },
  { family: "Bebas Neue", category: "display" },
  { family: "Caveat", category: "handwriting" },
  { family: "Pacifico", category: "handwriting" },
  { family: "JetBrains Mono", category: "monospace" },
  { family: "IBM Plex Mono", category: "monospace" },
];

export const Standard: Story = {
  args: {
    fonts: FONTS,
    value: "Inter",
    onChange: (family: string) => console.log("Schrift:", family),
    onClose: () => console.log("schließen"),
  },
};

export const OhneAuswahl: Story = {
  args: { fonts: FONTS, value: null },
};

export const Interaktiv: Story = {
  args: { fonts: FONTS },
  render: () => {
    const [family, setFamily] = useState<string | null>("Playfair Display");
    return <FontPicker fonts={FONTS} value={family} onChange={setFamily} />;
  },
};
