import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";

import { Badge, Chip, Row, Txt } from "@/components/mobile/kit";
import { withMobileTheme } from "@/components/mobile/_decorator";

/**
 * Chips & Badges der Mobile-App.
 *
 * `Chip` in vier Varianten (Standard/on/accent/ghost), optional mit Icon.
 * `Badge` ist der kleine Zähler (z. B. auf Icon-Buttons). Alles theme-getönt.
 */
const meta = {
  title: "Mobile-App/UI/Chips & Badges",
  tags: ["autodocs"],
  decorators: [withMobileTheme()],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Chips: Story = {
  render: () => (
    <Row gap={8} style={{ flexWrap: "wrap" }}>
      <Chip icon="wifi">WLAN</Chip>
      <Chip variant="on">Ausgewählt</Chip>
      <Chip variant="accent" icon="star">Top</Chip>
      <Chip variant="ghost" icon="pin">Karte</Chip>
    </Row>
  ),
};

export const Badges: Story = {
  render: () => (
    <Row gap={16}>
      <View>
        <Txt v="sm" soft>Posteingang</Txt>
        <Badge>5</Badge>
      </View>
      <Badge>12</Badge>
      <Badge>99</Badge>
    </Row>
  ),
};
