// Buchhaltung → Kunden: Liste aller Kunden/Lieferanten des Tenants.
// Server Component — lädt über die Server-Action, rendert Liste + Anlegen.
import { Icon } from "@iconify/react";

import { NewCustomerButton } from "@/components/buchhaltung/new-customer-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { listCustomers, type Customer } from "@/lib/buchhaltung";

function initials(c: Customer): string {
  const parts = c.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return c.name.slice(0, 2).toUpperCase();
}

export default async function KundenPage() {
  const res = await listCustomers();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Kunden</h2>
          <p className="text-sm text-muted-foreground">
            Verwalte Kunden und Lieferanten.
          </p>
        </div>
        <NewCustomerButton />
      </div>

      {!res.ok ? (
        <Card className="p-5 text-sm text-destructive">
          {res.status === 403
            ? "Keine Berechtigung für die Buchhaltung."
            : "Kunden konnten nicht geladen werden. Ist das Backend erreichbar?"}
        </Card>
      ) : res.data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {res.data.items.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-3">
                <Avatar>
                  <AvatarFallback>{initials(c)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  {c.email && (
                    <span className="truncate text-xs text-muted-foreground">
                      {c.email}
                    </span>
                  )}
                </div>
                {c.is_supplier && (
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    Lieferant
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {c.customer_type === "private" ? "Privat" : "Geschäftlich"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon icon="ph:address-book" className="size-7 text-muted-foreground" />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold">Noch keine Kunden</p>
        <p className="text-sm text-muted-foreground">
          Lege deinen ersten Kunden an, um loszulegen.
        </p>
      </div>
      <NewCustomerButton />
    </Card>
  );
}
