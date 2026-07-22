import type { Meta, StoryObj } from "@storybook/react";

import { ChannelBadge } from "@/components/ui/channel-badge";

// Kennzeichnet je Formularfeld, ob es an die Buchungsportale (Booking.com,
// Airbnb & Co.) geht oder nur auf der eigenen myNextDays-Plattform gilt. Der
// Aggregator dahinter (Channex) wird bewusst nie genannt.
const meta = {
  title: "PMS/Channel-Badge",
  component: ChannelBadge,
  tags: ["autodocs"],
  argTypes: {
    channel: { control: "inline-radio", options: ["ota", "local"] },
  },
  args: { channel: "ota" },
} satisfies Meta<typeof ChannelBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Feld geht an die Buchungsportale (für Gäste sichtbar).
export const Portale: Story = {
  args: { channel: "ota" },
};

// Feld gilt nur auf der eigenen Plattform / bei Direktbuchungen.
export const NurMyNextDays: Story = {
  args: { channel: "local" },
};

// Beide nebeneinander — so erscheinen sie an den Formularfeldern.
export const Beide: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <ChannelBadge channel="ota" />
      <ChannelBadge channel="local" />
    </div>
  ),
};

// Eigene Beschriftung (z. B. für andere Sprachen — Label/Hint überschreibbar).
export const EigeneBeschriftung: Story = {
  args: {
    channel: "ota",
    label: "Booking, Airbnb & Co.",
    hint: "Wird an die Buchungsportale übertragen und ist dort für Gäste sichtbar.",
  },
};
