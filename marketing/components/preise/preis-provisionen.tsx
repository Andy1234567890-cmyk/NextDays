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
import { formatCurrency } from "@/lib/currency";
import { formatProzent, type Preisliste } from "@/lib/preise";

export function PreisProvisionen({ liste }: { liste: Preisliste | null }) {
  const t = useTranslations("preise.provisionen");
  const locale = useLocale();

  // Ohne Preisliste keine Sätze — dann entfällt die Sektion, statt „0 %" oder
  // einen geratenen Wert zu behaupten.
  if (!liste) return null;

  // `wert` ist die Überschrift der Karte, `satz` derselbe Wert für den Absatz
  // darunter. Bewusst EIN Ausdruck für beide: die Sätze standen früher als
  // „0,5 %"/„8 %" im Fließtext der 24 Sprachdateien — bei einer Satzänderung
  // im Backend hätte auf derselben Karte die neue Zahl über einem Absatz mit
  // der alten gestanden, ohne dass tsc, ESLint oder ein Test es merkt
  // (Wurzel 4). Der Direktweg hat keinen API-Satz, weil dort technisch keine
  // Provisionszeile entsteht — seine Null steht als Text (`direktWert`) und
  // wird als solcher auch in den Absatz gegeben.
  const wege: readonly { key: string; wert: string; hervor?: boolean }[] = [
    { key: "direkt", wert: t("direktWert"), hervor: true },
    {
      key: "portale",
      wert: formatProzent(liste.commission_external_percent, locale),
    },
    {
      key: "marktplatz",
      wert: formatProzent(liste.commission_marketplace_percent, locale),
    },
  ];

  // Der Monatsdeckel ist das eigentliche Versprechen der Portal-Karte: die
  // Provision kann nicht mit dem Umsatz mitwachsen. Er steht deshalb IM Text
  // dieser Karte und nicht als eigener Satz darunter — dort las er sich wie
  // eine Fußnote zu allen drei Wegen, gilt aber nur für die Portale. Ohne
  // Währung wäre die Zahl in 24 Ländern eine andere, sie kommt deshalb mit
  // ihrer Währung aus dem Backend (Wurzel 4).
  const deckel = formatCurrency(
    liste.commission_external_cap_amount,
    liste.commission_external_cap_currency,
    locale,
    0,
  );

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
                {t(`${weg.key}Text`, { satz: weg.wert, betrag: deckel })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
