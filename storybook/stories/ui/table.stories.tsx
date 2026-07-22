import { Icon } from "@iconify/react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const meta = {
  title: "UI-Bausteine/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

// Beispieldaten: Zahlungen-Liste (echte Enum-Werte).
type Zahlung = {
  buchung: string;
  gast: string;
  typ: "deposit" | "full" | "refund";
  gateway: "revolut" | "stripe";
  betrag: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
};

const zahlungen: Zahlung[] = [
  {
    buchung: "BK-2041",
    gast: "Lena",
    typ: "deposit",
    gateway: "revolut",
    betrag: "450 €",
    status: "succeeded",
  },
  {
    buchung: "BK-2042",
    gast: "Markus",
    typ: "full",
    gateway: "revolut",
    betrag: "1.250 €",
    status: "pending",
  },
  {
    buchung: "BK-2043",
    gast: "Sofie",
    typ: "full",
    gateway: "stripe",
    betrag: "8.500 Kr",
    status: "failed",
  },
  {
    buchung: "BK-2044",
    gast: "Jonas",
    typ: "refund",
    gateway: "stripe",
    betrag: "300 €",
    status: "refunded",
  },
];

// Deutsche Beschriftung pro Zahlungsart.
const typLabel: Record<Zahlung["typ"], string> = {
  deposit: "Anzahlung",
  full: "Vollzahlung",
  refund: "Erstattung",
};

// Deutsche Beschriftung pro Status.
const statusLabel: Record<Zahlung["status"], string> = {
  pending: "Ausstehend",
  succeeded: "Erfolgreich",
  failed: "Fehlgeschlagen",
  refunded: "Erstattet",
};

// Status als farbiger Badge über semantische Token (siehe Status-Farben Lastenheft).
function StatusBadge({ status }: { status: Zahlung["status"] }) {
  const styles: Record<Zahlung["status"], string> = {
    pending: "bg-secondary text-muted-foreground",
    succeeded: "bg-primary/10 text-primary",
    failed: "bg-destructive/10 text-destructive",
    refunded: "bg-accent/15 text-accent-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-(--radius) px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}

// Gateway mit Icon.
function Gateway({ gateway }: { gateway: Zahlung["gateway"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 capitalize">
      <Icon icon="ph:credit-card" className="h-4 w-4 text-muted-foreground" />
      {gateway}
    </span>
  );
}

// Standard: vollständige Zahlungen-Liste.
export const Standard: Story = {
  render: () => (
    <Table>
      <TableCaption>Zahlungen der letzten 30 Tage</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Buchung</TableHead>
          <TableHead>Gast</TableHead>
          <TableHead>Art</TableHead>
          <TableHead>Gateway</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {zahlungen.map((z) => (
          <TableRow key={z.buchung}>
            <TableCell className="font-medium">{z.buchung}</TableCell>
            <TableCell>{z.gast}</TableCell>
            <TableCell>{typLabel[z.typ]}</TableCell>
            <TableCell>
              <Gateway gateway={z.gateway} />
            </TableCell>
            <TableCell>
              <StatusBadge status={z.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{z.betrag}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

// Mit Fußzeile: Summe der erfolgreichen Zahlungen.
export const MitFusszeile: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Buchung</TableHead>
          <TableHead>Gast</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {zahlungen.map((z) => (
          <TableRow key={z.buchung}>
            <TableCell className="font-medium">{z.buchung}</TableCell>
            <TableCell>{z.gast}</TableCell>
            <TableCell>
              <StatusBadge status={z.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{z.betrag}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Summe (erfolgreich)</TableCell>
          <TableCell className="text-right tabular-nums">450 €</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

// Leerzustand: keine Zahlungen vorhanden.
export const Leerzustand: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Buchung</TableHead>
          <TableHead>Gast</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Icon icon="ph:tray" className="h-5 w-5" />
              Keine Zahlungen vorhanden
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

// Kompakt: einzelne Zeile zur Status-Demonstration.
export const EinzelneZeile: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Buchung</TableHead>
          <TableHead>Art</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Betrag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">BK-2042</TableCell>
          <TableCell>{typLabel.full}</TableCell>
          <TableCell>
            <StatusBadge status="pending" />
          </TableCell>
          <TableCell className="text-right tabular-nums">1.250 €</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
