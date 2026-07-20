import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";

import { Icon, NIC } from "@/components/mobile/Icon";
import { Col, Txt } from "@/components/mobile/kit";
import { withMobileTheme } from "@/components/mobile/_decorator";

/**
 * Icon-Set der Mobile-App (`components/ui/Icon.tsx`).
 *
 * Jedes Icon ist ein SVG-Pfad-String (24×24, Stroke, via react-native-svg
 * gerendert). `n` wählt den Namen, `s` die Größe, `sw` die Strichstärke, `c`
 * die Farbe. Unten die komplette Galerie aller definierten Namen.
 */
const meta = {
  title: "Mobile-App/UI/Icons",
  component: Icon,
  tags: ["autodocs"],
  decorators: [withMobileTheme()],
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Einzeln: Story = {
  args: { n: "heart", s: 32, sw: 1.8, c: "#C42B3A" },
};

export const Galerie: Story = {
  args: { n: "dot" }, // von component:Icon erzwungen; die Galerie rendert eigenständig
  render: () => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, maxWidth: 360 }}>
      {Object.keys(NIC).map((name) => (
        <Col key={name} gap={4} style={{ alignItems: "center", width: 56 }}>
          <Icon n={name} s={24} />
          <Txt v="xs" soft numberOfLines={1}>{name}</Txt>
        </Col>
      ))}
    </View>
  ),
};
