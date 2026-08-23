"use client";

// Rechte-Auswahl (Allgemein · PM-Module · Posteingang) als Checkbox-Gruppen.
// Eine Quelle für Wizard (Nutzer anlegen) UND Bearbeiten-Dialog — die IDs sind
// exakt die Backend-Permission-IDs (user-wizard-data.ts). `perms` ist der
// aktuelle Auswahl-Zustand, `toggle` schaltet eine einzelne ID um.
//
// `access_pm_features` steht NICHT bei „Allgemein", obwohl das Backend es dort
// führt: es ist der Hauptschalter über den 32 Rechten in „PM-Module" und
// „Posteingang" (siehe pm-dach.ts). Als 16. Zeile unter „Allgemein" war es von
// `hide_prices` nicht zu unterscheiden, und die Rechte, die es beherrscht,
// sahen aktiv aus, während sie serverseitig verworfen wurden.
import { Checkbox } from "@nextdays/ui/checkbox";
import { useTranslations } from "next-intl";

import type { UserRole } from "@/lib/account";
import { PM_DACH, pmDachGilt, pmKinderWirkungslos } from "./pm-dach";
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
  // Kinder des PM-Dachs: gesetzt, aber ohne Wirkung, solange das Dach fehlt.
  // Das Häkchen bleibt sichtbar und gespeichert — nur der Zustand wird
  // benannt, statt es beim Umschalten stillschweigend zu löschen (Wurzel 1).
  wirkungslos = false,
}: {
  title: string;
  items: Permission[];
  perms: Set<string>;
  toggle: (id: string) => void;
  wirkungslos?: boolean;
}) {
  // Bezeichnung und Hinweis kommen aus i18n (permissions.<id>.label/.hint);
  // die ID ist die Backend-Permission und bleibt unübersetzt.
  const tPerm = useTranslations("permissions");
  const t = useTranslations("account.users");
  return (
    <div className="flex flex-col gap-2">
      <h4 className="font-display text-sm font-extrabold">{title}</h4>
      <div className="flex flex-col divide-y divide-border rounded-(--radius) border border-input">
        {items.map((perm) => (
          <label
            key={perm.id}
            className={
              wirkungslos
                ? "flex items-start justify-between gap-3 p-3 opacity-50"
                : "flex cursor-pointer items-start justify-between gap-3 p-3 hover:bg-secondary/40"
            }
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{tPerm(`${perm.id}.label`)}</span>
              <span className="text-xs text-muted-foreground">
                {wirkungslos ? t("pmDachNoetig") : tPerm(`${perm.id}.hint`)}
              </span>
            </span>
            <Checkbox
              className="mt-0.5 shrink-0"
              checked={perms.has(perm.id)}
              disabled={wirkungslos}
              onCheckedChange={() => toggle(perm.id)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// Der Hauptschalter über PM-Modul und Posteingang. Optisch abgesetzt (eigener
// Rahmen, kräftigere Schrift), weil er 32 andere Rechte beherrscht: ein Klick
// hier entscheidet, ob die beiden Gruppen darunter überhaupt etwas tun.
function PmDachSchalter({
  perms,
  toggle,
  gilt,
}: {
  perms: Set<string>;
  toggle: (id: string) => void;
  gilt: boolean;
}) {
  const tPerm = useTranslations("permissions");
  const t = useTranslations("account.users");
  return (
    <label
      className={
        gilt
          ? "flex cursor-pointer items-start justify-between gap-3 rounded-(--radius) border-2 border-input bg-secondary/30 p-3 hover:bg-secondary/50"
          : "flex items-start justify-between gap-3 rounded-(--radius) border-2 border-input bg-secondary/30 p-3 opacity-50"
      }
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-extrabold">{tPerm(`${PM_DACH}.label`)}</span>
        <span className="text-xs text-muted-foreground">
          {gilt ? t("pmDachHinweis") : t("pmDachOhneBelang")}
        </span>
      </span>
      <Checkbox
        className="mt-0.5 shrink-0"
        checked={perms.has(PM_DACH)}
        disabled={!gilt}
        onCheckedChange={() => toggle(PM_DACH)}
      />
    </label>
  );
}

// „Allgemein" ohne das Dach — das steht als eigener Schalter über den beiden
// Gruppen, die es beherrscht.
const ALLGEMEIN = GENERAL_PERMISSIONS.filter((p) => p.id !== PM_DACH);

// Alle drei Rechte-Gruppen am Stück (Wizard-Schritt 3 + Bearbeiten-Dialog).
export function PermissionGroups({
  perms,
  toggle,
  rolle,
}: {
  perms: Set<string>;
  toggle: (id: string) => void;
  // Ohne Rolle greift der fail-closed-Zweig (Dach gilt) — dieselbe Regel wie
  // serverseitig in `pm_umbrella_applies`.
  rolle?: UserRole | string | null;
}) {
  const t = useTranslations("account");
  // Zwei getrennte Fragen: gilt das Dach für diese Rolle überhaupt (dann ist
  // der Schalter bedienbar), und sind die Kinder gerade wirkungslos (Dach gilt
  // UND Häkchen fehlt).
  const dachGilt = pmDachGilt(rolle);
  const kinderTot = pmKinderWirkungslos(rolle, perms);
  return (
    <>
      <PermissionGroup
        title={t("users.generalPermissions")}
        items={ALLGEMEIN}
        perms={perms}
        toggle={toggle}
      />
      <div className="flex flex-col gap-3">
        <PmDachSchalter perms={perms} toggle={toggle} gilt={dachGilt} />
        <PermissionGroup
          title={t("userDetail.pmPermissions")}
          items={PM_PERMISSIONS}
          perms={perms}
          toggle={toggle}
          wirkungslos={kinderTot}
        />
        <PermissionGroup
          title={t("userDetail.inboxPermissions")}
          items={INBOX_PERMISSIONS}
          perms={perms}
          toggle={toggle}
          wirkungslos={kinderTot}
        />
      </div>
    </>
  );
}
