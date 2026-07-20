import type { Meta, StoryObj } from "@storybook/react";

import { Card, Col, Divider, Flat, Row, Txt } from "@/components/mobile/kit";
import { withMobileTheme } from "@/components/mobile/_decorator";

/**
 * Flächen der Mobile-App: `Card` (Schatten), `Flat` (Rahmen statt Schatten),
 * `Divider` (1px-Trennlinie). Grundbausteine der Screen-Layouts.
 */
const meta = {
  title: "Mobile-App/UI/Flächen",
  tags: ["autodocs"],
  decorators: [withMobileTheme()],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Karten: Story = {
  render: () => (
    <Col gap={14}>
      <Card style={{ padding: 16 }}>
        <Txt v="title">Card (Schatten)</Txt>
        <Txt v="sm" soft>Erhöhte Fläche für Inhaltsblöcke.</Txt>
      </Card>
      <Flat style={{ padding: 16 }}>
        <Txt v="title">Flat (Rahmen)</Txt>
        <Txt v="sm" soft>Flache Fläche mit 1px-Linie.</Txt>
      </Flat>
    </Col>
  ),
};

export const MitDivider: Story = {
  render: () => (
    <Card style={{ padding: 16 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="sm">Zwischensumme</Txt>
        <Txt v="sm">240,00</Txt>
      </Row>
      <Divider style={{ marginVertical: 12 }} />
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="title">Gesamt</Txt>
        <Txt v="title">240,00</Txt>
      </Row>
    </Card>
  ),
};
