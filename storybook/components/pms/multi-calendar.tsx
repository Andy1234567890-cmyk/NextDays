// Fachliche PMS-Komponente: Multi-Kalender (Lastenheft §2.2 — Herzstück).
// Zeigt mehrere Objekte (Zeilen) über einen Zeitraum (Tage als Spalten).
// Pro Tag/Objekt eine Zelle (calendar-cell) mit farbcodiertem Belegungs-Status,
// Saison-Hintergrund und Tooltip mit Buchungsdetails. Inkl. Legende.
//
// Stil/Tokens streng nach BUILD_REFERENCE: nur semantische Token-Klassen
// (keine Hex), Icons NUR via @iconify/react (ph:*), Radix wo sinnvoll (Tooltip).

import { Icon } from "@iconify/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { useMemo } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  CHANNEL_CONFIG,
  type ReservationChannel,
} from "./channel-icon";

/* -------------------------------------------------------------------------- */
/*  Typen & Enums (verbindlich aus supabase/migrations, siehe BUILD_REFERENCE) */
/* -------------------------------------------------------------------------- */

// availability_status: open | booked | blocked
export type AvailabilityStatus = "open" | "booked" | "blocked";

// reservation_status: pending | confirmed | cancelled | completed
export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

// property_type: ferienhaus | appartement | glamping | tiny_house | stellplatz | hausboot
export type PropertyType =
  | "ferienhaus"
  | "appartement"
  | "glamping"
  | "tiny_house"
  | "stellplatz"
  | "hausboot";

// Saison-Kennzeichnung (Hintergrund-Schraffur) — fachlich frei, keine DB-Enum.
export type Season = "low" | "mid" | "high";

// Ein Objekt = eine Zeile im Grid (Tabelle `properties`).
export type CalendarProperty = {
  id: string;
  name: string;
  type: PropertyType;
};

// Eine Reservierung (Tabelle `reservations`) — belegt einen zusammenhängenden
// Zeitraum [von, bis) eines Objekts. `bis` ist der Abreisetag (exklusiv).
export type CalendarReservation = {
  id: string;
  propertyId: string;
  guestFirstName: string; // Eigentümer-Sicht: nur Vorname (BUILD_REFERENCE)
  channel: ReservationChannel;
  status: ReservationStatus;
  // ISO-Datum (YYYY-MM-DD), Zeit ignoriert.
  from: string;
  to: string;
};

// Eine Sperrung (Tabelle `availability`, status = blocked) — z.B. Eigennutzung
// oder Wartung. Belegt ebenfalls einen Zeitraum [von, bis).
export type CalendarBlock = {
  id: string;
  propertyId: string;
  reason: string;
  from: string;
  to: string;
};

/* -------------------------------------------------------------------------- */
/*  Datums-Hilfsfunktionen (bewusst leichtgewichtig, ohne externe Lib)         */
/* -------------------------------------------------------------------------- */

// Normalisiert ein Datum auf Mitternacht (UTC-frei, lokal) als Tages-Schlüssel.
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Erzeugt eine fortlaufende Liste von Tagen ab `start` über `count` Tage.
function buildDays(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// Prüft, ob ein Tag im Zeitraum [from, to) liegt (to = Abreise, exklusiv).
function inRange(dayKey: string, from: string, to: string): boolean {
  return dayKey >= from && dayKey < to;
}

// Wochentag-Kürzel (Mo–So) auf Deutsch.
const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Monats-Kürzel auf Deutsch (für Spalten-Gruppierung).
const MONTHS_DE = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

/* -------------------------------------------------------------------------- */
/*  Objekt-Typ -> ph-Icon (deutsche Labels via Title)                          */
/* -------------------------------------------------------------------------- */

const PROPERTY_TYPE_CONFIG: Record<
  PropertyType,
  { icon: string; label: string }
> = {
  ferienhaus: { icon: "ph:house", label: "Ferienhaus" },
  appartement: { icon: "ph:buildings", label: "Appartement" },
  glamping: { icon: "ph:tent", label: "Glamping" },
  tiny_house: { icon: "ph:house-line", label: "Tiny House" },
  stellplatz: { icon: "ph:van", label: "Stellplatz" },
  hausboot: { icon: "ph:sailboat", label: "Hausboot" },
};

/* -------------------------------------------------------------------------- */
/*  Zell-Styling (calendar-cell) via CVA — farbcodiert nach Status            */
/* -------------------------------------------------------------------------- */

// Die einzelne Tages-Zelle. Farbe spiegelt den Belegungs-Status wider:
//  - frei (open):     dezenter Hintergrund (success-Token, leicht)
//  - belegt (booked): kanal-/status-abhängig (primary / warning / muted)
//  - gesperrt:        destructive-Token
// Saison wird zusätzlich als Hintergrund-Layer hinter der Zelle gezeigt.
const cellVariants = cva(
  "relative flex h-9 min-w-9 items-center justify-center border-b border-r border-border text-[11px] font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      tone: {
        // Frei buchbar.
        open: "bg-background text-muted-foreground hover:bg-secondary",
        // Bestätigte Buchung.
        confirmed: "bg-primary text-primary-foreground",
        // Abgeschlossene (vergangene) Buchung — etwas gedämpft.
        completed: "bg-secondary text-foreground",
        // Anfrage / unbestätigt.
        pending: "bg-warning text-warning-foreground",
        // Manuelle Sperrung / Eigennutzung / Wartung.
        blocked: "bg-destructive text-destructive-foreground",
      },
      // Markiert Wochenenden (Sa/So) durch dezent stärkeren Rahmen.
      weekend: { true: "border-r-foreground/20", false: "" },
    },
    defaultVariants: { tone: "open", weekend: false },
  },
);

