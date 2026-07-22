import type { Meta, StoryObj } from "@storybook/react";

import { NativeSelect } from "@/components/ui/native-select";

const meta = {
  title: "UI-Bausteine/NativeSelect",
  component: NativeSelect,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Natives Select im Input-Stil mit einheitlich positioniertem Chevron " +
          "(appearance-none + Iconify ph:caret-down). Verhindert die uneinheitlichen, " +
          "browserabhängigen Pfeile roher <select>. Für lange Listen (Länder, " +
          "Kanäle) praktischer als das Radix-Select.",
      },
    },
  },
} satisfies Meta<typeof NativeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Anker: Story = {
  render: () => (
    <NativeSelect className="w-64" defaultValue="arrival">
      <option value="arrival">Anreise</option>
      <option value="departure">Abreise</option>
      <option value="booking">Buchung</option>
    </NativeSelect>
  ),
};

export const Fehlerzustand: Story = {
  render: () => (
    <NativeSelect className="w-64" error>
      <option value="">Bitte wählen …</option>
      <option value="new">Neu</option>
    </NativeSelect>
  ),
};

export const Deaktiviert: Story = {
  render: () => (
    <NativeSelect className="w-64" disabled defaultValue="new">
      <option value="new">Neu</option>
    </NativeSelect>
  ),
};
