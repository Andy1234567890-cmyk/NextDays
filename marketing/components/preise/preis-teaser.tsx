// Preis-Teaser der Startseite — die Brücke zur Preisseite.
//
// Vorher stand hier eine Karte mit fest eingetragenen Beträgen („19,90 €",
// „+6/5/4 €", „0,5 % · 8 %") — und zwar in ALLEN 24 Sprachdateien. Das ist
// genau die Doppelquelle, die Wurzel 4 verbietet: beim ersten Preiswechsel
// hätte die Startseite 24-mal etwas anderes behauptet als die Abrechnung.
// Jetzt kommen dieselben Zahlen aus derselben Quelle wie die Preisseite.
//
// Die Karte zeigt bewusst nur den EINSTIEG (Grundgebühr inkl. erstem Objekt)
// und den günstigsten Objektpreis der letzten Staffelstufe — die vollständige
// Rechnung gehört auf /preise, nicht in einen Teaser.
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { formatProzent, holePreisliste } from "@/lib/preise";
import { staffelPreisCent } from "@/lib/tarif";

export async function PreisTeaser({ locale }: { locale: string }) {
  const t = await getTranslations("benefits.preisBanner");
  const tp = await getTranslations("preise.teaser");
  const liste = await holePreisliste();

  const einstiegCent = liste ? staffelPreisCent(liste.grundtarif_tiers, 1) : null;
  // Günstigster Objektpreis = letzte Stufe der Staffel. Sie ist die unbegrenzte
  // („ab 101 Objekten"), deshalb `up_to === null`; fehlt sie, wird nichts
  // behauptet.
  const guenstigsteStufe = liste?.grundtarif_tiers.find(
    (stufe) => stufe.up_to === null && stufe.unit_amount != null,
  );

  return (
    <section id="preise" className="scroll-mt-24 bg-surface-warm pb-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-10 rounded-3xl border border-border bg-card px-8 py-10 shadow-soft lg:grid-cols-[1.6fr_1fr] lg:px-12">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h3 className="mt-4 font-display text-2xl font-semibold leading-tight sm:text-3xl">
              {t("heading")}
            </h3>
            <p className="mt-4 text-muted-foreground">{t("text")}</p>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface-accent p-6">
            {liste && einstiegCent !== null ? (
              <>
                <p className="whitespace-nowrap">
                  <span className="font-display text-4xl font-semibold tabular-nums text-accent">
                    {formatCurrency(einstiegCent / 100, liste.currency, locale)}
                  </span>
                  <span className="ml-1.5 text-base font-semibold">
                    {t("proMonat")}
                  </span>
                </p>
                <p className="text-sm font-medium">{tp("tarif")}</p>
                {guenstigsteStufe?.unit_amount != null ? (
                  <p className="text-sm text-muted-foreground">
                    {tp("abObjekt", {
                      betrag: formatCurrency(
                        guenstigsteStufe.unit_amount / 100,
                        liste.currency,
                        locale,
                      ),
                    })}
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {tp("provision", {
                    direkt: "0 %",
                    portale: formatProzent(
                      liste.commission_external_percent,
                      locale,
                    ),
                  })}
                </p>
              </>
            ) : (
              // Ohne Preisliste bleibt die Karte ohne Zahl — der Weg zur
              // Preisseite bleibt trotzdem offen.
              <p className="text-sm font-medium">{tp("tarif")}</p>
            )}

            <Button asChild variant="accent" className="mt-4 w-full">
              <Link href="/preise">{tp("cta")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