type CellTone = NonNullable<VariantProps<typeof cellVariants>["tone"]>;

// Saison-Hintergrund (liegt als ::before-Layer hinter der Zelle).
// Bewusst sehr dezent (Token-Opazität), damit Status-Farben dominieren.
const SEASON_BG: Record<Season, string> = {
  low: "", // Nebensaison: kein Overlay (neutral)
  mid: "bg-accent/10", // Zwischensaison
  high: "bg-warning/15", // Hauptsaison
};

const SEASON_LABEL: Record<Season, string> = {
  low: "Nebensaison",
  mid: "Zwischensaison",
  high: "Hauptsaison",
};

/* -------------------------------------------------------------------------- */
/*  Einzelne Kalender-Zelle (calendar-cell)                                    */
/* -------------------------------------------------------------------------- */

type CalendarCellProps = {
  tone: CellTone;
  season: Season;
  weekend: boolean;
  // Tooltip-Inhalt (Buchungs-/Sperr-Details). Wenn leer: kein Tooltip.
  tooltip?: React.ReactNode;
  // Kurzes Label in der Zelle (z.B. Gast-Vorname am Anreisetag).
  label?: string;
  // Anreise-/Abreise-Markierung für „Bett-zu-Bett"-Optik.
  isStart?: boolean;
  isEnd?: boolean;
};

// Reine Darstellungs-Einheit für einen Tag eines Objekts.
function CalendarCell({
  tone,
  season,
  weekend,
  tooltip,
  label,
  isStart,
  isEnd,
}: CalendarCellProps) {
  const cell = (
    <div
      role="gridcell"
      tabIndex={tooltip ? 0 : -1}
      aria-label={typeof label === "string" ? label : undefined}
      className={cn(cellVariants({ tone, weekend }))}
    >
      {/* Saison-Hintergrund-Layer (hinter Inhalt, dezent). */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          tone === "open" ? SEASON_BG[season] : "",
        )}
      />
      {/* Anreise-Keil (links abgerundet) zur „Bett-zu-Bett"-Optik. */}
      {isStart && tone !== "open" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 left-0.5 w-1 rounded-full bg-background/50"
        />
      )}
      {isEnd && tone !== "open" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 right-0.5 w-1 rounded-full bg-background/50"
        />
      )}
      {label && (
        <span className="relative z-10 truncate px-1">{label}</span>
      )}
    </div>
  );

  if (!tooltip) return cell;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*  Belegungs-Auflösung: Status pro Objekt/Tag berechnen                       */
/* -------------------------------------------------------------------------- */

type DayResolution = {
  tone: CellTone;
  tooltip?: React.ReactNode;
  label?: string;
  isStart?: boolean;
  isEnd?: boolean;
};

// Mappt reservation_status auf die farbliche Zell-Tönung.
function reservationTone(status: ReservationStatus): CellTone {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "pending":
      return "pending";
    case "completed":
      return "completed";
    case "cancelled":
    default:
      return "open"; // Stornos belegen den Tag nicht mehr.
  }
}

/* -------------------------------------------------------------------------- */
/*  Multi-Kalender (Haupt-Komponente)                                          */
/* -------------------------------------------------------------------------- */

