import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Standard: Story = {
  render: () => (
    <Card style={{ maxWidth: "24rem" }}>
      <CardHeader>
        <CardTitle>Ferienhaus Skagen</CardTitle>
        <CardDescription>4 Gäste · Direktbuchung · Saison A</CardDescription>
      </CardHeader>
      <CardContent style={{ display: "flex", gap: "0.5rem" }}>
        <Button>Buchen</Button>
        <Button variant="outline">Details</Button>
      </CardContent>
    </Card>
  ),
};
