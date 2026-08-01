"use client";

// Rechte-Auswahl (Allgemein · PM-Module · Posteingang) als Checkbox-Gruppen.
// Eine Quelle für Wizard (Nutzer anlegen) UND Bearbeiten-Dialog — die IDs sind
// exakt die Backend-Permission-IDs (user-wizard-data.ts). `perms` ist der
// aktuelle Auswahl-Zustand, `toggle` schaltet eine einzelne ID um.
import { Checkbox } from "@nextdays/ui/checkbox";
import { useTranslations } from "next-intl";

import {
  GENERAL_PERMISSIONS,
  INBOX_PERMISSIONS,
  PM_PERMISSIONS,
  type Permission,
} from "./user-wizard-data";

export function PermissionGroup({
  title,
  items,
  perms,
  toggle,
}: {
  title: string;
  items: Permission[];
  perms: Set<string>;
  toggle: (id: string) => void;
}) {
  // Bezeichnung und Hinweis kommen aus i18n (permissions.<id>.label/.hint);
  // die ID ist die Backend-Permission und bleibt unübersetzt.
  const tPerm = useTranslations("permissions");
  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-display text-sm font-extrabold">{title}</h4>
      <div className="flex flex-col divide-y divide-border rounded-(--radius) border border-input">
        {items.map((perm) => (
          <label
            key={perm.id}
            className="flex cursor-pointer items-start justify-between gap-3 p-3 hover:bg-secondary/40"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{tPerm(`${perm.id}.label`)}</span>
              <span className="text-xs text-muted-foreground">{tPerm(`${perm.id}.hint`)}</span>
            </span>
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={perms.has(perm.id)}
              onCheckedChange={() => toggle(perm.id)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// Alle drei Rechte-Gruppen am Stück (Wizard-Schritt 3 + Bearbeiten-Dialog).
export function PermissionGroups({
  perms,
  toggle,
}: {
  perms: Set<string>;
  toggle: (id: string) => void;
}) {
  const t = useTranslations("account");
  return (
    <>
      <PermissionGroup
        title={t("users.generalPermissions")}
        items={GENERAL_PERMISSIONS}
        perms={perms}
        toggle={toggle}
      />
      <PermissionGroup
        title="PM-Module-Berechtigungen"
        items={PM_PERMISSIONS}
        perms={perms}
        toggle={toggle}
      />
      <PermissionGroup
        title="Posteingang"
        items={INBOX_PERMISSIONS}
        perms={perms}
        toggle={toggle}
      />
    </>
  );
}
