import type { Meta, StoryObj } from "@storybook/react";

import { ListingCard } from "@/components/mobile/ListingCard";
import { withMobileTheme } from "@/components/mobile/_decorator";

/**
 * Unterkunft-Karte der Mobile-App (Gast-Erlebnis).
 *
 * Foto (Gradient-Fallback ohne Bild) mit optionalem Tag + Favorit-Herz, Titel +
 * Bewertung, Ort, Preis/Nacht. Portiert 1:1 aus `apps/mobile/components/ListingCard`.
 */
const meta = {
  title: "Mobile-App/UI/Unterkunft-Karte",
  component: ListingCard,
  tags: ["autodocs"],
  decorators: [withMobileTheme()],
} satisfies Meta<typeof ListingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MitTag: Story = {
  args: {
    grad: "grad1",
    place: "Sylt, Deutschland",
    title: "Ferienhaus am Deich",
    rating: "4,8",
    reviews: 21,
    price: 245,
    currency: "EUR",
    tag: "Gäste-Favorit",
    fav: true,
  },
};

// Fremdwährung aus den Daten (CHF) — kein €-Hardcode.
export const Fremdwaehrung: Story = {
  args: {
    grad: "grad2",
    place: "Zermatt, Schweiz",
    title: "Chalet mit Bergblick",
    rating: "4,9",
    reviews: 63,
    price: 390,
    currency: "CHF",
  },
};

// Fehlende Währung → reine Zahl ohne erfundenes Symbol.
export const OhneWaehrung: Story = {
  args: {
    grad: "grad3",
    place: "Silkeborg, Dänemark",
    title: "Hytte ved Skoven",
    rating: "4,89",
    reviews: 74,
    price: 132,
    currency: null,
  },
};
