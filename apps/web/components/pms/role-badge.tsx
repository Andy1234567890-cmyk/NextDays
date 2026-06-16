// Rollen-Badge (fachliche PMS-Komponente, Lastenheft §4 — Benutzer & Rollen).
// Zeigt eine Benutzerrolle mit semantischer Farbe, Iconify-Icon (ph:*) und deutschem Label.
// Icons via Iconify — niemals lucide-react. Nur semantische Token-Klassen, keine Hex-Werte.
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Echte Enum-Werte aus supabase/migrations (BUILD_REFERENCE):
// user_role: admin | co_admin | owner | staff | cleaner
export type UserRole = "admin" | "co_admin" | "owner" | "staff" | "cleaner";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// Konfiguration pro Rolle: deutsches Label, Iconify-Icon (ph:*) und Token-Variante.
const roleConfig: Record<
  UserRole,
  { label: string; icon: string; variant: BadgeVariant }
> = {
  admin: { label: "Administrator", icon: "ph:shield-star", variant: "default" },
  co_admin: { label: "Co-Admin", icon: "ph:shield-check", variant: "secondary" },
  owner: { label: "Eigentümer", icon: "ph:house-line", variant: "success" },
  staff: { label: "Mitarbeiter", icon: "ph:user", variant: "outline" },
  cleaner: { label: "Reinigung", icon: "ph:broom", variant: "warning" },
};

type RoleBadgeProps = Omit<ComponentProps<typeof Badge>, "variant" | "children"> & {
  role: UserRole;
  // Icon optional ausblenden (z.B. in sehr engen Tabellen).
  hideIcon?: boolean;
};

export function RoleBadge({ role, hideIcon = false, className, ...props }: RoleBadgeProps) {
  const { label, icon, variant } = roleConfig[role];
  return (
    <Badge variant={variant} className={cn(className)} {...props}>
      {!hideIcon && <Icon icon={icon} aria-hidden className="size-3.5" />}
      {label}
    </Badge>
  );
}

export { roleConfig };
