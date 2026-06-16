// Berechtigungs-Matrix (fachliche PMS-Komponente, Lastenheft §4 — Benutzer & Rollen).
// Zeigt je Rolle (Zeile) an, welche Capabilities (Spalten) erlaubt sind — als Häkchen/Checkbox.
// Nutzt table + checkbox + role-badge. Icons via Iconify (ph:*) — niemals lucide-react.
// Nur semantische Token-Klassen, keine Hex-Werte.
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RoleBadge, type UserRole } from "@/components/pms/role-badge";
import { cn } from "@/lib/utils";

// Echte Enum-Werte aus supabase/migrations (BUILD_REFERENCE):
// user_role: admin | co_admin | owner | staff | cleaner
const ROLES: UserRole[] = ["admin", "co_admin", "owner", "staff", "cleaner"];

// Schlüssel der dargestellten Capabilities (fachliche Berechtigungen aus Lastenheft §4).
export type CapabilityKey =
  | "view_finance"
  | "manage_properties"
  | "manage_tasks"
  | "request_block"
  | "approve_block";

// Konfiguration je Capability: deutsches Label, Iconify-Icon (ph:*) und kurze Beschreibung.
type CapabilityConfig = {
  key: CapabilityKey;
  label: string;
  icon: string;
  description: string;
};

const CAPABILITIES: CapabilityConfig[] = [
  {
    key: "view_finance",
    label: "Finanzen sehen",
    icon: "ph:currency-eur",
    description:
      "Umsätze, Zahlungen und Provisionen einsehen. Mitarbeiter sehen keine Finanzen.",
  },
  {
    key: "manage_properties",
    label: "Objekte verwalten",
    icon: "ph:house-line",
    description: "Ferienobjekte anlegen, bearbeiten und Status setzen.",
  },
  {
    key: "manage_tasks",
    label: "Aufgaben",
    icon: "ph:check-square",
    description: "Aufgaben erstellen, zuweisen und abschließen.",
  },
  {
    key: "request_block",
    label: "Sperrung beantragen",
    icon: "ph:lock-key",
    description: "Sperrung eines Zeitraums beantragen (Status: pending).",
  },
  {
    key: "approve_block",
    label: "Sperrung freigeben",
    icon: "ph:seal-check",
    description:
      "Beantragte Sperrung freigeben oder ablehnen (approved/rejected).",
  },
];

// Berechtigungsmatrix: pro Rolle erlaubte Capabilities (Lastenheft §4).
export type CapabilityMap = Record<UserRole, Record<CapabilityKey, boolean>>;

// Standard-Berechtigungen (fachliche Voreinstellung).
const DEFAULT_CAPABILITIES: CapabilityMap = {
  admin: {
    view_finance: true,
    manage_properties: true,
    manage_tasks: true,
    request_block: true,
    approve_block: true,
  },
  co_admin: {
    view_finance: true,
    manage_properties: true,
    manage_tasks: true,
    request_block: true,
    approve_block: true,
  },
  owner: {
    view_finance: true,
    manage_properties: false,
    manage_tasks: false,
    request_block: true,
    approve_block: false,
  },
  staff: {
    view_finance: false,
    manage_properties: false,
    manage_tasks: true,
    request_block: true,
    approve_block: false,
  },
  cleaner: {
    view_finance: false,
    manage_properties: false,
    manage_tasks: true,
    request_block: false,
    approve_block: false,
  },
};

type CapabilityMatrixProps = {
  // Initiale Berechtigungen (sonst fachliche Voreinstellung).
  value?: CapabilityMap;
  // Nur-Lese-Ansicht: zeigt Häkchen statt interaktiver Checkboxen.
  readOnly?: boolean;
  // Callback bei Änderung einer Zelle (nur im interaktiven Modus).
  onChange?: (next: CapabilityMap) => void;
  className?: string;
};

export function CapabilityMatrix({
  value,
  readOnly = false,
  onChange,
  className,
}: CapabilityMatrixProps) {
  const [internal, setInternal] = useState<CapabilityMap>(
    value ?? DEFAULT_CAPABILITIES,
  );
  // Kontrolliert, wenn value gesetzt ist; sonst interner Zustand.
  const matrix = value ?? internal;

  function toggle(role: UserRole, key: CapabilityKey) {
    if (readOnly) return;
    const next: CapabilityMap = {
      ...matrix,
      [role]: { ...matrix[role], [key]: !matrix[role][key] },
    };
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("rounded-(--radius) border border-border", className)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Rolle</TableHead>
              {CAPABILITIES.map((cap) => (
                <TableHead key={cap.key} className="text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Icon
                          icon={cap.icon}
                          aria-hidden
                          className="size-4 text-muted-foreground"
                        />
                        <span>{cap.label}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{cap.description}</TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLES.map((role) => (
              <TableRow key={role}>
                <TableCell className="font-medium">
                  <RoleBadge role={role} />
                </TableCell>
                {CAPABILITIES.map((cap) => {
                  const allowed = matrix[role][cap.key];
                  return (
                    <TableCell key={cap.key} className="text-center">
                      <div className="flex items-center justify-center">
                        {readOnly ? (
                          // Nur-Lese: Häkchen oder Strich.
                          allowed ? (
                            <Icon
                              icon="ph:check-circle-fill"
                              aria-label="erlaubt"
                              className="size-5 text-primary"
                            />
                          ) : (
                            <Icon
                              icon="ph:minus-circle"
                              aria-label="nicht erlaubt"
                              className="size-5 text-muted-foreground"
                            />
                          )
                        ) : (
                          <Checkbox
                            checked={allowed}
                            onCheckedChange={() => toggle(role, cap.key)}
                            aria-label={`${cap.label} für ${role}`}
                          />
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

export { CAPABILITIES, DEFAULT_CAPABILITIES };
