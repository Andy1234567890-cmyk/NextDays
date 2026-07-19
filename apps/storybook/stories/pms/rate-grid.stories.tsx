/**
 * Rate-Grid (Hotel-Belegungsplan, Board-Optik) — fachliche PMS-Komponente.
 *
 * Datenmodell: 1 property = 1 buchbare Einheit (ein Zimmer). Ein Hotel ist eine
 * Menge solcher Zimmer-Objekte; der Kalender fasst sie NUR in der Anzeige zu
 * einem verschachtelten Grid zusammen — je Zimmerkategorie eine Gruppe, darunter
 * je Rate-Plan (Rate) eine eigene Zeile. Es entsteht KEIN "Gebäude mit Zimmern
 * darunter".
 *
 * - Zeilen: Zimmerkategorie × Rate-Plan (BAR/B&B), abgeleitete Pläne read-only.
 * - Spalten: Tage; Zelle = Preis (aus dem Resolver) + optional Restriktions-Marker.
 * - Vergleich: eine Ferienwohnung ist genau EINE Zeile (kein Board).
 *
 * Diese Story ist ein eigenständiges Mockup (kein Import aus apps/web), um das
 * Konzept zu zeigen, ohne an die Produktionskomponente zu koppeln.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

type Cell = {
  price: number;
  cta?: boolean; // keine Anreise
  ctd?: boolean; // keine Abreise
  minStay?: number;
  stop?: boolean; // Verkaufsstopp
};

type Plan = {
  name: string;
  derived?: string; // Name des Mutter-Plans (abgeleitet → read-only)
  cells: Cell[];
};

type RoomGroup = {
  room: string;
  plans: Plan[];
};

const DAYS = ["Fr 3.", "Sa 4.", "So 5.", "Mo 6.", "Di 7."];

const HOTEL: RoomGroup[] = [
  {
    room: "Twin Room",
    plans: [
      {
        name: "Basisrate (BAR)",
        cells: [
          { price: 100, minStay: 2, cta: true },
          { price: 120, minStay: 2 },
          { price: 100 },
          { price: 90, stop: true },
          { price: 90 },
        ],
      },
      {
        name: "Frühstück (B&B)",
        derived: "Basisrate (BAR)",
        cells: [
          { price: 125 },
          { price: 145 },
          { price: 125 },
          { price: 115 },
          { price: 115 },
        ],
      },
    ],
  },
  {
    room: "Double Room",
    plans: [
      {
        name: "Basisrate (BAR)",
        cells: [
          { price: 140 },
          { price: 160, ctd: true },
          { price: 140 },
          { price: 130 },
          { price: 130 },
        ],
      },
      {
        name: "Frühstück (B&B)",
        derived: "Basisrate (BAR)",
        cells: [
          { price: 165 },
          { price: 185 },
          { price: 165 },
          { price: 155 },
          { price: 155 },
        ],
      },
    ],
  },
];

const FEWO: RoomGroup[] = [
  {
    room: "Ferienhaus am See",
    plans: [
      {
        name: "Standardpreis",
        cells: [
          { price: 210, minStay: 3 },
          { price: 260, minStay: 3 },
          { price: 210 },
          { price: 190 },
          { price: 190 },
        ],
      },
    ],
  },
];

function CellView({ cell }: { cell: Cell }) {
  return (
    <td className="border border-border p-1 text-center align-top">
      <div className="font-medium tabular-nums">
        {cell.stop ? (
          <span className="text-muted-foreground line-through">{cell.price}</span>
        ) : (
          <>{cell.price} €</>
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[0.6rem] text-muted-foreground">
        {cell.minStay ? (
          <span title="Mindestaufenthalt">≥{cell.minStay}</span>
        ) : null}
        {cell.cta ? (
          <span title="keine Anreise">
            <Icon icon="ph:sign-in" className="size-3" />
          </span>
        ) : null}
        {cell.ctd ? (
          <span title="keine Abreise">
            <Icon icon="ph:sign-out" className="size-3" />
          </span>
        ) : null}
        {cell.stop ? (
          <span title="Verkaufsstopp">
            <Icon icon="ph:prohibit" className="size-3" />
          </span>
        ) : null}
      </div>
    </td>
  );
}

function RateGrid({ groups }: { groups: RoomGroup[] }) {
  return (
    <table className="border-collapse text-xs">
      <thead>
        <tr>
          <th className="border border-border bg-secondary p-2 text-left">
            Zimmer / Rate
          </th>
          {DAYS.map((d) => (
            <th key={d} className="border border-border bg-secondary p-2 font-medium">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <>
            <tr key={g.room}>
              <th
                colSpan={DAYS.length + 1}
                className="border border-border bg-muted p-1.5 text-left font-semibold"
              >
                {g.room}
              </th>
            </tr>
            {g.plans.map((p) => (
              <tr key={g.room + p.name}>
                <td className="border border-border p-2">
                  <div className="flex items-center gap-1">
                    {p.name}
                    {p.derived ? (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-secondary px-1.5 text-[0.6rem] text-muted-foreground"
                        title={`Abgeleitet von: ${p.derived}`}
                      >
                        <Icon icon="ph:link" className="size-2.5" />
                        abgeleitet
                      </span>
                    ) : null}
                  </div>
                </td>
                {p.cells.map((c, i) => (
                  <CellView key={i} cell={c} />
                ))}
              </tr>
            ))}
          </>
        ))}
      </tbody>
    </table>
  );
}

const meta = {
  title: "PMS/Rate-Grid (Board-Optik)",
  component: RateGrid,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof RateGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

// Hotel: je Zimmerkategorie eine Gruppe, darunter je Rate-Plan eine Zeile.
// Abgeleitete Pläne (B&B = BAR + Aufschlag) tragen ein Ketten-Badge.
export const Hotel: Story = {
  args: { groups: HOTEL },
};

// Ferienobjekt: genau EINE Zeile — kein Board.
export const Ferienobjekt: Story = {
  args: { groups: FEWO },
};
