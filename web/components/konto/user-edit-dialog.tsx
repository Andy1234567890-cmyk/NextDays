"use client";

// Nutzer bearbeiten (Konto → Benutzer): Name, Rolle und feingranulare Rechte.
// Die Rolle Admin ist nicht vergebbar (entsteht nur bei der Registrierung) — das
// Backend erzwingt das zusätzlich. Kontaktdaten der Agentur (Inhaber) leben
// unter /konto. Ein Rollenwechsel schlägt die Default-Rechte der neuen Rolle vor,
// überschreibt die Auswahl aber nicht hart — der Admin kann sie frei anpassen.
// Das Backend klemmt jede Rechtevergabe auf die eigenen Rechte des Bearbeitenden.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  type TenantUser,
  type UserRole,
  updateManagedUser,
} from "@/lib/account";

import { PermissionGroups } from "./permission-groups";
import { ROLE_DEFAULT_PERMISSIONS } from "./user-wizard-data";

// Rollen, die ein Admin vergeben darf. Das Label kommt aus i18n
// (account.roles.*); der Wert ist die DB-Rolle und bleibt unübersetzt.
const EDITABLE_ROLES: UserRole[] = ["co_admin", "owner", "staff", "cleaner"];

export function UserEditDialog({
  user,
  onClose,
}: {
  user: TenantUser;
  onClose: () => void;
}) {
  const t = useTranslations("account");
  const isAdmin = user.role === "admin";
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [role, setRole] = useState<UserRole>(user.role ?? "staff");
  // Rechte-Zustand initial aus den effektiven Rechten des Nutzers.
  const [perms, setPerms] = useState<Set<string>>(
    () => new Set(user.permissions),
  );
  const [busy, setBusy] = useState(false);

  function togglePerm(id: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Rollenwechsel: die Default-Rechte der neuen Rolle vorschlagen (überschreibbar).
  function handleRoleChange(next: UserRole) {
    setRole(next);
    setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[next] ?? []));
  }

  async function handleSave() {
    setBusy(true);
    const res = await updateManagedUser(user.user_id, {
      full_name: fullName.trim() || undefined,
      role,
      // Admin behält immer alle Rechte (Backend erzwingt das) → nicht senden.
      permissions: isAdmin ? undefined : [...perms],
    });
    setBusy(false);
    if (res.ok) {
      toast.success(t("users.updated"));
      onClose();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-xl font-extrabold">
            Nutzer bearbeiten
          </SheetTitle>
          <SheetDescription className="sr-only">
            Name, Rolle und Berechtigungen dieses Nutzers bearbeiten.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ue-name">Name</Label>
            <Input
              id="ue-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ue-email">E-Mail</Label>
            <Input id="ue-email" value={user.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              Die E-Mail ist das Login und kann hier nicht geändert werden.
            </p>
          </div>

          {isAdmin ? (
            <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              Der Kontoinhaber (Admin) hat vollen Zugriff. Rolle und Rechte
              lassen sich hier nicht ändern.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ue-role">Rolle</Label>
                <NativeSelect
                  id="ue-role"
                  value={role}
                  onChange={(e) =>
                    handleRoleChange(e.target.value as UserRole)
                  }
                >
                  {EDITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r === "owner" ? t("roles.ownerShort") : t(`roles.${r}`)}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  {t("users.roleChangeHint")}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Label>Berechtigungen</Label>
                <PermissionGroups perms={perms} toggle={togglePerm} />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t p-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
