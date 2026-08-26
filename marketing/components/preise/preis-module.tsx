// Zusatzmodule — was NICHT im Grundtarif steckt, mit echtem Preis.
//
// Warum offen und nicht versteckt: Anbieter, die Module hinter „auf Anfrage"
// legen, erzeugen genau das Misstrauen, das eine Preisseite abbauen soll. Hier
// steht jedes Modul mit seinem Betrag — und wo es keinen festen Betrag gibt
// (Umsatzbeteiligung), steht der Prozentsatz statt einer erfundenen Zahl.
//
// Die Beträge kommen über `lookup_key` aus Stripe. Fehlt ein Preis (Modul noch
// nicht geseedet), entfällt die Karte — statt einen Platzhalter zu zeigen, den
// der Kunde für den Preis hält (Wurzel 4).
import { useLocale, useTranslations } from "next-intl";

import { SectionHeading } from "@/components/marketing/section-kit";
import { MODUL_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { formatCurrency } from "@/lib/currency";
import { modul, modulNachKey, type Preisliste } from "@/lib/preise";

// Reihenfolge = Verbreitung: Buchhaltung betrifft fast jeden Betrieb, die
// Hotel-Rezeption die wenigsten.
type Einheit = "proMonat" | "jeNutzer" | "jeZimmer" | "jeBetrieb";

const MODULE: readonly {
  key: string;
  /** Stripe-lookup_key des Preises, der GROSS steht. */
  lookup: string;
  /** Bezugsgröße dieses Preises. */
  einheit: Einheit;
  /** Zweiter, alternativer Preis (der Kunde wählt einen). */
  alternativ?: { lookup: string; einheit: Einheit };
  /**
   * Noch nicht verfügbar. Der Preis steht fest und wird gezeigt — was fehlt,
   * ist die Freigabe. Ohne diese Kennzeichnung verspräche die Preisseite drei
   * Module als sofort buchbar, die es noch nicht gibt; das ist genau die
   * plausibel aussehende Falschaussage, die niemand als Bug erkennt.
   */
  bald?: boolean;
}[] = [
  {
    key: "buchhaltung",
    lookup: "modul3_flat",
    einheit: "proMonat",
    bald: true,
  },
  {
    key: "mitarbeiter",
    lookup: "modul4_flat",
    einheit: "proMonat",
    alternativ: { lookup: "modul4_per_seat", einheit: "jeNutzer" },
    bald: true,
  },
  {
    // GROSS steht der Preis JE ZIMMER, nicht die Pauschale.
    //
    // Warum herum: die Pauschale (600 €) lohnt sich rechnerisch erst ab 400
    // Zimmern — als „ab 600 €/Monat" gelesen wirkt das Modul teurer als jedes
    // Hotel-PMS am Markt, obwohl der Zimmerpreis der günstigste davon ist
    // (Vergleich 18.08.2026, live abgelesen: Apaleo 8 € je Zimmer bei
    // Mindestpreis 400 €/Monat; Sirvoy Pro 109 €/Monat für EIN Haus mit 20
    // Zimmern — der Vergleich hier ist ein Hotel, nicht die 20 getrennten
    // Objekte der Vergleichstabelle, wo bei Sirvoy je weiteres Objekt das
    // Add-on „Multiple property connection" 20 €/Monat dazukommt
    // (content/wettbewerb.ts, nachrecherchiert 21.08.2026);
    // Little Hotelier ab 135 €/Monat; Cloudbeds, Mews, Hostaway und Hotelogix
    // veröffentlichen keine Preise). Ein Haus mit 20 Zimmern zahlt bei uns
    // 30 € — diese Zahl gehört nach vorn, die Pauschale daneben.
    key: "hotel",
    lookup: "modul6_per_room",
    einheit: "jeZimmer",
    alternativ: { lookup: "modul6_flat", einheit: "proMonat" },
    bald: true,
  },
  {
    // Je BETRIEB, nicht je Objekt: der Avatar hängt am Konto, nicht an einer
    // Unterkunft. Ohne diese Bezugsgröße im Label läse sich der Betrag als
    // Objektpreis und wäre bei zehn Objekten eine zehnfach falsche Erwartung.
    key: "avatar",
    lookup: "modul7_flat",
    einheit: "jeBetrieb",
    bald: true,
  },
];

export function PreisModule({ liste }: { liste: Preisliste | null }) {
  const t = useTranslations("preise.module");
  // „In Kürze" kommt aus features.baldBadge — derselbe Text steht schon auf der
  // Funktionsseite an den kommenden Modulen. Zwei Fassungen desselben Hinweises
  // in 24 Sprachen wären Doppelpflege.
  const tf = useTranslations("features");
  const locale = useLocale();

  if (!liste) return null;

  const betrag = (cent: number) => formatCurrency(cent / 100, liste.currency, locale);
  // Nutzungsabhängige Module: Prozentsatz statt Monatsbetrag. „Dynamische
  // Preise" liefert ihn mit (usage_percent), der Jobmarkt hat gar keinen
  // Stripe-Preis — er steht deshalb mit seinem Satz aus dem Text, nicht als
  // Betrag.
  const dynamisch = modulNachKey(liste, "dynamische_preise");

  return (
    <section className="bg-surface-warm">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} sub={t("sub")} />

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULE.map((m) => {
            const preis = modul(liste, m.lookup);
            if (!preis) return null;
            const alt = m.alternativ ? modul(liste, m.alternativ.lookup) : undefined;
            return (
              <article
                key={m.key}
                className="flex flex-col rounded-3xl border border-border bg-card p-7 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-16 items-center justify-center rounded-2xl bg-surface-accent text-accent">
                    {(() => {
                      const Illustration = MODUL_ILLUSTRATION[m.key];
                      return Illustration ? (
                        <Illustration className="size-11" />
                      ) : null;
                    })()}
                  </span>
                  {m.bald ? (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {tf("baldBadge")}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">
                  {t(`${m.key}Titel`)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`${m.key}Text`)}
                </p>
                <p className="mt-5 font-display text-2xl font-extrabold tabular-nums">
                  {betrag(preis.unit_amount)}
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">
                    {t(m.einheit)}
                  </span>
                </p>
                {alt && m.alternativ ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("oder")} {betrag(alt.unit_amount)} {t(m.alternativ.einheit)}
                  </p>
                ) : null}
              </article>
            );
          })}

          {/* Umsatzabhängig: kein Monatsbetrag, sondern ein Satz auf die
              Buchungen, die während der Buchung des Moduls entstehen. */}
          {dynamisch?.usage_percent != null ? (
            <article className="flex flex-col rounded-3xl border border-accent bg-surface-accent p-7 shadow-float">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-card text-accent">
                {(() => {
                  const Illustration = MODUL_ILLUSTRATION.dynamisch;
                  return Illustration ? <Illustration className="size-11" /> : null;
                })()}
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">
                {t("dynamischTitel")}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {t("dynamischText")}
              </p>
              <p className="mt-5 font-display text-2xl font-extrabold tabular-nums text-accent">
                {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
                  dynamisch.usage_percent,
                )}{" "}
                %
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t("vomUmsatz")}</p>
            </article>
          ) : null}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t("hinweis")}
        </p>
      </div>
    </section>
  );
}
