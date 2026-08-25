"use client";

// Marketing-Navbar — EINE Zeile: Logo links, Menü mittig, rechts Sprache,
// Anmelden und der CTA.
//
// Hostaway trennt Sprache/Login in eine eigene Utility-Zeile darüber; das war
// hier kurzzeitig übernommen und ist auf Wunsch zurückgebaut — alles gehört in
// den Header, keine zweite Leiste.
//
// FUNKTIONEN-MEGAMENÜ (Referenz-UX: hostaway.com/features und
// lodgify.com, beide am 18.08.2026 angesehen):
// Beide legen hinter den Menüpunkt „Funktionen" kein Sprungziel, sondern ein
// breites Panel: mehrere Spalten mit Überschrift + einer Zeile Beispielen je
// Eintrag, rechts abgesetzt eine farbige Karte, die zur Demo führt. Der Grund
// ist inhaltlich, nicht dekorativ — wer eine Vermietungssoftware sucht, sucht
// EINE bestimmte Funktion (Channel Manager? Eigentümer-Abrechnung?) und will
// sehen, ob es sie gibt, ohne die Seite zu lesen. Genau das leistet das Panel.
//
// Was hier bewusst anders ist: die Beispieltexte kommen aus `features.gruppen`
// — denselben Texten wie die Funktionssektion und die Preisseite. Ein eigener
// Satz Menütexte in 24 Sprachen wäre eine dritte Fassung derselben Aussage.
//
// MOBIL: bis eben hatte die Navigation auf schmalen Schirmen ÜBERHAUPT kein
// Menü — die Linkliste war schlicht `hidden md:flex`, ein Besucher am Telefon
// kam nur über Logo und CTA weiter. Jetzt öffnet ein Knopf ein Vollbild-Panel
// mit denselben Zielen.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { AppAufnahme } from "@/components/marketing/app-aufnahme";
import { Logo } from "@/components/logo";
import { GRUPPEN_ILLUSTRATION } from "@/components/preise/preis-illustrationen";
import { FUNKTIONEN } from "@/content/funktionen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
// Login und Registrierung der Gastgeber liegen in der web-App (Dashboard).
import { DEMO_URL, LOGIN_URL, SIGNUP_URL } from "@/lib/app-url";
import { gruppenStichworte } from "@/lib/gruppen-stichworte";

// Anker mit führendem "/" — sonst zeigen sie auf Unterseiten (z. B. /impressum)
// ins Nichts, weil die Abschnitte nur auf der Startseite existieren.
// „Preise" ist die Ausnahme: dahinter liegt eine echte Seite (/preise) mit
// Rechner, Provisionen und Vergleich — nicht mehr der Teaser-Anker.
const NAV_LINKS = [
  { key: "preise", href: "/preise" },
  { key: "kanaele", href: "/#kanaele" },
  // „Über uns" statt des früheren Ankers „Kunden": zum Start gibt es keine
  // Kundenstimmen, auf die der Sprung zeigen könnte — die Über-uns-Seite ist
  // das, was ein Interessent an dieser Stelle sucht.
  { key: "ueberUns", href: "/ueber-uns" },
  { key: "ressourcen", href: "/#ressourcen" },
] as const;

// Die neun Funktionsgruppen, in drei Spalten gruppiert — dieselbe Ordnung wie
// auf der Funktionsseite: erst das Kerngeschäft, dann Gast und Geld, dann
// Betrieb und Auswertung.
const MENU_SPALTEN: readonly {
  titel: "kern" | "gast" | "betrieb";
  gruppen: readonly string[];
}[] = [
  { titel: "kern", gruppen: ["pms", "channel", "direkt"] },
  { titel: "gast", gruppen: ["gaeste", "zahlungen", "preise"] },
  { titel: "betrieb", gruppen: ["team", "app", "auswertungen"] },
];

