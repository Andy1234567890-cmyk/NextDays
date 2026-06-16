/**
 * Berechtigungs-Matrix — fachliche PMS-Komponente.
 *
 * Lastenheft-Modul: §4 — Benutzer & Rollen / Berechtigungen.
 *
 * Stellt als Tabelle dar, welche Rolle welche Capability ausführen darf.
 * - Zeilen: Rollen (echte user_role-Enum-Werte): admin | co_admin | owner | staff | cleaner
 * - Spalten: Capabilities (Finanzen sehen, Objekte verwalten, Aufgaben,
 *   Sperrung beantragen, Sperrung freigeben)
 * - Zellen: Checkbox (interaktiv) bzw. Häkchen (Nur-Lese-Ansicht)
 *
 * | Rolle        | Finanzen | Objekte | Aufgaben | Sperrung beantragen | Sperrung freigeben |
 * |--------------|----------|---------|----------|---------------------|--------------------|
 * | Administrator | ✓        | ✓       | ✓        | ✓                   | ✓                  |
 * | Co-Admin      | ✓        | ✓       | ✓        | ✓                   | ✓                  |
 * | Eigentümer    | ✓        | –       | –        | ✓                   | –                  |
 * | Mitarbeiter   | –        | –       | ✓        | ✓                   | –                  |
 * | Reinigung     | –        | –       | ✓        | –                   | –                  |
 *
 * Genutzte Primitive: table + checkbox + role-badge (+ tooltip).
 */
import type { Meta, StoryObj } from "@storybook/react";

import {
  CapabilityMatrix,
  type CapabilityMap,
} from "@/components/pms/capability-matrix";

const meta = {
  title: "PMS-Komponenten/Berechtigungs-Matrix",
  component: CapabilityMatrix,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof CapabilityMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Standard: interaktive Matrix mit fachlicher Voreinstellung. */
export const Standard: Story = {};

/** Nur-Lese-Ansicht: Berechtigungen als Häkchen statt Checkboxen. */
export const NurLesen: Story = {
  args: {
    readOnly: true,
  },
};

// Eigene Berechtigungen: sehr eingeschränktes Reinigungsteam-Profil.
const eingeschraenkt: CapabilityMap = {
  admin: {
    view_finance: true,
    manage_properties: true,
    manage_tasks: true,
    request_block: true,
    approve_block: true,
  },
  co_admin: {
    view_finance: false,
    manage_properties: true,
    manage_tasks: true,
    request_block: true,
    approve_block: false,
  },
  owner: {
    view_finance: true,
    manage_properties: false,
    manage_tasks: false,
    request_block: false,
    approve_block: false,
  },
  staff: {
    view_finance: false,
    manage_properties: false,
    manage_tasks: true,
    request_block: false,
    approve_block: false,
  },
  cleaner: {
    view_finance: false,
    manage_properties: false,
    manage_tasks: false,
    request_block: false,
    approve_block: false,
  },
};

/** Angepasste Berechtigungen: restriktiveres Profil (kontrolliert via value). */
export const AngepassteBerechtigungen: Story = {
  args: {
    value: eingeschraenkt,
  },
};

/** Nur-Lese mit angepassten Berechtigungen. */
export const NurLesenAngepasst: Story = {
  args: {
    readOnly: true,
    value: eingeschraenkt,
  },
};
