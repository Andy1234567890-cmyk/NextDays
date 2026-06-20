"use client";

// Nutzerliste im Konto → Benutzer: zeigt alle Tenant-Mitglieder (Avatar,
// Name, E-Mail, Rolle). Der Account-Inhaber steht zuerst (Backend-Sortierung).
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TenantUser, UserRole } from "@/lib/account";

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
  return (
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
          {user.role && (
            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
