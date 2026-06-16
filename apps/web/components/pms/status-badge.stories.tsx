import type { Meta, StoryObj } from "@storybook/react";

import {
  AvailabilityStatusBadge,
  BlockRequestStatusBadge,
  PaymentStatusBadge,
  ReservationStatusBadge,
  TaskStatusBadge,
  availabilityStatusMeta,
  blockRequestStatusMeta,
  paymentStatusMeta,
  reservationStatusMeta,
  taskStatusMeta,
  type AvailabilityStatus,
  type BlockRequestStatus,
  type PaymentStatus,
  type ReservationStatus,
  type TaskStatus,
} from "./status-badge";

/**
 * Status-Badge-Set — fachliche PMS-Komponente.
 *
 * Lastenheft-Module: §2.2 (Reservierungs-/Buchungsverwaltung), §4 (Aufgaben &
 * Reinigung), §5 (Zahlungen & Finanzen).
 *
 * Bildet die echten Datenbank-Enums auf deutsches Label + Farbe (semantische
 * Tokens) + ph-Icon ab. Zugehörige Tabellen/Enums:
 * - reservation_status   → Tabelle `reservations`        (§2.2)
 * - task_status          → Tabelle `tasks`               (§4)
 * - payment_status       → Tabelle `payments`            (§5)
 * - availability_status  → Tabelle `availability`        (§2.2)
 * - block_request_status → Tabelle `block_requests`      (§2.2/§4)
 *
 * Farb-Konvention (Lastenheft): pending = amber/warning, confirmed/done = grün,
 * cancelled = grau/secondary, completed = dunkelgrün/primary, failed/blocked =
 * destructive.
 */
const meta: Meta = {
  title: "PMS-Komponenten/Status-Badges",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

// Hilfs-Layout: Zeile mit Beschriftung des Enum-Werts.
function Row({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {children}
      <code className="text-xs text-muted-foreground">{value}</code>
    </div>
  );
}

/** Reservierungs-Status (reservation_status) — alle Werte. */
export const Reservierung: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(Object.keys(reservationStatusMeta) as ReservationStatus[]).map((s) => (
        <Row key={s} value={s}>
          <ReservationStatusBadge status={s} />
        </Row>
      ))}
    </div>
  ),
};

/** Aufgaben-Status (task_status) — alle Werte. */
export const Aufgabe: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(Object.keys(taskStatusMeta) as TaskStatus[]).map((s) => (
        <Row key={s} value={s}>
          <TaskStatusBadge status={s} />
        </Row>
      ))}
    </div>
  ),
};

/** Zahlungs-Status (payment_status) — alle Werte. */
export const Zahlung: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(Object.keys(paymentStatusMeta) as PaymentStatus[]).map((s) => (
        <Row key={s} value={s}>
          <PaymentStatusBadge status={s} />
        </Row>
      ))}
    </div>
  ),
};

/** Verfügbarkeits-Status (availability_status) — alle Werte. */
export const Verfuegbarkeit: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(Object.keys(availabilityStatusMeta) as AvailabilityStatus[]).map((s) => (
        <Row key={s} value={s}>
          <AvailabilityStatusBadge status={s} />
        </Row>
      ))}
    </div>
  ),
};

/** Sperr-Anfrage-Status (block_request_status) — alle Werte. */
export const Sperranfrage: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(Object.keys(blockRequestStatusMeta) as BlockRequestStatus[]).map((s) => (
        <Row key={s} value={s}>
          <BlockRequestStatusBadge status={s} />
        </Row>
      ))}
    </div>
  ),
};

/** Gesamtübersicht aller Enums in einem Raster. */
export const Gesamtuebersicht: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Reservierung</h3>
        {(Object.keys(reservationStatusMeta) as ReservationStatus[]).map((s) => (
          <ReservationStatusBadge key={s} status={s} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Aufgabe</h3>
        {(Object.keys(taskStatusMeta) as TaskStatus[]).map((s) => (
          <TaskStatusBadge key={s} status={s} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Zahlung</h3>
        {(Object.keys(paymentStatusMeta) as PaymentStatus[]).map((s) => (
          <PaymentStatusBadge key={s} status={s} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Verfügbarkeit</h3>
        {(Object.keys(availabilityStatusMeta) as AvailabilityStatus[]).map((s) => (
          <AvailabilityStatusBadge key={s} status={s} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Sperr-Anfrage</h3>
        {(Object.keys(blockRequestStatusMeta) as BlockRequestStatus[]).map((s) => (
          <BlockRequestStatusBadge key={s} status={s} />
        ))}
      </div>
    </div>
  ),
};
