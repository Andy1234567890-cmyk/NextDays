// Buchhaltung → Lieferanten: alle Kunden mit `is_supplier` (GET /suppliers,
// serverseitig gefiltert; `?search=` sucht in Name, E-Mail, Kundennummer).
// Server Component; Zeile führt zur gemeinsamen Detailseite unter /kunden/[id].
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LieferantenSuche } from "@/components/buchhaltung/kontakte/lieferanten-suche";
import { NewCustomerButton } from "@/components/buchhaltung/new-customer-button";
import { Avatar, AvatarFallback } from "@nextdays/ui/avatar";
import { Card } from "@nextdays/ui/card";
import { listLieferanten } from "@/lib/buchhaltung-kontakte";

function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length >= 2) return (teile[0][0] + teile[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default async function LieferantenPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const [res, t] = await Promise.all([listLieferanten(search), getTranslations("finance")]);

  return (
    <div className="flex flex-col gap-6">
      {/* Kein Realtime: `customers` ist für authenticated gesperrt (Wurzel 6,
        Migration 0337). Neue Lieferanten erscheinen beim nächsten Laden; nach
        dem Anlegen lädt die Seite ohnehin neu. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("lieferantenPage.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("lieferantenPage.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* useSearchParams braucht eine Suspense-Grenze. */}
          <Suspense fallback={null}>
            <LieferantenSuche />
          </Suspense>
          <NewCustomerButton />
        </div>
      </div>

      {!res.ok ? (
        res.status === 403 ? (
          notFound()
        ) : (
          <Card className="p-5 text-sm text-destructive">{t("lieferantenPage.loadError")}</Card>
        )
      ) : res.data.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:truck" className="size-7 text-muted-foreground" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold">
              {search ? t("lieferantenPage.noResults") : t("lieferantenPage.emptyTitle")}
            </p>
            <p className="text-sm text-muted-foreground">{t("lieferantenPage.emptyDescription")}</p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {res.data.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/buchhaltung/kunden/${l.id}`}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-secondary/30"
                >
                  <Avatar>
                    <AvatarFallback>{initialen(l.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{l.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[l.customer_number, l.email, l.phone].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                  {l.vat_id && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{l.vat_id}</span>
                  )}
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
