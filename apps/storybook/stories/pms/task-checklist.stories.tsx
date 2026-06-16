import type { Meta, StoryObj } from "@storybook/react";

import { TaskChecklist } from "@/components/pms/task-checklist";

/**
 * Aufgaben-Checkliste — Lastenheft-Modul §2.5 (Aufgaben & Reinigung).
 *
 * Zugehörige Tabellen: `task` (Kopf mit Titel, Fälligkeit, task_status)
 * und `checklist_item` (Positionen mit Raum-Label, Erledigt-Status, Foto-Nachweis).
 *
 * Zeigt den Task-Kopf mit task_status-Badge, eine Liste der checklist_items
 * (Checkbox + Raum-Label) sowie je Position einen Foto-Nachweis-Platzhalter (Iconify camera).
 *
 * task_status-Enum: open | in_progress | done | cancelled.
 */
const meta = {
  title: "PMS-Komponenten/Aufgaben-Checkliste",
  component: TaskChecklist,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof TaskChecklist>;

export default meta;
type Story = StoryObj<typeof meta>;

// Beispiel: Endreinigung mit 4 Räumen.
const endreinigungRaeume = [
  { id: "wohnzimmer", room: "Wohnzimmer", done: false },
  { id: "kueche", room: "Küche", done: false },
  { id: "bad", room: "Badezimmer", done: false },
  { id: "schlafzimmer", room: "Schlafzimmer", done: false },
];

/** Standard: Endreinigung mit 4 Räumen, Status offen. */
export const Standard: Story = {
  args: {
    title: "Endreinigung",
    dueLabel: "16.06.2026, 11:00 Uhr",
    status: "open",
    items: endreinigungRaeume,
  },
};

/** In Arbeit: zwei Räume erledigt, einer mit Foto-Nachweis. */
export const InArbeit: Story = {
  args: {
    title: "Endreinigung",
    dueLabel: "16.06.2026, 11:00 Uhr",
    status: "in_progress",
    items: [
      { id: "wohnzimmer", room: "Wohnzimmer", done: true, hasPhoto: true },
      { id: "kueche", room: "Küche", done: true },
      { id: "bad", room: "Badezimmer", done: false },
      { id: "schlafzimmer", room: "Schlafzimmer", done: false },
    ],
  },
};

/** Erledigt: alle Räume abgehakt und mit Foto-Nachweis dokumentiert. */
export const Erledigt: Story = {
  args: {
    title: "Endreinigung",
    dueLabel: "15.06.2026, 11:00 Uhr",
    status: "done",
    items: endreinigungRaeume.map((r) => ({ ...r, done: true, hasPhoto: true })),
  },
};

/** Storniert: Aufgabe wurde abgesagt, Positionen unbearbeitet. */
export const Storniert: Story = {
  args: {
    title: "Endreinigung",
    dueLabel: "17.06.2026, 11:00 Uhr",
    status: "cancelled",
    items: endreinigungRaeume,
  },
};

/** Größere Aufgabe: Zwischenreinigung mit sechs Räumen. */
export const VieleRaeume: Story = {
  args: {
    title: "Zwischenreinigung",
    dueLabel: "16.06.2026, 14:30 Uhr",
    status: "in_progress",
    items: [
      { id: "flur", room: "Flur", done: true, hasPhoto: true },
      { id: "wohnzimmer", room: "Wohnzimmer", done: true },
      { id: "kueche", room: "Küche", done: false },
      { id: "bad-og", room: "Badezimmer (OG)", done: false },
      { id: "bad-eg", room: "Badezimmer (EG)", done: false },
      { id: "terrasse", room: "Terrasse", done: false },
    ],
  },
};
