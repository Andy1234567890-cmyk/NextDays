// Kennzahlen-Kopf der Kundendetailseite: je Währung EINE Kartenreihe
// (Umsatz, offen, überfällig, Belege). Beträge verschiedener Währungen werden
// nie summiert — ein Kunde mit EUR- und DKK-Belegen bekommt zwei Reihen
// (Wurzel 4). Server-tauglich: keine Hooks, Übersetzungen kommen als Props.
import { Icon } from "@iconify/react";

import { Card } from "@nextdays/ui/card";
import type { KundenUebersicht, WaehrungsKennzahlen } from "@/lib/buchhaltung-kontakte-typen";
import { formatCurrency } from "@/lib/currency";

export type KennzahlenTexte = {
  revenue: string;
  open: string;
  overdue: string;
  invoices: string;
  lastInvoice: string;
  none: string;
  truncated: string;
  noInvoices: string;
};

function betrag(wert: string, currency: string, locale: string): string {
  const n = Number(wert);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency, locale);
}

function Kachel({
  icon,
  label,
  wert,
  hinweis,
  ton = "neutral",
}: {
  icon: string;
  label: string;
  wert: string;
  hinweis?: string;
  ton?: "neutral" | "warn";
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon={icon} className="size-4" />
        {label}
      </span>
      <span
        className={`font-display text-xl font-extrabold ${ton === "warn" ? "text-destructive" : ""}`}
      >
        {wert}
      </span>
      {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
    </Card>
  );
}

function WaehrungsReihe({
  k,
  locale,
  texte,
}: {
  k: WaehrungsKennzahlen;
  locale: string;
  texte: KennzahlenTexte;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kachel
        icon="ph:trend-up"
        label={texte.revenue}
        wert={betrag(k.revenueTotal, k.currency, locale)}
      />
      <Kachel
        icon="ph:hourglass"
        label={texte.open}
        wert={betrag(k.openAmount, k.currency, locale)}
        hinweis={`${k.openCount} ${texte.invoices}`}
      />
      <Kachel
        icon="ph:warning-circle"
        label={texte.overdue}
        wert={betrag(k.overdueAmount, k.currency, locale)}
        hinweis={`${k.overdueCount} ${texte.invoices}`}
        ton={Number(k.overdueAmount) > 0 ? "warn" : "neutral"}
      />
      <Kachel icon="ph:receipt" label={texte.invoices} wert={String(k.invoiceCount)} />
    </div>
  );
}

export function Kennzahlen({
  uebersicht,
  locale,
  texte,
}: {
  uebersicht: KundenUebersicht;
  locale: string;
  texte: KennzahlenTexte;
}) {
  const letzter = uebersicht.lastInvoiceDate
    ? new Intl.DateTimeFormat(locale).format(new Date(uebersicht.lastInvoiceDate))
    : texte.none;
  return (
    <div className="flex flex-col gap-3">
      {uebersicht.byCurrency.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">{texte.noInvoices}</Card>
      ) : (
        uebersicht.byCurrency.map((k) => (
          <div key={k.currency} className="flex flex-col gap-1.5">
            {uebersicht.byCurrency.length > 1 && (
              <span className="text-xs font-medium text-muted-foreground">{k.currency}</span>
            )}
            <WaehrungsReihe k={k} locale={locale} texte={texte} />
          </div>
        ))
      )}
      <p className="text-xs text-muted-foreground">
        {texte.lastInvoice}: {letzter}
        {uebersicht.lastInvoiceNumber ? ` · ${uebersicht.lastInvoiceNumber}` : ""}
      </p>
      {uebersicht.truncated && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {texte.truncated}
        </p>
      )}
    </div>
  );
}
