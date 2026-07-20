import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";

import { Btn, IconBtn, Row } from "@/components/mobile/kit";
import { withMobileTheme } from "@/components/mobile/_decorator";

/**
 * Buttons der Mobile-App (`components/ui/kit.tsx`, react-native-web-Vorschau).
 *
 * `Btn` in vier Varianten (primary/dark/ghost/outline), optional mit Icon links/
 * rechts und `block` (volle Breite). `IconBtn` ist der runde Icon-Button mit
 * optionalem Badge. Farben/Radien kommen aus den Theme-Tokens.
 */
const meta = {
  title: "Mobile-App/UI/Buttons",
  tags: ["autodocs"],
  decorators: [withMobileTheme()],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Varianten: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <Btn variant="primary" icon="check">Bestätigen</Btn>
      <Btn variant="dark" icon="key">Einloggen</Btn>
      <Btn variant="ghost">Abbrechen</Btn>
      <Btn variant="outline" iconR="fwd">Weiter</Btn>
    </View>
  ),
};

export const IconButtons: Story = {
  render: () => (
    <Row gap={12}>
      <IconBtn icon="heart" />
      <IconBtn icon="share" />
      <IconBtn icon="bell" badge={3} />
      <IconBtn icon="cog" flat />
    </Row>
  ),
};
