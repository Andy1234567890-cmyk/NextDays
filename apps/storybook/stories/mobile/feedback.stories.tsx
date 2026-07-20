import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { View } from "react-native";

import { Col, Progress, Row, Segmented, Spinner, Toggle, Txt } from "@/components/mobile/kit";
import { withMobileTheme } from "@/components/mobile/_decorator";

/**
 * Interaktions-/Status-Bausteine: `Toggle` (Schalter), `Progress` (Balken),
 * `Segmented` (Tab-Umschalter), `Spinner` (Ladeanzeige).
 */
const meta = {
  title: "Mobile-App/UI/Feedback & Steuerung",
  tags: ["autodocs"],
  decorators: [withMobileTheme()],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Toggles: Story = {
  render: () => (
    <Row gap={24}>
      <Col gap={6}><Txt v="sm" soft>An</Txt><Toggle on /></Col>
      <Col gap={6}><Txt v="sm" soft>Aus</Txt><Toggle /></Col>
    </Row>
  ),
};

export const Fortschritt: Story = {
  render: () => (
    <Col gap={12}>
      <View><Txt v="sm" soft>30 %</Txt><Progress pct={30} /></View>
      <View><Txt v="sm" soft>70 %</Txt><Progress pct={70} /></View>
      <View><Txt v="sm" soft>100 %</Txt><Progress pct={100} /></View>
    </Col>
  ),
};

export const SegmentedControl: Story = {
  render: function Render() {
    const [i, setI] = useState(0);
    return <Segmented options={["Alle", "Offen", "Erledigt"]} value={i} onChange={setI} />;
  },
};

export const Laden: Story = {
  render: () => <Spinner />,
};
