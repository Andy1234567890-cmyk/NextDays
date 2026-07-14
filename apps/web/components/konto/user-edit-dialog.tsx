"use client";

// Nutzer bearbeiten (Konto → Benutzer): Name und Rolle. Die Rolle Admin ist
// nicht vergebbar (entsteht nur bei der Registrierung) — das Backend erzwingt
// das zusätzlich. Kontaktdaten der Agentur (Inhaber) leben unter /konto.
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type TenantUser,
  type UserRole,
  updateManagedUser,
} from "@/lib/account";

const EDITABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "co_admin", label: "Co-Admin" },
  { value: "owner", label: "Eigentümer" },
  { value: "staff", label: "Mitarbeiter" },
  { value: "cleaner", label: "Reinigungspersonal" },
];

export function UserEditDialog({
  user,
  onClose,
}: {
  user: TenantUser;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [role, setRole] = useState<UserRole>(user.role ?? "staff");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const res = await updateManagedUser(user.user_id, {
      full_name: fullName.trim() || undefined,
      role,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Nutzer aktualisiert.");
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
            Name, Rolle und Telefonnummer dieses Nutzers bearbeiten.
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ue-role">Rolle</Label>
            <NativeSelect
              id="ue-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {EDITABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </div>
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
