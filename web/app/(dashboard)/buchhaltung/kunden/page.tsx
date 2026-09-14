// Buchhaltung → Kunden: Liste aller Kunden/Lieferanten des Tenants.
// Server Component — lädt über die Server-Action, rendert Liste + Anlegen.
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewCustomerButton } from "@/components/buchhaltung/new-customer-button";
import { Avatar, AvatarFallback } from "@nextdays/ui/avatar";
import { Card } from "@nextdays/ui/card";
import { listCustomers, type Customer } from "@/lib/buchhaltung";

function initials(c: Customer): string {
  const parts = c.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return c.name.slice(0, 2).toUpperCase();
}

export default async function KundenPage() {
  const [res, t] = await Promise.all([listCustomers(), getTranslations("finance")]);

  return (
    <div className="flex flex-col gap-6">
      {/* Kein Realtime mehr: `customers` ist für authenticated bewusst gesperrt
        (Wurzel 6, Migration 0337: revoke + raus aus supabase_realtime), ein Abo
        darauf wäre eine stumme Attrappe. Eine offene Tabelle mit demselben
        Ereignis gibt es nicht. Ehrlich benannt: neue, geänderte oder gelöschte
        Kunden/Lieferanten erscheinen erst beim nächsten Laden der Seite —
        Kunden-Stammdaten pflegt der Nutzer hier selbst, die Seite lädt nach der
        eigenen Aktion ohnehin neu. */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("kundenPage.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("kundenPage.subtitle")}</p>
        </div>
        <NewCustomerButton />
      </div>

      {!res.ok ? (
        // Fehlende Berechtigung (owner_reporting) → Buchhaltung existiert für
        // diesen Nutzer nicht (Sidebar blendet sie aus, Wurzel 3).
        res.status === 403 ? (
          notFound()
        ) : (
          <Card className="p-5 text-sm text-destructive">{t("kundenPage.loadError")}</Card>
        )
      ) : res.data.items.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {res.data.items.map((c) => (
              <li key={c.id}>
                {/* Zeile führt zur Detailseite (Kennzahlen, Ansprechpartner,
                  Adressen, Notizen — Bereich »kontakte«). */}
                <Link
                  href={`/buchhaltung/kunden/${c.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-secondary/30"
                >
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
                    {t("kundenPage.supplier")}
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {c.customer_type === "private" ? t("kundenPage.typePrivate") : t("kundenPage.typeBusiness")}
                </span>
                <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function EmptyState({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon icon="ph:address-book" className="size-7 text-muted-foreground" />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold">{t("kundenPage.emptyTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("kundenPage.emptyDescription")}</p>
      </div>
      <NewCustomerButton />
    </Card>
  );
}
