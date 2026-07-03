import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";

const meta: Meta<typeof Button> = {
  title: "UI-Bausteine/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "accent", "outline", "ghost", "destructive"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: "Buchung anlegen" } };
export const Accent: Story = {
  args: { variant: "accent", children: "Direktbuchung" },
};
export const Outline: Story = {
  args: { variant: "outline", children: "Abbrechen" },
};
export const Destructive: Story = {
  args: { variant: "destructive", children: "Stornieren" },
};

export const AlleVarianten: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      <Button>Default</Button>
      <Button variant="accent">Accent</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};