export type MultiCalendarProps = ComponentProps<"div"> & {
  // Objekte = Zeilen.
  properties: CalendarProperty[];
  // Reservierungen über alle Objekte.
  reservations?: CalendarReservation[];
  // Sperrungen über alle Objekte.
  blocks?: CalendarBlock[];
  // Startdatum der Spalten (ISO oder Date). Default: heute.
  startDate?: string | Date;
  // Anzahl angezeigter Tage (Spalten). Default: 21.
  days?: number;
  // Liefert die Saison für einen Tag (Default: alles Nebensaison).
  seasonFor?: (date: Date) => Season;
  // Klick auf eine Zelle (z.B. zum Anlegen/Öffnen einer Buchung).
  onCellClick?: (propertyId: string, dateKey: string) => void;
  // Legende ein-/ausblenden.
  showLegend?: boolean;
};

export function MultiCalendar({
  properties,
  reservations = [],
  blocks = [],
  startDate,
  days = 21,
  seasonFor,
  onCellClick,
  showLegend = true,
  className,
  ...props
}: MultiCalendarProps) {
  // Spalten-Tage einmalig berechnen.
  const start = useMemo(() => {
    const d = startDate ? new Date(startDate) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [startDate]);

  const dayList = useMemo(() => buildDays(start, days), [start, days]);

  // Monats-Gruppen für den Spalten-Kopf (zusammenhängende Monate spannen).
  const monthGroups = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    for (const d of dayList) {
      const label = `${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.span += 1;
      else groups.push({ label, span: 1 });
    }
    return groups;
  }, [dayList]);

  // Belegung für ein Objekt/Tag auflösen: Sperrung hat Vorrang vor Buchung.
  function resolve(propertyId: string, day: Date): DayResolution {
    const key = toKey(day);

    // 1) Sperrungen prüfen (availability_status = blocked).
    const block = blocks.find(
      (b) => b.propertyId === propertyId && inRange(key, b.from, b.to),
    );
    if (block) {
      return {
        tone: "blocked",
        isStart: key === block.from,
        isEnd: toKey(addDay(day)) === block.to,
        tooltip: (
          <div className="space-y-0.5">
            <p className="flex items-center gap-1 font-semibold">
              <Icon icon="ph:lock-simple" aria-hidden />
              Gesperrt
            </p>
            <p>{block.reason}</p>
            <p className="text-primary-foreground/70">
              {fmtRange(block.from, block.to)}
            </p>
          </div>
        ),
      };
    }

    // 2) Aktive Reservierungen prüfen (Stornos zählen nicht).
    const res = reservations.find(
      (r) =>
        r.propertyId === propertyId &&
        r.status !== "cancelled" &&
        inRange(key, r.from, r.to),
    );
    if (res) {
      const chan = CHANNEL_CONFIG[res.channel];
      const isStart = key === res.from;
      return {
        tone: reservationTone(res.status),
        isStart,
        isEnd: toKey(addDay(day)) === res.to,
        // Gast-Vorname nur am Anreisetag (kompakt, Eigentümer-Sicht).
        label: isStart ? res.guestFirstName : undefined,
        tooltip: (
          <div className="space-y-0.5">
            <p className="flex items-center gap-1 font-semibold">
              <Icon icon={chan.icon} aria-hidden />
              {res.guestFirstName}
            </p>
            <p className="text-primary-foreground/70">{chan.label}</p>
            <p className="text-primary-foreground/70">
              {fmtRange(res.from, res.to)}
            </p>
            <p className="capitalize">{statusLabelDe(res.status)}</p>
          </div>
        ),
      };
    }

    // 3) Frei.
    return { tone: "open" };
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "w-full overflow-hidden rounded-(--radius) border border-border bg-card text-card-foreground",
          className,
        )}
        {...props}
      >
        {/* Scroll-Container: Objekt-Spalte bleibt links fixiert (sticky). */}
        <div className="overflow-x-auto">
          <div
            role="grid"
            aria-label="Belegungskalender mehrerer Objekte"
            className="inline-grid min-w-full"
            style={{
              // 1 Objekt-Spalte (fest) + N Tages-Spalten (gleich breit).
              gridTemplateColumns: `minmax(11rem,1fr) repeat(${days}, minmax(2.25rem,1fr))`,
            }}
          >
            {/* --- Kopfzeile 1: Monats-Gruppen --- */}
            <div className="sticky left-0 z-20 border-b border-r border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              Objekt
            </div>
            {monthGroups.map((g) => (
              <div
                key={g.label}
                style={{ gridColumn: `span ${g.span}` }}
                className="border-b border-r border-border bg-secondary/40 px-2 py-1 text-center text-xs font-semibold text-foreground"
              >
                {g.label}
              </div>
            ))}

            {/* --- Kopfzeile 2: Tag + Wochentag --- */}
            <div className="sticky left-0 z-20 border-b border-r border-border bg-card" />
            {dayList.map((d) => {
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={`head-${toKey(d)}`}
                  className={cn(
                    "flex flex-col items-center border-b border-r border-border py-1 text-[10px] leading-tight",
                    weekend
                      ? "bg-secondary/60 text-foreground"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  <span>{WEEKDAYS_DE[d.getDay()]}</span>
                  <span className="font-semibold text-foreground">
                    {d.getDate()}
                  </span>
                </div>
              );
            })}

            {/* --- Datenzeilen: ein Objekt pro Zeile --- */}
            {properties.map((p) => {
              const typeCfg = PROPERTY_TYPE_CONFIG[p.type];
              return (
                <div key={p.id} role="row" className="contents">
                  {/* Objekt-Kopf (sticky links). */}
                  <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-r border-border bg-card px-3 py-1.5">
                    <Icon
                      icon={typeCfg.icon}
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {p.name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {typeCfg.label}
                      </p>
                    </div>
                  </div>

                  {/* Tages-Zellen. */}
                  {dayList.map((d) => {
                    const key = toKey(d);
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    const season = seasonFor ? seasonFor(d) : "low";
                    const r = resolve(p.id, d);
                    const cell = (
                      <CalendarCell
                        tone={r.tone}
                        season={season}
                        weekend={weekend}
                        tooltip={r.tooltip}
                        label={r.label}
                        isStart={r.isStart}
                        isEnd={r.isEnd}
                      />
                    );
                    // Klickbar machen, ohne Tooltip-Trigger zu stören.
                    return onCellClick ? (
                      <button
                        key={`${p.id}-${key}`}
                        type="button"
                        onClick={() => onCellClick(p.id, key)}
                        className="contents text-left"
                      >
                        {cell}
                      </button>
                    ) : (
                      <div key={`${p.id}-${key}`}>{cell}</div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* --- Legende --- */}
        {showLegend && <MultiCalendarLegend />}
      </div>
    </TooltipProvider>
  );
}

/* -------------------------------------------------------------------------- */
/*  Legende (Status- und Saison-Farben erklären)                               */
/* -------------------------------------------------------------------------- */

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "inline-block size-3 rounded-[calc(var(--radius)/2)] border border-border",
          className,
        )}
      />
      {label}
    </span>
  );
}

export function MultiCalendarLegend({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-card px-3 py-2",
        className,
      )}
      {...props}
    >
      <span className="text-xs font-semibold text-foreground">Legende:</span>
      <LegendSwatch className="bg-background" label="Frei" />
      <LegendSwatch className="bg-primary" label="Bestätigt" />
      <LegendSwatch className="bg-warning" label="Anfrage" />
      <LegendSwatch className="bg-secondary" label="Abgeschlossen" />
      <LegendSwatch className="bg-destructive" label="Gesperrt" />
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <LegendSwatch className="bg-accent/10" label="Zwischensaison" />
      <LegendSwatch className="bg-warning/15" label="Hauptsaison" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Kleine Formatter (deutsch)                                                  */
/* -------------------------------------------------------------------------- */

// Nächster Tag (für „bis"-Vergleich bei Abreise-Markierung).
function addDay(d: Date): Date {
  const n = new Date(d);
  n.setDate(d.getDate() + 1);
  return n;
}

// ISO -> "01.06.–08.06." (Anreise–Abreise).
function fmtRange(from: string, to: string): string {
  return `${fmtShort(from)}–${fmtShort(to)}`;
}

function fmtShort(iso: string): string {
  const d = new Date(iso);
  return `${`${d.getDate()}`.padStart(2, "0")}.${`${d.getMonth() + 1}`.padStart(2, "0")}.`;
}

// reservation_status -> deutsches Label.
function statusLabelDe(status: ReservationStatus): string {
  const map: Record<ReservationStatus, string> = {
    pending: "Ausstehend",
    confirmed: "Bestätigt",
    cancelled: "Storniert",
    completed: "Abgeschlossen",
  };
  return map[status];
}

export { cellVariants, SEASON_LABEL, PROPERTY_TYPE_CONFIG };
