import type { Meta, StoryObj } from "@storybook/react";

import { RoleBadge, type UserRole } from "@/components/pms/role-badge";

/**
 * Rollen-Badge — fachliche PMS-Komponente.
 *
 * Lastenheft-Modul: §4 (Benutzer & Rollen).
 * Zugehörige Tabelle: `users` (Spalte `role`, Enum `user_role`).
 *
 * Stellt die Benutzerrolle mit semantischer Farbe, Iconify-Icon (ph:*) und
 * deutschem Label dar. Verwendet ausschließlich die echten Enum-Werte:
 * `admin | co_admin | owner | staff | cleaner`.
 */
const meta = {
  title: "PMS-Komponenten/Rollen-Badge",
  component: RoleBadge,
  tags: ["autodocs"],
  argTypes: {
    role: {
      control: "select",
      options: ["admin", "co_admin", "owner", "staff", "cleaner"] satisfies UserRole[],
      description: "Benutzerrolle (Enum user_role)",
    },
    hideIcon: {
      control: "boolean",
      description: "Icon ausblenden (z.B. in engen Tabellen)",
    },
  },
  args: { role: "admin", hideIcon: false },
} satisfies Meta<typeof RoleBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Standard: Administrator-Rolle. */
export const Standard: Story = {};

/** Administrator — volle Verwaltungsrechte. */
export const Administrator: Story = { args: { role: "admin" } };

/** Co-Admin — eingeschränkte Verwaltungsrechte. */
export const CoAdmin: Story = { args: { role: "co_admin" } };

/** Eigentümer — sieht eigene Objekte und Netto-Beträge. */
export const Eigentuemer: Story = { args: { role: "owner" } };

/** Mitarbeiter — keine Finanzen, keine Gästenamen. */
export const Mitarbeiter: Story = { args: { role: "staff" } };

/** Reinigung — operative Reinigungsaufgaben. */
export const Reinigung: Story = { args: { role: "cleaner" } };

/** Ohne Icon — kompakte Darstellung. */
export const OhneIcon: Story = { args: { role: "owner", hideIcon: true } };

/** Alle Rollen im Überblick. */
export const AlleRollen: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(["admin", "co_admin", "owner", "staff", "cleaner"] satisfies UserRole[]).map(
        (role) => (
          <RoleBadge key={role} role={role} />
        ),
      )}
    </div>
  ),
};
