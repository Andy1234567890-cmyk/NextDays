import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { ZoomBar } from "@/components/builder/zoom-bar";

/**
 * Untere schwebende Werkzeugleiste des Page-Builders.
 *
 * Zeiger-/Hand-Werkzeug (Pan-Modus), „Auf Frame einpassen" (Zoom-to-fit über
 * alle Device-Frames) und Zoom-Stufen. Im Produkt schwebt sie im Screen-Raum
 * über der unendlichen Canvas; der Zoom reicht von 5 % bis 400 %.
 */
const meta = {
  title: "Page-Builder/Zoom-Leiste",
  component: ZoomBar,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof ZoomBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: { zoom: 1, panMode: false },
};

export const HandWerkzeug: Story = {
  args: { zoom: 0.72, panMode: true },
};

export const Herausgezoomt: Story = {
  args: { zoom: 0.35, panMode: false },
};

export const Interaktiv: Story = {
  args: {},
  render: () => {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState(false);
    return (
      <ZoomBar
        zoom={zoom}
        panMode={pan}
        onPointer={() => setPan(false)}
        onToggleHand={() => setPan((v) => !v)}
        onFit={() => setZoom(0.5)}
        onZoomBy={(f) => setZoom((z) => Math.min(4, Math.max(0.05, z * f)))}
        onZoomTo={setZoom}
      />
    );
  },
};
