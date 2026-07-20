import type { Meta, StoryObj } from "@storybook/react";

import { Col, Txt } from "@/components/mobile/kit";
import { withMobileTheme } from "@/components/mobile/_decorator";

/**
 * Typo-Skala der Mobile-App (`theme/tokens.ts` → `type`).
 *
 * `Txt` wählt über `v` die Variante (display/h1/h2/title/body/sm/xs/eyebrow) und
 * über `soft`/`faint`/`accent` die Tonung. Schriftfamilie ist Schibsted Grotesk
 * (auf dem Gerät als native TTF; in der Web-Vorschau System-Fallback).
 */
const meta = {
  title: "Mobile-App/UI/Typografie",
  tags: ["autodocs"],
  decorators: [withMobileTheme()],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Skala: Story = {
  render: () => (
    <Col gap={10}>
      <Txt v="eyebrow" accent>Eyebrow</Txt>
      <Txt v="display">Display 30</Txt>
      <Txt v="h1">Überschrift H1</Txt>
      <Txt v="h2">Überschrift H2</Txt>
      <Txt v="title">Title 16</Txt>
      <Txt v="body">Body — Fließtext für Beschreibungen und längere Absätze.</Txt>
      <Txt v="sm" soft>Small soft — Sekundärtext</Txt>
      <Txt v="xs" faint>XS faint — Metainfo</Txt>
    </Col>
  ),
};
