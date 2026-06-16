// Fachliche PMS-Komponente: Status-Badge-Set (Lastenheft §2.2/§4/§5).
// Bildet die echten DB-Enums auf Label (DE) + Badge-Variante (Farbe via Token) + ph-Icon ab.
// Nutzt das Badge-Primitiv; Icons via Iconify (ph:*) — niemals lucide-react.
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Badge-Variante (semantische Tokens) — keine Hex-Farben.
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

// Ein Eintrag pro Enum-Wert: deutsches Label, Farb-Variante, ph-Icon.
type StatusMeta = {
  label: string;
  variant: BadgeVariant;
  icon: string;
};

// ---- Enum-Werte (verbindlich aus supabase/migrations) ----
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type AvailabilityStatus = "open" | "booked" | "blocked";
export type BlockRequestStatus = "pending" | "approved" | "rejected";

// ---- Reservierungs-Status (reservations.status) ----
export const reservationStatusMeta: Record<ReservationStatus, StatusMeta> = {
  pending: { label: "Ausstehend", variant: "warning", icon: "ph:hourglass-medium" },
  confirmed: { label: "Bestätigt", variant: "success", icon: "ph:check-circle" },
  cancelled: { label: "Storniert", variant: "secondary", icon: "ph:x-circle" },
  completed: { label: "Abgeschlossen", variant: "default", icon: "ph:flag-checkered" },
};

// ---- Aufgaben-Status (tasks.status) ----
export const taskStatusMeta: Record<TaskStatus, StatusMeta> = {
  open: { label: "Offen", variant: "warning", icon: "ph:circle-dashed" },
  in_progress: { label: "In Arbeit", variant: "default", icon: "ph:spinner-gap" },
  done: { label: "Erledigt", variant: "success", icon: "ph:check-circle" },
  cancelled: { label: "Abgebrochen", variant: "secondary", icon: "ph:x-circle" },
};

// ---- Zahlungs-Status (payments.status) ----
export const paymentStatusMeta: Record<PaymentStatus, StatusMeta> = {
  pending: { label: "Ausstehend", variant: "warning", icon: "ph:hourglass-medium" },
  succeeded: { label: "Erfolgreich", variant: "success", icon: "ph:check-circle" },
  failed: { label: "Fehlgeschlagen", variant: "destructive", icon: "ph:warning-circle" },
  refunded: { label: "Erstattet", variant: "secondary", icon: "ph:arrow-u-up-left" },
};

// ---- Verfügbarkeits-Status (availability.status) ----
export const availabilityStatusMeta: Record<AvailabilityStatus, StatusMeta> = {
  open: { label: "Frei", variant: "success", icon: "ph:calendar-check" },
  booked: { label: "Belegt", variant: "default", icon: "ph:calendar-dot" },
  blocked: { label: "Gesperrt", variant: "destructive", icon: "ph:calendar-x" },
};

// ---- Sperr-Anfrage-Status (block_requests.status) ----
export const blockRequestStatusMeta: Record<BlockRequestStatus, StatusMeta> = {
  pending: { label: "Ausstehend", variant: "warning", icon: "ph:hourglass-medium" },
  approved: { label: "Genehmigt", variant: "success", icon: "ph:check-circle" },
  rejected: { label: "Abgelehnt", variant: "destructive", icon: "ph:x-circle" },
};

// Interner Renderer: Metadaten -> Badge mit Icon + Label.
function StatusBadgeBase({
  meta,
  className,
  ...props
}: { meta: StatusMeta } & Omit<ComponentProps<typeof Badge>, "variant" | "children">) {
  return (
    <Badge variant={meta.variant} className={cn(className)} {...props}>
      <Icon icon={meta.icon} aria-hidden className="size-3.5" />
      {meta.label}
    </Badge>
  );
}

// ---- Öffentliche, typsichere Status-Badges pro Enum ----
export function ReservationStatusBadge({
  status,
  ...props
}: { status: ReservationStatus } & Omit<ComponentProps<typeof Badge>, "variant" | "children">) {
  return <StatusBadgeBase meta={reservationStatusMeta[status]} {...props} />;
}

export function TaskStatusBadge({
  status,
  ...props
}: { status: TaskStatus } & Omit<ComponentProps<typeof Badge>, "variant" | "children">) {
  return <StatusBadgeBase meta={taskStatusMeta[status]} {...props} />;
}

export function PaymentStatusBadge({
  status,
  ...props
}: { status: PaymentStatus } & Omit<ComponentProps<typeof Badge>, "variant" | "children">) {
  return <StatusBadgeBase meta={paymentStatusMeta[status]} {...props} />;
}

export function AvailabilityStatusBadge({
  status,
  ...props
}: { status: AvailabilityStatus } & Omit<ComponentProps<typeof Badge>, "variant" | "children">) {
  return <StatusBadgeBase meta={availabilityStatusMeta[status]} {...props} />;
}

export function BlockRequestStatusBadge({
  status,
  ...props
}: { status: BlockRequestStatus } & Omit<ComponentProps<typeof Badge>, "variant" | "children">) {
  return <StatusBadgeBase meta={blockRequestStatusMeta[status]} {...props} />;
}
