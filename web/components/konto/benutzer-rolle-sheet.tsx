"use client";

// Konto → Benutzer → Detailseite: „Rolle und Berechtigungen" bearbeiten.
//
// Die Rolle Admin ist nicht vergebbar (sie entsteht nur bei der Registrierung),
// und der Kontoinhaber ist nicht umstufbar — das Backend erzwingt beides
// zusätzlich. Ein Rollenwechsel SCHLÄGT die Default-Rechte der neuen Rolle VOR
// und überschreibt die Auswahl nicht hart: der Betreiber soll danach noch
// einzeln anpassen können. Jede Rechtevergabe klemmt der Server auf die eigenen
// Rechte des Bearbeitenden (keine Privilege-Escalation).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
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

// Rollen, die vergeben werden dürfen. Admin fehlt bewusst.
const VERGEBBARE_ROLLEN: UserRole[] = ["co_admin", "shift_lead", "owner", "staff", "cleaner"];

export function BenutzerRolleSheet({
  user,
  onClose,
}: {
  user: TenantUser;
  onClose: () => void;
}) {
  const t = useTranslations("account");
  const istAdmin = user.role === "admin";
  const [rolle, setRolle] = useState<UserRole>(user.role ?? "staff");
  // GESPEICHERTE Rechte, nicht die wirksamen: dieser Dialog schreibt seinen
  // Zustand beim Speichern zurück. Mit `user.permissions` (durchs PM-Dach
  // gefiltert) war die Anzeige die Schreibquelle — jedes Speichern löschte,
  // was das Dach nur ausgeblendet hatte. Live verlor ein Eigentümer so 4 seiner
  // 6 Rechte pro Vorgang, ohne dass jemand ein Häkchen anfasste.
  //
  // Rückfall auf `permissions`, falls der Server das Feld nicht liefert
  // (ältere Fassung) — dann verhält es sich wie bisher, statt die Rechte auf
  // eine leere Menge zu setzen.
  const [rechte, setRechte] = useState<Set<string>>(
    () => new Set(user.stored_permissions ?? user.permissions),
  );
  const [busy, setBusy] = useState(false);

  function umschalten(id: string) {
    setRechte((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function rolleWechseln(next: UserRole) {
    setRolle(next);
    setRechte(new Set(ROLE_DEFAULT_PERMISSIONS[next] ?? []));
  }

  async function speichern() {
    setBusy(true);
    const res = await updateManagedUser(user.user_id, {
      role: rolle,
      // Admin behält immer alle Rechte (Backend erzwingt das) → nicht senden.
      permissions: istAdmin ? undefined : [...rechte],
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
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {t("userDetail.editRole")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("userDetail.editRole")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {istAdmin ? (
            <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              {t("userDetail.adminLocked")}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="br-role">
                  {t("userWizard.role")}
                  <span className="text-destructive"> *</span>
                </Label>
                <NativeSelect
                  id="br-role"
                  value={rolle}
                  onChange={(e) => rolleWechseln(e.target.value as UserRole)}
                >
                  {VERGEBBARE_ROLLEN.map((r) => (
                    <option key={r} value={r}>
                      {r === "owner" ? t("roles.ownerShort") : t(`roles.${r}`)}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  {t("users.roleChangeHint")}
                </p>
              </div>

              <PermissionGroups perms={rechte} toggle={umschalten} rolle={rolle} />
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t p-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("userWizard.cancel")}
          </Button>
          <Button onClick={speichern} disabled={busy || istAdmin}>
            {busy ? t("userDetail.saving") : t("userDetail.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
