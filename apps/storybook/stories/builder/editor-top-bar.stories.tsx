import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  type Device,
  EditorTopBar,
} from "@/components/builder/editor-top-bar";

/**
 * Obere Toolbar des Page-Builders (Framer-Stil).
 *
 * Links Zurück + Canvas-Chip + Werkzeuge: „+" wechselt die Sidebar in den
 * Insert-Modus, das Auswahl-Werkzeug öffnet das Einfügen-Menü
 * (Frame/Stack/Grid/…). Mittig Seitentitel mit Slug und Status
 * (Entwurf/veröffentlicht), rechts der Device-Umschalter (Desktop 1200 ·
 * Tablet 810 · Phone 390) und „Veröffentlichen".
 */
const meta = {
  title: "Page-Builder/Editor-Toolbar",
  component: EditorTopBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EditorTopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Startseite: Story = {
  args: {
    title: "Home",
    slug: "",
    published: true,
    device: "desktop",
    onSave: () => console.log("Veröffentlichen"),
    onPickInsert: (label: string) => console.log("Einfügen:", label),
  },
};

export const Entwurf: Story = {
  args: {
    title: "Über uns",
    slug: "ueber-uns",
    published: false,
    device: "tablet",
  },
};

export const InsertModusAktiv: Story = {
  args: {
    title: "Ferienhäuser",
    slug: "haeuser",
    published: true,
    insertOpen: true,
    device: "desktop",
  },
};

export const SpeichernLaeuft: Story = {
  args: {
    title: "Home",
    slug: "",
    published: true,
    saving: true,
    device: "desktop",
  },
};

export const Interaktiv: Story = {
  args: { title: "Home" },
  render: () => {
    const [device, setDevice] = useState<Device>("desktop");
    const [insertOpen, setInsertOpen] = useState(false);
    return (
      <EditorTopBar
        title="Home"
        slug=""
        published
        device={device}
        insertOpen={insertOpen}
        onPickDevice={setDevice}
        onToggleInsert={() => setInsertOpen((v) => !v)}
        onPickInsert={(label) => console.log("Einfügen:", label)}
        onSave={() => console.log("Veröffentlichen")}
      />
    );
  },
};