/**
 * `satzExtern`: der Provisionssatz für Direktbuchungen, vom Server formatiert.
 *
 * WARUM OPTIONAL — und warum das hier kein Schlupfloch ist:
 * Die Kopfzeile steht auf VIERZEHN Seiten, zwei davon sind selbst
 * `"use client"` (`/konto-loeschen`, `/konto-loeschen/bestaetigen`). Jeder
 * dieser Seiten eine Server-Hülle zu geben, nur damit die Stichwortzeile im
 * Megamenü eine Zahl trägt, wäre mehr Bauwerk als Nutzen: die Zeile steht dort
 * unter `line-clamp-2` und ist eine ZWEI-ZEILEN-Vorschau — der Satz ist das
 * letzte Glied einer Komma-Aufzählung und in der Regel längst abgeschnitten.
 *
 * Ohne den Wert erscheint deshalb das übersetzte Ersatzwort statt einer Zahl
 * (`gruppenStichworte`), nie ein geratener Satz und nie ein roher Platzhalter.
 * Die Seiten, auf denen die Zahl sichtbar zählt (Startseite, Preisseite,
 * Funktionsseiten), geben sie ausdrücklich mit.
 */
export function MarketingNav({
  satzExtern = null,
}: { satzExtern?: string | null } = {}) {
  const t = useTranslations("nav");
  const tf = useTranslations("features.gruppen");
  const [megaOffen, setMegaOffen] = useState(false);
  const [mobilOffen, setMobilOffen] = useState(false);
  const megaId = useId();
  // Schließ-Verzögerung: ohne sie klappt das Panel zu, während der Zeiger die
  // Lücke zwischen Menüpunkt und Panel überquert.
  const schliessZeit = useRef<ReturnType<typeof setTimeout> | null>(null);

  function oeffnen() {
    if (schliessZeit.current) clearTimeout(schliessZeit.current);
    setMegaOffen(true);
  }

  function spaeterSchliessen() {
    if (schliessZeit.current) clearTimeout(schliessZeit.current);
    schliessZeit.current = setTimeout(() => setMegaOffen(false), 140);
  }

  // Escape schließt beides — ein geöffnetes Panel, das nur per Zeiger wieder
  // zugeht, ist mit der Tastatur eine Sackgasse.
  useEffect(() => {
    function beiTaste(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMegaOffen(false);
        setMobilOffen(false);
      }
    }
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, []);

  // Solange das Mobil-Panel offen ist, darf die Seite darunter nicht scrollen.
  useEffect(() => {
    if (!mobilOffen) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = vorher;
    };
  }, [mobilOffen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center" onClick={() => setMobilOffen(false)}>
          <Logo heightRem={2.25} />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {/* „Funktionen" öffnet das Panel, statt zu einem Anker zu springen. */}
          <li
            className="relative"
            onMouseEnter={oeffnen}
            onMouseLeave={spaeterSchliessen}
          >
            <button
              type="button"
              aria-expanded={megaOffen}
              aria-controls={megaId}
              onClick={() => setMegaOffen((o) => !o)}
              onFocus={oeffnen}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-accent"
            >
              {t("funktionen")}
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className={`size-4 transition-transform duration-200 ${megaOffen ? "rotate-180" : ""}`}
              >
                <path
                  d="m6 9 6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </li>

          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium transition-colors hover:text-accent"
              >
                {t(link.key)}
              </a>
            </li>
          ))}
        </ul>

        {/* Rechte Gruppe. Unter `md` stehen hier NUR der kompakte
            Sprachwähler (Flagge) und der Mobil-Knopf. „Anmelden" und der CTA
            erscheinen erst ab `md` — genau ab der Breite, ab der auch die
            Linkliste sichtbar wird und der Mobil-Knopf verschwindet.

            Warum diese zwei mobil ganz weg sind und nicht bloß kleiner: der CTA ist
            in 24 Sprachen zwischen „Start gratis" (da) und deutlich längeren
            Fassungen breit. Bei 390 px ergaben Logo + CTA + Knopf zusammen
            452 px — die Seite scrollte quer und der Mobil-Knopf lag bei
            x = 412 KOMPLETT ausserhalb des Bildschirms. Auf dem Telefon war
            damit auf JEDER Seite dieser App überhaupt keine Navigation
            erreichbar. Eine Grenze, die von der Textlänge einer von 24
            Sprachen abhängt, ist keine Grenze; deshalb tragen alle drei
            Elemente dieselbe wie der Knopf.

            Verloren geht nichts: das Mobil-Panel darunter enthält beide
            Knöpfe, und der Hero trägt seinen eigenen CTA. Die Sprachwahl
            bleibt dagegen in der Leiste sichtbar (kompakte Variante) — sie
            kostet nur einen Kreis und ist der erste Griff eines Besuchers,
            dem die Seite in der falschen Sprache begegnet. */}
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <Link
            href={LOGIN_URL}
            className="hidden text-sm font-medium transition-colors hover:text-accent md:block"
          >
            {t("anmelden")}
          </Link>
          <Button asChild variant="accent" className="hidden md:inline-flex">
            <Link href={SIGNUP_URL}>{t("kostenlosStarten")}</Link>
          </Button>

          {/* Sprachwahl mobil: NEBEN dem Menü-Knopf, nicht nur im Panel
              darunter. Sie war bis eben ausschließlich hinter zwei Klicks
              (Menü öffnen → nach unten scrollen) erreichbar — bei einer Seite,
              die EU-weit in 24 Sprachen ausspielt, ist die Sprachwahl aber der
              erste Griff eines Besuchers, dem die Seite in der falschen
              Sprache begegnet.
              Kompakte Variante: nur die Flagge im gleichen Kreis wie der
              Menü-Knopf. Zwei Kreise à 2,5 rem plus Logo passen bei 390 px
              (Logo 8,4 rem + 2×2,5 rem + Abstände ≈ 15 rem von 24,4 rem). */}
          <div className="md:hidden">
            <LanguageSwitcher variante="kompakt" />
          </div>

          {/* Mobil-Knopf: erst ab hier gibt es auf schmalen Schirmen überhaupt
              eine Navigation. */}
          <button
            type="button"
            aria-expanded={mobilOffen}
            aria-label={mobilOffen ? t("menuSchliessen") : t("menuOeffnen")}
            onClick={() => setMobilOffen((o) => !o)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-accent md:hidden"
          >
            <Icon icon={mobilOffen ? "ph:x" : "ph:list"} className="size-5" />
          </button>
        </div>
      </nav>

      {/* --- Megamenü (Desktop) ------------------------------------------- */}
      <div
        id={megaId}
        onMouseEnter={oeffnen}
        onMouseLeave={spaeterSchliessen}
        className={`absolute inset-x-0 top-full hidden justify-center px-6 md:flex ${
          megaOffen ? "" : "pointer-events-none"
        }`}
      >
        <div
          className={`mt-3 w-full max-w-7xl origin-top rounded-3xl border border-border bg-card p-8 shadow-float-lg transition duration-200 ${
            megaOffen
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0"
          }`}
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr_1fr_17rem]">
            {MENU_SPALTEN.map((spalte) => (
              <div key={spalte.titel}>
                <p className="eyebrow">{t(`menuSpalte.${spalte.titel}`)}</p>
                <ul className="mt-5 flex flex-col gap-4">
                  {spalte.gruppen.map((key) => {
                    const Illustration = GRUPPEN_ILLUSTRATION[key];
                    return (
                      <li key={key}>
                        <Link
                          href={`/funktionen/${FUNKTIONEN.find((f) => f.key === key)?.slug ?? ""}`}
                          onClick={() => setMegaOffen(false)}
                          className="group flex items-start gap-4 rounded-2xl p-3 transition-colors hover:bg-surface-warm"
                        >
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-accent text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                            {Illustration ? (
                              <Illustration className="size-8" />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-sm font-semibold transition-colors group-hover:text-accent">
                              {tf(`${key}.title`)}
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden
                                className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                              >
                                <path
                                  d="M5 12h14m-6-6 6 6-6 6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                            {/* Nur zwei Zeilen Beispiele, wie bei der Referenz:
                                `line-clamp-2` MUSS ohne zusätzliches `block`
                                stehen — sonst überschreibt die Display-Klasse
                                die Klemmung und die Spalte wird zur Textwand
                                (genau das war hier zu sehen). */}
                            <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {gruppenStichworte(tf, key, satzExtern)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {/* Abgesetzte Karte rechts: bei beiden Referenzen der Platz für den
                stärksten Handlungsaufruf — dort mit Bild. Bei Lodgify ist es
                ein Stimmungsfoto; hier steht stattdessen eine ECHTE Aufnahme
                der Software (aus `web/scripts/marketing-aufnahmen.mjs`), weil
                der Knopf daneben genau das verspricht: die Anwendung ansehen.
                Ein Stimmungsbild an dieser Stelle wäre Dekoration, die Aufnahme
                ist das Argument. */}
            <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-primary text-primary-foreground">
              <div className="relative h-44 overflow-hidden">
                <AppAufnahme
                  name="belegungsplan"
                  alt={t("menuBildAlt")}
                  className="absolute left-1/2 top-0 w-[190%] max-w-none -translate-x-1/2"
                />
                {/* Weicher Verlauf nach unten, damit die Kante der Aufnahme
                    nicht als harter Schnitt im Panel steht. */}
                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-primary"
                />
              </div>
              <div className="px-6 pt-2">
                <p className="font-display text-lg font-semibold leading-tight">
                  {t("menuCtaTitel")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">
                  {t("menuCtaText")}
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-2 px-6 pb-6">
                <Button asChild variant="accent" className="w-full">
                  <Link href={DEMO_URL} onClick={() => setMegaOffen(false)}>
                    {t("menuCtaKnopf")}
                  </Link>
                </Button>
                <Link
                  href="/funktionen"
                  onClick={() => setMegaOffen(false)}
                  className="text-center text-sm font-medium text-primary-foreground/80 underline-offset-4 hover:underline"
                >
                  {t("preise")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

    </header>

      {/* --- Mobiles Panel -----------------------------------------------
          BEWUSST AUSSERHALB des <header>: dessen `backdrop-blur` erzeugt einen
          Containing Block, an dem sich `position: fixed` ausrichtet. Innerhalb
          des Headers stand das Panel deshalb nicht über dem Bildschirm, sondern
          in der 72 px hohen Kopfzeile — sichtbar war ein 64 px hoher Streifen
          mit „Funktionen" und sonst nichts. */}
    {mobilOffen ? (
      <div className="fixed inset-x-0 bottom-0 top-18 z-40 overflow-y-auto bg-background px-6 pb-10 pt-6 md:hidden">
        <ul className="flex flex-col gap-1">
          <li>
            <Link
              href="/funktionen"
              onClick={() => setMobilOffen(false)}
              className="block rounded-2xl px-4 py-3.5 font-display text-lg font-semibold"
            >
              {t("funktionen")}
            </Link>
          {/* Die Gruppen direkt darunter: ein zweites Aufklappen wäre auf
                dem Telefon ein Klick zu viel. */}
            <ul className="mb-2 ml-4 flex flex-col gap-1 border-l border-border pl-4">
              {MENU_SPALTEN.flatMap((s) => s.gruppen).map((key) => (
                <li key={key}>
                  <Link
                    href={`/funktionen/${FUNKTIONEN.find((f) => f.key === key)?.slug ?? ""}`}
                    onClick={() => setMobilOffen(false)}
                    className="block py-2 text-sm text-muted-foreground"
                  >
                    {tf(`${key}.title`)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setMobilOffen(false)}
                className="block rounded-2xl px-4 py-3.5 font-display text-lg font-semibold"
              >
                {t(link.key)}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
          <Button asChild variant="accent" size="lg">
            <Link href={SIGNUP_URL} onClick={() => setMobilOffen(false)}>
              {t("kostenlosStarten")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={LOGIN_URL} onClick={() => setMobilOffen(false)}>
              {t("anmelden")}
            </Link>
          </Button>
          {/* Die Sprachwahl steht jetzt in der Kopfzeile selbst (kompakte
              Variante) und ist deshalb hier NICHT nochmal aufgeführt: zwei
              Auslöser für dasselbe Modal auf einem Schirm — einer sichtbar,
              einer hinter dem Panel-Scroll — lesen sich wie zwei verschiedene
              Einstellungen. */}
        </div>
      </div>
    ) : null}
    </>
  );
}
