import type { Meta, StoryObj } from "@storybook/react";

import { Logo } from "@/components/plattform/logo";

/**
 * Plattform-Logo (myNextDays-Wortmarke).
 *
 * Rendert die transparente Original-PNG und croppt die sichtbare BBox, damit die
 * Wortmarke nicht winzig wirkt. `heightRem` steuert die Höhe (Breite folgt dem
 * festen Seitenverhältnis).
 */
const meta = {
  title: "Plattform/Logo",
  component: Logo,
  tags: ["autodocs"],
  argTypes: {
    heightRem: { control: { type: "range", min: 1, max: 6, step: 0.25 } },
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = { args: { heightRem: 2.25 } };
export const Gross: Story = { args: { heightRem: 4 } };
