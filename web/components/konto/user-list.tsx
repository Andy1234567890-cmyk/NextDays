"use client";

// Nutzerliste im Konto → Benutzer: zeigt alle Tenant-Mitglieder (Avatar,
// Name, E-Mail, Rolle). Der Account-Inhaber steht zuerst (Backend-Sortierung).
// Bei Eigentümern (Rolle 'owner') „Objekte zuordnen" (§4.2), bei Mitarbeitern
// (staff/cleaner) „Objekte freigeben" (§4.3). „…"-Menü: Bearbeiten/Löschen
// (der Kontoinhaber/Admin ist geschützt — Backend erzwingt das ebenfalls).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@nextdays/ui/avatar";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { type TenantUser, type UserRole, deleteManagedUser } from "@/lib/account";

import { OwnerPropertiesDialog } from "./owner-properties-dialog";
import { StaffPropertiesDialog } from "./staff-properties-dialog";
import { UserEditDialog } from "./user-edit-dialog";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  owner: "Eigentümer",
  co_admin: "Co-Admin",
  staff: "Mitarbeiter",
  cleaner: "Reinigungspersonal",
};

function initials(user: TenantUser): string {
  const source = user.full_name?.trim() || user.email || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserList({ users }: { users: TenantUser[] }) {
  const t = useTranslations("account");
  // Welcher Eigentümer gerade die Objekt-Zuordnung offen hat (null = keiner).
  const [assigning, setAssigning] = useState<TenantUser | null>(null);
  // Welcher Mitarbeiter gerade die Objekt-Freigabe offen hat (null = keiner).
  const [releasing, setReleasing] = useState<TenantUser | null>(null);
  // Welcher Nutzer gerade bearbeitet wird (null = keiner).
  const [editing, setEditing] = useState<TenantUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(user: TenantUser) {
    const label = user.full_name || user.email || "diesen Nutzer";
    // Löschen ist endgültig (Login + Zuordnungen) → bewusst bestätigen lassen.
    if (!window.confirm(`${label} wirklich löschen? Das Login wird entfernt.`)) {
      return;
    }
    setDeletingId(user.user_id);
    const res = await deleteManagedUser(user.user_id);
    setDeletingId(null);
    if (res.ok) toast.success(t("users.deleted"));
    else toast.error(res.error);
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
        {users.map((user) => (
          <li
            key={user.user_id}
            className="flex items-center gap-3 p-3"
          >
            <Avatar>
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
              <AvatarFallback>{initials(user)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {user.full_name || user.email || "Unbenannt"}
              </span>
              {user.email && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </div>
            {user.role === "owner" && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setAssigning(user)}
              >
                <Icon icon="ph:house-line" className="size-4" />
                Objekte zuordnen
              </Button>
            )}
            {(user.role === "staff" || user.role === "cleaner") && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => setReleasing(user)}
              >
                <Icon icon="ph:house-line" className="size-4" />
                Objekte freigeben
              </Button>
            )}
            {user.role && (
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {ROLE_LABELS[user.role]}
              </span>
            )}
            {/* Der Kontoinhaber (Admin) ist nicht bearbeit-/löschbar. */}
            {user.role !== "admin" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Aktionen"
                    disabled={deletingId === user.user_id}
                  >
                    <Icon
                      icon={
                        deletingId === user.user_id
                          ? "ph:spinner"
                          : "ph:dots-three-vertical"
                      }
                      className={
                        "size-4 " +
                        (deletingId === user.user_id ? "animate-spin" : "")
                      }
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(user)}>
                    <Icon icon="ph:pencil-simple" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void handleDelete(user)}
                  >
                    <Icon icon="ph:trash" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <UserEditDialog user={editing} onClose={() => setEditing(null)} />
      )}

      {assigning && (
        <OwnerPropertiesDialog
          userId={assigning.user_id}
          userName={assigning.full_name || assigning.email || "Eigentümer"}
          onClose={() => setAssigning(null)}
        />
      )}

      {releasing && (
        <StaffPropertiesDialog
          userId={releasing.user_id}
          userName={releasing.full_name || releasing.email || "Mitarbeiter"}
          onClose={() => setReleasing(null)}
        />
      )}
    </>
  );
}
