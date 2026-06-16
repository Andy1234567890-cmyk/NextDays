/**
 * Zahlungs-Zeile — fachliche PMS-Komponente.
 *
 * Lastenheft-Modul: §3 (Zahlungen & Gateways) / §5 (Daten-Split & Rollen).
 * Zugehörige Tabelle: `payments`
 * (Felder u.a. payment_type, amount, status, gateway, reference).
 *
 * Gateway-Strategie (§3): Revolut primär, Stripe sekundär.
 * Beträge sind GLATT ohne Cent (§2.3); Erstattungen erscheinen negativ.
 * Die externe Referenz wird mittig gekürzt dargestellt (voller Wert via Tooltip/title).
 *
 * Es werden ausschließlich die echten Enum-Werte verwendet:
 * - payment_type: deposit | full | refund
 * - payment_status: pending | succeeded | failed | refunded
 * - payment_gateway: revolut | stripe
 */
import type { Meta, StoryObj } from "@storybook/react";

import { PaymentRow } from "./payment-row";

const meta = {
  title: "PMS-Komponenten/Zahlungs-Zeile",
  component: PaymentRow,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["deposit", "full", "refund"],
    },
    status: {
      control: "select",
      options: ["pending", "succeeded", "failed", "refunded"],
    },
    gateway: {
      control: "inline-radio",
      options: ["revolut", "stripe"],
    },
    currency: {
      control: "inline-radio",
      options: ["EUR", "DKK"],
    },
  },
  args: {
    type: "deposit",
    amount: 350,
    currency: "EUR",
    status: "succeeded",
    gateway: "revolut",
    reference: "rev_8sK3pQ9aBcd",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaymentRow>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: erfolgreiche Anzahlung über Revolut.
export const Standard: Story = {};

// Vollzahlung — erfolgreich über Revolut abgewickelt.
export const Vollzahlung: Story = {
  args: {
    type: "full",
    amount: 1250,
    status: "succeeded",
    gateway: "revolut",
    reference: "rev_4mN7tR2xYz01",
  },
};

// Ausstehend — Anzahlung wurde angestoßen, aber noch nicht bestätigt.
export const Ausstehend: Story = {
  args: {
    type: "deposit",
    amount: 350,
    status: "pending",
    gateway: "revolut",
    reference: "rev_1aZ9kP0qWer2",
  },
};

// Fehlgeschlagen — Stripe-Zahlung wurde abgelehnt (sekundäres Gateway).
export const Fehlgeschlagen: Story = {
  args: {
    type: "full",
    amount: 980,
    status: "failed",
    gateway: "stripe",
    reference: "ch_3Ph0fG2eHiJkLmN",
  },
};

// Erstattung — negativer Betrag, Status erstattet, über Stripe.
export const Erstattung: Story = {
  args: {
    type: "refund",
    amount: 350,
    status: "refunded",
    gateway: "stripe",
    reference: "re_2Qx5dC8bVfG3",
  },
};

// Dänische Krone — Vollzahlung mit glattem Kr-Betrag (Lastenheft §2.3 / §5).
export const DaenischeKrone: Story = {
  args: {
    type: "full",
    amount: 8500,
    currency: "DKK",
    status: "succeeded",
    gateway: "revolut",
    reference: "rev_7yU2hN6mLpQ4",
  },
};

// Übersicht: typische Zahlungs-Historie einer Reservierung.
export const ZahlungsHistorie: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <PaymentRow
        type="deposit"
        amount={350}
        currency="EUR"
        status="succeeded"
        gateway="revolut"
        reference="rev_8sK3pQ9aBcd"
      />
      <PaymentRow
        type="full"
        amount={900}
        currency="EUR"
        status="pending"
        gateway="revolut"
        reference="rev_1aZ9kP0qWer2"
      />
      <PaymentRow
        type="full"
        amount={900}
        currency="EUR"
        status="failed"
        gateway="stripe"
        reference="ch_3Ph0fG2eHiJkLmN"
      />
      <PaymentRow
        type="refund"
        amount={350}
        currency="EUR"
        status="refunded"
        gateway="stripe"
        reference="re_2Qx5dC8bVfG3"
      />
    </div>
  ),
};
