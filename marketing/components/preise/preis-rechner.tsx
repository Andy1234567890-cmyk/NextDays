"use client";

// Der Preisrechner — Steuerleiste (dunkel) + Preiskarte (hell) + Inklusivliste.
//
// WARUM EIN ZÄHLER UND KEINE PAKET-SPALTEN:
// Lodgify, Smoobu & Co. zeigen drei bis vier Tarifkarten, weil ihr Funktions-
// umfang paketiert ist (bei Lodgify stecken Aufgaben und Eigentümer-Reporting
// erst im teuersten Tarif). myNextDays hat GENAU EINEN Tarif mit vollem
// Umfang; die einzige Variable ist die Objektzahl. Vier Karten mit demselben
// Inhalt wären eine Attrappe — also übernehmen wir von der Referenz nur die
// gute Mechanik (Steuerleiste oben, Preis rechnet live mit).
//
// Was bei der Referenz auffiel und hier vermieden ist: stellt man dort die
// Objektzahl hoch, werden die kleinen Tarife ausgegraut und ihr Preis
// unleserlich geschwärzt — der Besucher sieht erst nach dem Klick, dass sein
// Fall nicht passt. Hier gilt jede Zahl, der Preis bleibt immer lesbar.
//
// WARUM DIE KARTE AUF DER KANTE LIEGT:
// Die erste Fassung stellte Preis und Funktionsliste nebeneinander auf helle
// Fläche — die Seite wirkte flach und die Zahl ging neben neun Textabsätzen
// unter. Jetzt trägt eine dunkle Fläche Überschrift und Steuerung, und die
// weiße Preiskarte ragt mit ihrem Schatten in diese Kante hinein. Der Preis
// ist damit der einzige Blickfang, und die Seite bekommt den Kontrast, den
// eine Preisseite braucht.
//
// Alle Beträge kommen aus Stripe (lib/preise.ts), die Staffel-Arithmetik aus
// der Schwesterdatei lib/tarif.ts — hier wird nichts hardcodiert (Wurzel 4).
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { GRUPPEN_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { Icon } from "@/components/ui/icon";
import { ereignisMelden } from "@/lib/analytics";
import { DEMO_URL, SIGNUP_URL } from "@/lib/app-url";
import { formatCurrency } from "@/lib/currency";
import { gruppenStichworte } from "@/lib/gruppen-stichworte";
import type { Preisliste } from "@/lib/preise";
import { staffelPosten, staffelPreisCent } from "@/lib/tarif";

// Obergrenze des Zählers. Darüber ist der Preis je Objekt konstant (letzte
// Stufe), eine höhere Zahl brächte keine neue Information.
const MAX_OBJEKTE = 250;

// Sprungmarken: die typischen Größenordnungen unserer Zielgruppe — ein Objekt,
// Kleinvermieter, Agentur, Hotel. Ein Klick statt 99-mal Plus.
const SPRUNGMARKEN = [1, 5, 20, 50, 100] as const;

// Was im Tarif enthalten ist: die ZEHN Funktionsgruppen aus `features.gruppen`.
// Bewusst dieselben Texte wie auf der Startseite — eine zweite, eigene Liste
// würde beim nächsten Feature auseinanderlaufen, und dann verspricht die
// Preisseite etwas anderes als die Funktionsseite. Die Zeichnungen liegen in
// `preis-illustrationen.tsx`.
const GRUPPEN = [
  "pms",
  "channel",
  "direkt",
  "preise",
  "gaeste",
  "ki",
  "zahlungen",
  "team",
  "app",
  "auswertungen",
] as const;

export function PreisRechner({ liste }: { liste: Preisliste | null }) {
  const t = useTranslations("preise.rechner");
  // Beträge in der Sprache des Besuchers formatieren — 1.234,56 € in
  // Deutschland, 1 234,56 € in Frankreich. Ein festes "de-DE" hätte 23
  // Sprachfassungen mit deutscher Zahlenschreibweise ausgeliefert.
  const locale = useLocale();
  const [anzahl, setAnzahl] = useState(1);
  const zaehlerId = useId();

  // Die Objektzahl lässt sich auf VIER Wegen ändern (Minus, Plus, Zahlenfeld,
  // Sprungmarken). Gemeldet wird deshalb der ZUSTAND, nicht jeder einzelne
  // Knopf — sonst fehlt die Meldung beim fünften Weg, den jemand später
  // ergänzt. Die Drossel dazu sitzt in lib/analytics.ts (600 ms), hier steht
  // bewusst keine zweite.
  //
  // Der Merker hält den zuletzt GEMELDETEN Wert und nicht bloß „schon
  // gerendert": das erste Rendern ist keine Handlung, und ein Sprachwechsel
  // lässt diesen Effekt erneut laufen (`locale` ist eine Abhängigkeit), ohne
  // dass der Besucher etwas verstellt hätte.
  const gemeldeteAnzahl = useRef<number | null>(null);
  useEffect(() => {
    if (gemeldeteAnzahl.current === anzahl) return;
    const ersterLauf = gemeldeteAnzahl.current === null;
    gemeldeteAnzahl.current = anzahl;
    if (ersterLauf) return;
    // Als ZAHL, nicht als Zeichenkette: nur aus einem Zahlenparameter kann
    // GA4 eine Metrik machen (Summe, Mittelwert). Als Text wäre „25" nur eine
    // weitere Ausprägung neben „5".
    ereignisMelden("preis_geaendert", { anzahl }, locale);
  }, [anzahl, locale]);

  const posten = useMemo(
    () => (liste ? staffelPosten(liste.grundtarif_tiers, anzahl) : []),
    [liste, anzahl],
  );
  const monatlichCent = useMemo(
    () => (liste ? staffelPreisCent(liste.grundtarif_tiers, anzahl) : null),
    [liste, anzahl],
  );

  const waehrung = liste?.currency ?? null;
  // Durchschnitt je Objekt — das eigentliche Argument der degressiven Staffel:
  // bei 50 Objekten kostet ein Objekt weniger als die Hälfte des Einstiegs.
  const schnittCent = monatlichCent === null ? null : monatlichCent / anzahl;

  return (
    <>
      {/* Steuerleiste auf der dunklen Fläche.
          Referenz-UX (lodgify.com/de/preise, abgelesen 18.08.2026): eine
          einzige stark gerundete Pille (Radius 56 px, 12 px Innenabstand) mit
          Segment-Schaltern statt Schieberegler, als Glasfläche auf dunklem
          Grund. Genau das ist hier übernommen; ein Schieberegler auf heller
          Fläche (unsere erste Fassung) war fast unsichtbar. */}
      <div className="mt-10 flex justify-center">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-[3rem] bg-primary-foreground/10 p-3 backdrop-blur sm:gap-3">
          <span className="pl-3 text-sm font-medium text-primary-foreground/70">
            {t("objekte")}
          </span>

          {/* Zähler: die Zahl ist tippbar — wer 37 Objekte hat, soll sie
              eingeben und nicht 36-mal klicken. */}
          <div className="flex items-center gap-1 rounded-full bg-primary-foreground/10 p-1">
            <button
              type="button"
              onClick={() => setAnzahl((n) => Math.max(1, n - 1))}
              disabled={anzahl <= 1}
              aria-label={t("wenigerLabel")}
              className="inline-flex size-9 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground/20 disabled:opacity-30"
            >
              <Icon icon="ph:minus" className="size-4" />
            </button>
            <input
              id={zaehlerId}
              type="number"
              min={1}
              max={MAX_OBJEKTE}
              value={anzahl}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) {
                  setAnzahl(Math.min(MAX_OBJEKTE, Math.max(1, Math.trunc(n))));
                }
              }}
              aria-label={t("reglerLabel")}
              // Native Spinner-Pfeile aus: dafür sind die beiden Knöpfe da,
              // zwei Bedienelemente fürs Selbe verwirren nur.
              className="w-14 bg-transparent text-center font-display text-xl font-extrabold tabular-nums text-primary-foreground outline-none [appearance:textfield] focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setAnzahl((n) => Math.min(MAX_OBJEKTE, n + 1))}
              disabled={anzahl >= MAX_OBJEKTE}
              aria-label={t("mehrLabel")}
              className="inline-flex size-9 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-primary-foreground/20 disabled:opacity-30"
            >
              <Icon icon="ph:plus" className="size-4" />
            </button>
          </div>

          {/* Sprungmarken als Segment-Schalter: ein Klick auf die eigene
              Größenordnung statt Tippen. */}
          <div className="flex items-center gap-1 rounded-full bg-primary-foreground/10 p-1">
            {SPRUNGMARKEN.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAnzahl(n)}
                aria-pressed={anzahl === n}
                className={`min-w-11 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
                  anzahl === n
                    ? "bg-accent text-accent-foreground"
                    : "text-primary-foreground/80 hover:bg-primary-foreground/20"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Die Preiskarte ragt in die Kante der dunklen Fläche hinein
          (negativer unterer Außenabstand + eigener Stapelkontext). */}
      {/* `text-foreground` ist hier PFLICHT, nicht Kosmetik: die Karte liegt in
          der dunklen Hero-Sektion und erbte sonst deren weiße Schrift — Beträge
          und der zweite Knopf standen weiß auf weiß und waren unsichtbar. */}
      <div className="relative z-10 mx-auto -mb-24 mt-12 sm:-mb-32 w-full max-w-2xl text-foreground">
        {liste && monatlichCent !== null && schnittCent !== null && waehrung ? (
          <div className="rounded-[2rem] border border-border bg-card p-8 text-center shadow-float-lg sm:p-10">
            <p className="eyebrow">{t("einTarif")}</p>

            <p className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3">
              <span className="font-display text-6xl font-extrabold leading-none tracking-tight tabular-nums text-accent sm:text-7xl">
                {formatCurrency(monatlichCent / 100, waehrung, locale)}
              </span>
              <span className="text-lg font-semibold text-muted-foreground">
                {t("proMonat")}
              </span>
            </p>

            {/* Bei einem Objekt wäre „das sind X je Objekt" dieselbe Zahl noch
                einmal — die Zeile erscheint erst, wenn sie etwas aussagt. */}
            {anzahl > 1 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("schnitt", {
                  betrag: formatCurrency(schnittCent / 100, waehrung, locale),
                })}
              </p>
            ) : null}

            {/* Ein Fakt direkt unter dem Preis — bei der Referenz steht dort
                „0% Buchungsgebühr". Bei uns ist die eigene Website
                provisionsfrei; die übrigen Sätze stehen eine Sektion weiter. */}
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-accent px-4 py-2 text-sm font-semibold">
              <Icon icon="ph:check-circle-fill" className="size-4 text-accent" />
              {t("direktfrei")}
            </p>

            {/* Die Rechnung offen hinlegen: welche Stufe greift mit wie vielen
                Objekten. Ohne das ist ein Staffelpreis eine Behauptung. */}
            <ul className="mt-8 flex flex-col gap-2.5 border-t border-border pt-6 text-left text-sm">
              {posten.map((p, i) => (
                <li
                  key={`${p.art}-${i}`}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span className="text-muted-foreground">
                    {p.art === "grundgebuehr"
                      ? t("grundgebuehr")
                      : t("weitereObjekte", {
                          anzahl: p.anzahl,
                          jeObjekt: formatCurrency(
                            p.jeObjektCent / 100,
                            waehrung,
                            locale,
                          ),
                        })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(p.cent / 100, waehrung, locale)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="accent" size="lg" className="w-full">
                <Link href={SIGNUP_URL} data-cta="signup">
                  {t("ctaTesten")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href={DEMO_URL} data-cta="demo">
                  {t("ctaDemo")}
                </Link>
              </Button>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">{t("netto")}</p>
          </div>
        ) : (
          // Ohne Preisliste erscheint KEINE Zahl — der Besucher erfährt
          // stattdessen, dass die Preise gerade nicht abrufbar sind
          // (Wurzel 4: kein Ersatzwert).
          <div className="rounded-[2rem] border border-border bg-card p-10 text-center shadow-float-lg">
            <h2 className="font-display text-xl font-semibold">
              {t("nichtAbrufbar")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("nichtAbrufbarText")}</p>
            <Button asChild variant="accent" size="lg" className="mt-6">
              <Link href={SIGNUP_URL} data-cta="signup">
                {t("ctaTesten")}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * „Alles enthalten" als eigene Sektion unter der Preiskarte.
 *
 * Stand zuerst als getönter Block NEBEN der Karte: neun Textabsätze in einer
 * Fläche, die höher war als die Karte selbst — die Zahl ging daneben unter.
 * Als eigene, dreispaltige Sektion liest sie sich ruhig und lässt dem Preis
 * seinen Auftritt.
 */
export function PreisInklusive({ satzExtern }: { satzExtern: string | null }) {
  const t = useTranslations("preise.rechner");
  const tf = useTranslations("features.gruppen");

  return (
    <section className="bg-background">
      {/* Der obere Abstand hält die Fläche frei, in die die Preiskarte ragt. */}
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-28 sm:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("inklusivTitel")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("inklusivSub")}</p>
        </div>

        {/* Karten mit gezeichneter Szene statt Icon-Zeile: auf einer Seite,
            die den vollen Umfang beweisen soll, wirkte die Glyphen-Liste wie
            Kleingedrucktes. */}
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GRUPPEN.map((key) => {
            const Illustration = GRUPPEN_ILLUSTRATION[key];
            return (
              <li
                key={key}
                className="flex flex-col rounded-3xl border border-border bg-card p-7 shadow-card transition-shadow hover:shadow-float"
              >
                <span className="flex size-20 items-center justify-center rounded-2xl bg-surface-accent text-accent">
                  {Illustration ? <Illustration className="size-14" /> : null}
                </span>
                <p className="mt-6 font-display text-lg font-semibold leading-tight">
                  {tf(`${key}.title`)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {gruppenStichworte(tf, key, satzExtern)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
