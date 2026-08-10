"use client";

// Aktionsmenü nach dem Ziehen eines Zeitraums: erscheint am
// Cursor, zeigt den gewählten Zeitraum und die Aktionen Reservierung (mit/ohne
// Angebot), Sperrzeitraum sowie Stop-Sell. Eigenständiges Element; schließt bei
// Klick daneben oder Esc.
//
// Sperre und Stop-Sell sind ZWEI verschiedene Dinge und stehen deshalb als zwei
// getrennte Einträge mit erklärendem Untertitel:
//   * Sperrzeitraum — Verfügbarkeit 0, der Tag ist überall zu (Eigenbelegung,
//     Renovierung). Kein Grund, keine Notiz.
//   * Stop-Sell — der Tag bleibt verfügbar, wird aber nicht aktiv verkauft;
//     mit Grund + Notiz und optionalem Adressaten.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

type Action =
  | "reservation_quote"
  | "reservation_simple"
  | "owner_stay"
  | "closed"
  | "stop_sell"
  | "bulk";

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
  const t = useTranslations("calendar");

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
          label={t("calendarActionMenu.reservationWithQuote")}
          disabled={saving}
          onClick={() => onAction("reservation_quote")}
        />
        <MenuItem
          icon="ph:note-pencil"
          label={t("calendarActionMenu.reservationWithoutQuote")}
          disabled={saving}
          onClick={() => onAction("reservation_simple")}
        />
        {/* Eigennutzung (0241): belegt den Kalender wie eine Buchung, ist aber
            kein Umsatz — deshalb ein eigener Eintrag neben den Reservierungen. */}
        <MenuItem
          icon="ph:house-line"
          label={t("calendarActionMenu.ownerStay")}
          disabled={saving}
          onClick={() => onAction("owner_stay")}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItem
          icon="ph:lock-simple"
          label={saving ? t("calendarActionMenu.blocking") : t("calendarActionMenu.createBlockedPeriod")}
          hint={t("calendarActionMenu.createBlockedPeriodHint")}
          disabled={saving}
          onClick={() => onAction("closed")}
        />
        <MenuItem
          icon="ph:prohibit"
          label={t("calendarActionMenu.setStopSell")}
          hint={t("calendarActionMenu.setStopSellHint")}
          disabled={saving}
          onClick={() => onAction("stop_sell")}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItem
          icon="ph:sliders-horizontal"
          label={t("calendarActionMenu.priceMinStayBlock")}
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
  hint,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  /** Erklärender Untertitel — trennt zwei ähnlich klingende Aktionen. */
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:text-muted-foreground/50"
    >
      <Icon icon={icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {hint && (
          <span className="text-xs font-normal text-muted-foreground">{hint}</span>
        )}
      </span>
    </button>
  );
}
