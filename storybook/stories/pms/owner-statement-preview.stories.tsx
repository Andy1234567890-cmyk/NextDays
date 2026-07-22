import type { Meta, StoryObj } from "@storybook/react";

import {
  OwnerStatementPreview,
  type OwnerStatement,
} from "@/components/pms/owner-statement-preview";

/**
 * Eigentümer-Abrechnung (Beleg-Vorschau) — fachliche PMS-Komponente (§5 Finanzen).
 *
 * Spiegelt die PDF-/Vorschau-Ausgabe des owner_statements-Slice: Provision je
 * Objekt, Mehrwährung (nur die Eigentümer-Auszahlung wird in die Owner-Währung
 * aus dem Herkunftsland umgerechnet — ECB-Tageskurs am Check-out, Frankfurter),
 * Verwaltungsanteil je Quellwährung (keine Mischsumme). Migrationen 0064–0070.
 */
const meta = {
  title: "PMS-Komponenten/Eigentümer-Abrechnung",
  component: OwnerStatementPreview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OwnerStatementPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

// Einwährung (EUR-Owner, EUR-Buchungen) — 29 % Provision.
const einwaehrung: OwnerStatement = {
  pmName: "Test",
  pmAddress: "Straße 1, 12345 max, DE",
  pmTaxId: "DE12345678",
  ownerName: "Test Owner",
  ownerCurrency: "EUR",
  periodFrom: "2026-07-01",
  periodTo: "2026-07-31",
  rows: [
    {
      guest: "test test", nights: 3, listing: "Haus Max", channel: "Direct",
      totalPrice: 674.94, payout: 674.94, ownerPayout: 479.21,
      currency: "EUR", ownerConverted: 479.21, fxRate: 1, fxDate: "2026-07-08",
    },
    {
      guest: "Tom Becker", nights: 3, listing: "Haus Max", channel: "Direct",
      totalPrice: 360, payout: 360, ownerPayout: 255.6,
      currency: "EUR", ownerConverted: 255.6, fxRate: 1, fxDate: "2026-07-14",
    },
  ],
};

export const Einwaehrung: Story = { args: { st: einwaehrung } };

// Mehrwährung: Owner in Schweden (SEK), eine EUR- und eine SEK-Buchung.
export const Mehrwaehrung: Story = {
  args: {
    st: {
      ...einwaehrung,
      ownerName: "Sven Eigentümer",
      ownerCurrency: "SEK",
      rows: [
        {
          guest: "Anna Berg", nights: 4, listing: "Strandhaus See", channel: "Booking.com",
          totalPrice: 1000, payout: 1000, ownerPayout: 800,
          currency: "EUR", ownerConverted: 9040, fxRate: 11.3, fxDate: "2026-07-09",
        },
        {
          guest: "Olle Nilsson", nights: 2, listing: "Stuga Nord", channel: "myNextDays",
          totalPrice: 5400, payout: 5400, ownerPayout: 4320,
          currency: "SEK", ownerConverted: 4320, fxRate: 1, fxDate: "2026-07-20",
        },
      ],
    },
  },
};
