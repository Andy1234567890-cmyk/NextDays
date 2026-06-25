import type { Meta, StoryObj } from "@storybook/react";

import {
  AutomailRuleCard,
  type AutomailRule,
} from "@/components/pms/automail-rule-card";

/**
 * Automail-Regel-Karte — fachliche PMS-Komponente (Posteingang §2.3).
 *
 * Planbare Auto-Nachrichten (Buchungsbestätigung, Anreise-/Check-out-Info) mit
 * Zeitplan (Anker arrival|departure|booking + vorzeichen-behaftetes Tagesdelta +
 * Uhrzeit) und Zuweisung nach Unterkunft UND Kanal (leer = alle). Daten:
 * `message_automation` + `automation_scheduled_message` (Migration 0072). Versand
 * über den Cron `/inbox/internal/dispatch-automations`.
 */
const meta = {
  title: "PMS-Komponenten/Automail-Regel",
  component: AutomailRuleCard,
  tags: ["autodocs"],
} satisfies Meta<typeof AutomailRuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const base: AutomailRule = {
  name: "Anreise-Info",
  trigger: "before_checkin",
  anchor: "arrival",
  offsetDays: -3,
  sendTime: "07:45",
  propertyTitles: [],
  channels: [],
  active: true,
};

export const AnreiseInfo: Story = { args: { rule: base } };

export const NurBestimmteHaeuserUndKanal: Story = {
  args: {
    rule: {
      ...base,
      name: "Buchungsbestätigung 1",
      trigger: "booking_new",
      anchor: "booking",
      offsetDays: 0,
      sendTime: "12:00",
      propertyTitles: ["Haus Max", "Doppelzimmer Nord", "Strandhaus See"],
      channels: ["Airbnb", "Booking.com"],
    },
  },
};

export const CheckoutInfoPausiert: Story = {
  args: {
    rule: {
      ...base,
      name: "Check-out-Info",
      trigger: "after_checkout",
      anchor: "departure",
      offsetDays: 1,
      sendTime: "19:30",
      channels: ["myNextDays"],
      active: false,
    },
  },
};

export const Liste: Story = {
  args: { rule: base },
  render: () => (
    <div className="flex w-[34rem] flex-col gap-2">
      <AutomailRuleCard rule={base} />
      <AutomailRuleCard rule={{ ...base, ...CheckoutInfoPausiert.args!.rule }} />
      <AutomailRuleCard
        rule={{ ...base, ...NurBestimmteHaeuserUndKanal.args!.rule }}
      />
    </div>
  ),
};
