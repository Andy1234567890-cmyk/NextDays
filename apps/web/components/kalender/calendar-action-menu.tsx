"use client";

// Aktionsmenü nach dem Ziehen eines Zeitraums (wie Lodgify): erscheint am
// Cursor, zeigt den gewählten Zeitraum und die Aktionen Reservierung (mit/ohne
// Angebot) sowie Sperrzeitraum. Eigenständiges Element; schließt bei Klick
// daneben oder Esc.
import { Icon } from "@iconify/react";
import { useEffect } from "react";

type Action = "reservation_quote" | "reservation_simple" | "closed" | "bulk";

export function CalendarActionMenu({
  at,
  rangeLabel,
  saving,
  onAction,
  onClose,
}: {
  at: { x: number; y: number };
  rangeLabel: string;
  saving: boolean;
  onAction: (action: Action) => void;
  onClose: () => void;
}) {
  // Esc schließt das Menü.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Menü am rechten/unteren Rand nicht überlaufen lassen.
  const MENU_W = 17; // rem
  const left = `min(${at.x}px, calc(100vw - ${MENU_W}rem - 1rem))`;

  return (
    <>
      {/* Klick daneben schließt das Menü */}
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />

      <div
        className="fixed z-50 overflow-hidden rounded-(--radius) border bg-popover py-1 text-popover-foreground shadow-md"
        style={{ left, top: `${at.y + 8}px`, width: `${MENU_W}rem` }}
      >
        <p className="px-3 py-1.5 text-xs text-muted-foreground">{rangeLabel}</p>
        <div className="my-1 h-px bg-border" />

        <MenuItem
          icon="ph:invoice"
          label="Reservierung mit Angebot"
          disabled={saving}
          onClick={() => onAction("reservation_quote")}
        />
        <MenuItem
          icon="ph:note-pencil"
          label="Reservierung ohne Angebot"
          disabled={saving}
          onClick={() => onAction("reservation_simple")}
        />
        <MenuItem
          icon="ph:calendar-x"
          label={saving ? "Sperren…" : "Sperrzeitraum anlegen"}
          disabled={saving}
          onClick={() => onAction("closed")}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItem
          icon="ph:sliders-horizontal"
          label="Preis / Min-Stay / Sperre …"
          disabled={saving}
          onClick={() => onAction("bulk")}
        />
      </div>
    </>
  );
}

function MenuItem({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:text-muted-foreground/50"
    >
      <Icon icon={icon} className="size-4 shrink-0 text-muted-foreground" />
      {label}
    </button>
  );
}
