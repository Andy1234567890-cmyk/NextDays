"use client";

// Eigentümer-Portal (§4.2): read-only Liste der EIGENEN Auszahlungs-
// Abrechnungen. Der Eigentümer kann nichts erzeugen/ändern (das macht die
// Agentur) — er sieht Zeitraum, Status und seinen Auszahlungsbetrag und kann
// eine finalisierte Abrechnung als PDF öffnen. Realtime: neue/aktualisierte
// Abrechnungen erscheinen sofort (kein manuelles Reload).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

import { Card, CardContent } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { StatementListItem } from "@/lib/owner-statements";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_LABEL: Record<string, string> = {
  draft: "In Vorbereitung",
  finalized: "Abgeschlossen",
  cancelled: "Storniert",
};

export function MyStatements({
  statements,
  error,
}: {
  statements: StatementListItem[];
  error: string | null;
}) {
  const router = useRouter();

  // owner_statements ist für authenticated bewusst gesperrt (Wurzel 6) — ein Abo
  // darauf feuert nie. Abrechnungen entstehen aus Reservierungen, die der Owner
  // per RLS auf seine Objekte gefiltert sieht; ein Event genügt zum Refresh der
  // Server-Props.
  useRealtime({ table: "reservations", onChange: () => router.refresh() });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          Meine Abrechnungen
        </h1>
        <p className="text-sm text-muted-foreground">
          Deine Auszahlungs-Abrechnungen im Überblick.
        </p>
      </header>

      {error && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && statements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:receipt" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              Es liegen noch keine Abrechnungen für dich vor.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
          {statements.map((s) => (
            <li key={s.id} className="flex items-center gap-4 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Icon icon="ph:receipt" className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {s.period_from} – {s.period_to}
                  {s.invoice_number ? ` · ${s.invoice_number}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {formatCurrency(s.owner_payout, s.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
