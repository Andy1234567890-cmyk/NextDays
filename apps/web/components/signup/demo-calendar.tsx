// Statischer Demo-Kalender als Hintergrund der Sign-up-Seite (wie Lodgify).
// Rein dekorativ: Objektzeilen links, Monatsraster mit Buchungsbalken rechts.
// Wird abgeblendet/leicht unscharf hinter das Modal gelegt. Größen in rem.
import { Icon } from "@iconify/react";

// Tage der Kopfzeile (zwei Wochen eines Beispielmonats).
const DAYS = Array.from({ length: 21 }, (_, i) => i + 8);

// Beispiel-Objekte mit Buchungsbalken. start/span beziehen sich auf DAYS-Spalten.
type Booking = { start: number; span: number; label: string; tone: string };
type Unit = { name: string; type: string; bookings: Booking[] };

const UNITS: Unit[] = [
  {
    name: "Villa Sonnenschein",
    type: "Ganze Unterkunft",
    bookings: [
      { start: 0, span: 4, label: "M. Becker", tone: "bg-accent/85 text-white" },
      { start: 6, span: 5, label: "Direkt", tone: "bg-primary/85 text-white" },
      { start: 14, span: 4, label: "Airbnb", tone: "bg-rose-400 text-white" },
    ],
  },
  {
    name: "Apartment Hafenblick",
    type: "Apartment",
    bookings: [
      { start: 2, span: 3, label: "Booking.com", tone: "bg-sky-400 text-white" },
      { start: 8, span: 6, label: "L. Hartmann", tone: "bg-accent/85 text-white" },
    ],
  },
  {
    name: "Chalet Bergluft",
    type: "Ferienhaus",
    bookings: [
      { start: 0, span: 5, label: "Direkt", tone: "bg-primary/85 text-white" },
      { start: 7, span: 4, label: "Vrbo", tone: "bg-emerald-400 text-white" },
      { start: 13, span: 5, label: "S. König", tone: "bg-accent/85 text-white" },
    ],
  },
  {
    name: "Studio Altstadt",
    type: "Studio",
    bookings: [
      { start: 1, span: 4, label: "Airbnb", tone: "bg-rose-400 text-white" },
      { start: 9, span: 7, label: "P. Wagner", tone: "bg-accent/85 text-white" },
    ],
  },
  {
    name: "Loft Rheinaue",
    type: "Loft",
    bookings: [
      { start: 3, span: 5, label: "Booking.com", tone: "bg-sky-400 text-white" },
      { start: 11, span: 4, label: "Direkt", tone: "bg-primary/85 text-white" },
    ],
  },
  {
    name: "Ferienhaus Seeblick",
    type: "Ferienhaus",
    bookings: [
      { start: 0, span: 3, label: "Vrbo", tone: "bg-emerald-400 text-white" },
      { start: 5, span: 6, label: "T. Schmidt", tone: "bg-accent/85 text-white" },
      { start: 16, span: 3, label: "Direkt", tone: "bg-primary/85 text-white" },
    ],
  },
];

export function DemoCalendar() {
  return (
    <div className="pointer-events-none flex h-full w-full select-none flex-col bg-background">
      {/* Kalender-Toolbar */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <div className="flex size-9 items-center justify-center rounded-(--radius) bg-primary text-primary-foreground">
          <Icon icon="ph:calendar-blank" className="size-5" />
        </div>
        <span className="font-display text-lg font-extrabold">Kalender</span>
        <div className="ml-4 flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm text-muted-foreground">
          <Icon icon="ph:caret-left" className="size-4" />
          <span className="font-medium text-foreground">Juni 2026</span>
          <Icon icon="ph:caret-right" className="size-4" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            Alle Objekte
          </span>
          <span className="rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">
            Monat
          </span>
        </div>
      </div>

      {/* Gitter: feste Objektspalte + scrollende Tagespalten */}
      <div className="grid flex-1 grid-cols-[14rem_1fr] overflow-hidden">
        {/* Kopfzeile Objektspalte */}
        <div className="border-b border-r px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Objekt
        </div>
        {/* Kopfzeile Tage */}
        <div
          className="grid border-b"
          style={{ gridTemplateColumns: `repeat(${DAYS.length}, minmax(0, 1fr))` }}
        >
          {DAYS.map((d) => (
            <div
              key={d}
              className="border-r py-3 text-center text-sm text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Objektzeilen */}
        {UNITS.map((unit) => (
          <Row key={unit.name} unit={unit} />
        ))}
      </div>
    </div>
  );
}

function Row({ unit }: { unit: Unit }) {
  return (
    <>
      {/* Objektname links */}
      <div className="flex flex-col justify-center border-b border-r px-4 py-4">
        <span className="truncate text-sm font-semibold">{unit.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {unit.type}
        </span>
      </div>

      {/* Tageszellen + Buchungsbalken */}
      <div className="relative border-b">
        <div
          className="grid h-full"
          style={{ gridTemplateColumns: `repeat(${DAYS.length}, minmax(0, 1fr))` }}
        >
          {DAYS.map((d) => (
            <div key={d} className="border-r" />
          ))}
        </div>
        {unit.bookings.map((b, i) => (
          <div
            key={i}
            className={`absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-full px-3 text-xs font-medium ${b.tone}`}
            style={{
              left: `calc(${(b.start / DAYS.length) * 100}% + 0.25rem)`,
              width: `calc(${(b.span / DAYS.length) * 100}% - 0.5rem)`,
              height: "1.75rem",
            }}
          >
            <span className="truncate">{b.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
