// Provisionen — der Teil der Preisliste, den Besucher tatsächlich vergleichen.
//
// Warum eine eigene Sektion und nicht eine Fußnote: Provision ist bei
// Vermietungssoftware die Position, die am Ende mehr kostet als das Abo. Wer
// über Booking.com verkauft, zahlt dort 15–18 % — die Frage „was nimmt IHR
// zusätzlich?" entscheidet mit über den Wechsel. Drei Wege, drei Sätze,
// nebeneinander statt im Kleingedruckten.
//
// Alle Sätze kommen aus dem Backend (`/subscriptions/public/pricing`), das sie
// aus denselben Konstanten liest, mit denen abgerechnet wird — kein zweiter
// Satz Zahlen im Marketing (Wurzel 4). Der 0-%-Wert der eigenen Website ist
// keine Ausnahme: dort entsteht technisch keine Provisionszeile
// (`payments.service._platform_fee_bps` gibt für Nicht-Portal-Buchungen 0
// zurück), deshalb steht die Null hier als Text und nicht als Betrag.
import { useLocale, useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { PROVISION_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { Icon } from "@/components/ui/icon";
import { formatCurrency } from "@/lib/currency";
import type { Preisliste } from "@/lib/preise";

export function PreisProvisionen({ liste }: { liste: Preisliste | null }) {
  const t = useTranslations("preise.provisionen");
  const locale = useLocale();
  // Prozentsatz in der Sprache des Besuchers: "0,5 %" bzw. "0.5 %".
  const prozent = (wert: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(wert)} %`;

  // Ohne Preisliste keine Sätze — dann entfällt die Sektion, statt „0 %" oder
  // einen geratenen Wert zu behaupten.
  if (!liste) return null;

  const wege: readonly { key: string; wert: string; hervor?: boolean }[] = [
    { key: "direkt", wert: t("direktWert"), hervor: true },
    { key: "portale", wert: prozent(liste.commission_external_percent) },
    { key: "marktplatz", wert: prozent(liste.commission_marketplace_percent) },
  ];

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {wege.map((weg) => (
            <div
              key={weg.key}
              className={`flex flex-col rounded-3xl border p-7 ${
                weg.hervor
                  ? "border-accent bg-surface-accent shadow-float"
                  : "border-border bg-card shadow-card"
              }`}
            >
              <span
                className={`flex size-20 items-center justify-center rounded-2xl text-accent ${
                  weg.hervor ? "bg-card" : "bg-surface-accent"
                }`}
              >
                {(() => {
                  const Illustration = PROVISION_ILLUSTRATION[weg.key];
                  return Illustration ? (
                    <Illustration className="size-14" />
                  ) : null;
                })()}
              </span>
              <p className="mt-5 font-display text-3xl font-extrabold tracking-tight text-accent tabular-nums">
                {weg.wert}
              </p>
              <h3 className="mt-2 font-display text-lg font-semibold">
                {t(`${weg.key}Titel`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`${weg.key}Text`)}
              </p>
            </div>
          ))}
        </div>

        {/* Der Monatsdeckel ist das eigentliche Versprechen: die Portal-
            Provision kann nicht mit dem Umsatz mitwachsen. Ohne Währung wäre
            die Zahl in 24 Ländern eine andere — sie kommt deshalb mit ihrer
            Währung aus dem Backend. */}
        <p className="mx-auto mt-10 max-w-3xl rounded-2xl bg-surface-warm px-6 py-5 text-center text-sm leading-relaxed">
          <Icon
            icon="ph:shield-check"
            className="mr-2 inline-block size-4 align-[-0.2em] text-accent"
          />
          {t("deckel", {
            betrag: formatCurrency(
              liste.commission_external_cap_amount,
              liste.commission_external_cap_currency,
              locale,
              0,
            ),
          })}
        </p>
      </div>
    </section>
  );
}
