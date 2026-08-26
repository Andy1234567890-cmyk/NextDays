// Preis-Teaser der Startseite — die Brücke zur Preisseite.
//
// Vorher stand hier eine Karte mit fest eingetragenen Beträgen („19,90 €",
// „+6/5/4 €", „0,5 % · 8 %") — und zwar in ALLEN 24 Sprachdateien. Das ist
// genau die Doppelquelle, die Wurzel 4 verbietet: beim ersten Preiswechsel
// hätte die Startseite 24-mal etwas anderes behauptet als die Abrechnung.
// Jetzt kommen dieselben Zahlen aus derselben Quelle wie die Preisseite.
//
// Die Karte zeigt bewusst nur den EINSTIEG (Grundgebühr inkl. erstem Objekt)
// und den Preis des NÄCHSTEN Objekts — die vollständige Rechnung gehört auf
// /preise, nicht in einen Teaser.
//
// Warum die zweite Stufe und nicht die günstigste (26.08.2026): dort stand
// „Jedes weitere Objekt ab 4,00 €". Das ist der Preis ab dem 101. Objekt — für
// den Leser mit drei Ferienwohnungen also eine Zahl, die er nie zahlt, und beim
// Blick auf die Rechnung eine Enttäuschung. Genannt wird jetzt, was das zweite
// Objekt WIRKLICH kostet (6,00 €), plus der Hinweis, ab welchem Objekt es
// günstiger wird. Beide Werte kommen aus der Staffel, keiner ist getippt.
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { anzeigewaehrung } from "@/lib/anzeigewaehrung";
import { formatCurrency } from "@/lib/currency";
import { formatProzent, holePreisliste } from "@/lib/preise";
import { staffelPreisCent } from "@/lib/tarif";

export async function PreisTeaser({ locale }: { locale: string }) {
  const t = await getTranslations("benefits.preisBanner");
  const tp = await getTranslations("preise.teaser");
  // Preise in der Währung der gewählten Sprache (lib/anzeigewaehrung). Was
  // wirklich kommt, sagt `liste.currency` — und genau damit wird unten
  // formatiert, nie mit einer Annahme.
  const liste = await holePreisliste(anzeigewaehrung(locale));

  const einstiegCent = liste ? staffelPreisCent(liste.grundtarif_tiers, 1) : null;
  // Die erste Stufe MIT Objektpreis: sie gilt ab dem zweiten Objekt (die erste
  // Stufe ist die Grundgebühr für das erste). Fehlt sie, wird nichts behauptet.
  const stufen = liste?.grundtarif_tiers ?? [];
  const naechsteStufeIndex = stufen.findIndex(
    (stufe) => stufe.unit_amount != null,
  );
  const naechsteStufe =
    naechsteStufeIndex >= 0 ? stufen[naechsteStufeIndex] : undefined;
  // Ab welchem Objekt es günstiger wird = Obergrenze dieser Stufe + 1 — und nur,
  // wenn danach überhaupt eine billigere Stufe kommt. Ohne diese Prüfung
  // verspräche der Satz eine Vergünstigung, die es nicht gibt.
  const naechstBilligere = stufen
    .slice(naechsteStufeIndex + 1)
    .find(
      (stufe) =>
        stufe.unit_amount != null &&
        naechsteStufe?.unit_amount != null &&
        stufe.unit_amount < naechsteStufe.unit_amount,
    );
  const abObjekt =
    naechstBilligere && naechsteStufe?.up_to != null
      ? naechsteStufe.up_to + 1
      : null;

  return (
    <section id="preise" className="scroll-mt-24 bg-surface-warm pb-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* `min-w-0` an Raster UND Zellen: Grid-Spalten sind sonst mindestens
            so breit wie ihr breitester unteilbarer Inhalt (`min-width: auto`).
            Auf Dänisch schob die Preiszelle das Raster bei 320 px auf 336 px
            und die Seite scrollte quer. Mobil zudem weniger Innenabstand —
            64 px Polster von 320 px sind ein Fünftel des Bildschirms. */}
        <div className="grid min-w-0 items-center gap-10 rounded-3xl border border-border bg-card px-6 py-10 shadow-soft sm:px-8 lg:grid-cols-[1.6fr_1fr] lg:px-12">
          <div className="min-w-0">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h3 className="mt-4 font-display text-2xl font-semibold leading-tight sm:text-3xl">
              {t("heading")}
            </h3>
            <p className="mt-4 text-muted-foreground">{t("text")}</p>
          </div>

          <div className="flex min-w-0 flex-col items-start gap-2 rounded-2xl bg-surface-accent p-5 sm:p-6">
            {liste && einstiegCent !== null ? (
              <>
                {/* Betrag und Zeiteinheit dürfen umbrechen — „19,90 €" bleibt
                    durch das eigene <span> in sich zusammen. Ein
                    `whitespace-nowrap` über die ganze Zeile machte die Zelle
                    unteilbar und damit breiter als der Bildschirm. */}
                <p>
                  <span className="font-display text-4xl font-semibold tabular-nums text-accent">
                    {formatCurrency(einstiegCent / 100, liste.currency, locale)}
                  </span>
                  <span className="ml-1.5 text-base font-semibold">
                    {t("proMonat")}
                  </span>
                </p>
                <p className="text-sm font-medium">{tp("tarif")}</p>
                {naechsteStufe?.unit_amount != null ? (
                  <p className="text-sm text-muted-foreground">
                    {tp(abObjekt !== null ? "abObjektStaffel" : "abObjekt", {
                      betrag: formatCurrency(
                        naechsteStufe.unit_amount / 100,
                        liste.currency,
                        locale,
                      ),
                      ab: abObjekt ?? "",
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
