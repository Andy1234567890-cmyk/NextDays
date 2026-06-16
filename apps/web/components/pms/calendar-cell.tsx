// Fachliche PMS-Komponente: Kalender-Tageszelle (Lastenheft §2.2).
// Einzelne Tageszelle des Multi-Kalender-Grids: Datum, availability_status
// (open/booked/blocked) farbcodiert, optional Preis (price-display), optionaler
// Event-Punkt, Hover-Stil, editierbar-Flag.
// Icons via Iconify (ph:*) — niemals lucide-react. Nur semantische Token-Klassen.
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { PriceDisplay, type PriceCurrency } from "@/components/pms/price-display";
import { cn } from "@/lib/utils";

// Verfügbarkeits-Status (verbindlich aus supabase/migrations: availability_status).
export type AvailabilityStatus = "open" | "booked" | "blocked";

// Farb-/Stil-Konvention je Status (nur semantische Tokens, keine Hex).
// open = frei (dezent), booked = belegt (primär), blocked = gesperrt (destructive).
const cellVariants = cva(
  "group relative flex min-h-16 w-full flex-col items-stretch justify-between gap-1 rounded-(--radius) border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      status: {
        // Frei: heller Hintergrund, normale Schrift.
        open: "border-border bg-background text-foreground",
        // Belegt: Sekundär-Fläche, gedämpfte Schrift.
        booked: "border-border bg-secondary text-foreground",
        // Gesperrt: destruktive Tönung, gedämpft.
        blocked: "border-destructive/30 bg-destructive/10 text-muted-foreground",
      },
      // Editierbar: Hover-/Cursor-Feedback nur bei Bearbeitbarkeit.
      editable: {
        true: "cursor-pointer hover:border-(--ring) hover:bg-accent/5",
        false: "cursor-default",
      },
      // Aktuell ausgewählte Zelle hervorheben.
      selected: {
        true: "ring-2 ring-ring",
        false: "",
      },
    },
    defaultVariants: { status: "open", editable: false, selected: false },
  },
);

type CalendarCellProps = Omit<ComponentProps<"button">, "children"> &
  VariantProps<typeof cellVariants> & {
    /** Datum der Zelle (ISO-String oder Date). */
    date: string | Date;
    /** Verfügbarkeits-Status (availability_status). */
    status: AvailabilityStatus;
    /** Optionaler Preis pro Nacht (glatter Betrag ohne Cent). */
    price?: number;
    /** Währung für den Preis (Pflicht, wenn price gesetzt). */
    currency?: PriceCurrency;
    /** Optionaler Event-Punkt (z.B. Anreise, Aufgabe, Notiz). */
    hasEvent?: boolean;
    /** Optionales Label für den Event-Punkt (Tooltip/aria). */
    eventLabel?: string;
  };

// Tagesnummer aus ISO-String/Date ableiten.
function formatDay(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("de-DE", { day: "numeric" }).format(d);
}

// Vollständiges Datum für aria-label/title.
function formatFull(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// Deutsches Status-Label für aria-label.
const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  open: "Frei",
  booked: "Belegt",
  blocked: "Gesperrt",
};

// Event-Punkt-Farbe je Status (semantischer Token, gut sichtbar im Kontext).
const EVENT_DOT_CLASS: Record<AvailabilityStatus, string> = {
  open: "bg-accent",
  booked: "bg-primary",
  blocked: "bg-destructive",
};

export function CalendarCell({
  className,
  date,
  status,
  price,
  currency,
  hasEvent = false,
  eventLabel,
  editable = false,
  selected = false,
  disabled,
  ...props
}: CalendarCellProps) {
  const day = formatDay(date);
  const full = formatFull(date);
  const showPrice = typeof price === "number" && !!currency;

  return (
    <button
      type="button"
      disabled={disabled ?? !editable}
      aria-label={`${full} — ${STATUS_LABEL[status]}${
        showPrice ? `, ${price} ${currency}` : ""
      }${hasEvent ? `, ${eventLabel ?? "Ereignis"}` : ""}`}
      title={full}
      className={cn(cellVariants({ status, editable, selected }), className)}
      {...props}
    >
      {/* Kopf: Tagesnummer + optionaler Event-Punkt. */}
      <span className="flex items-start justify-between">
        <span className="text-sm font-semibold tabular-nums">{day}</span>
        {hasEvent ? (
          <span
            role="img"
            aria-label={eventLabel ?? "Ereignis"}
            title={eventLabel ?? "Ereignis"}
            className={cn("mt-1 size-2 rounded-full", EVENT_DOT_CLASS[status])}
          />
        ) : null}
      </span>

      {/* Fuß: optionaler Preis pro Nacht (nur bei freien/belegten Tagen sinnvoll). */}
      {showPrice ? (
        <PriceDisplay
          size="sm"
          amount={price}
          currency={currency}
          className="text-xs font-medium text-muted-foreground"
        />
      ) : null}
    </button>
  );
}

export { cellVariants };
