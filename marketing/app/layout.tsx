// Root-Layout der Marketing-App: Schriften (lokal), globale Styles und
// next-intl-Provider. Die Sprache kommt aus dem nd_locale-Cookie
// (i18n/request.ts) und landet auch im lang-Attribut des <html>.
import { NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import localFont from "next/font/local";

import "./globals.css";

import { EinwilligungsDienste } from "@/components/einwilligungs-dienste";
import { GoogleTag } from "@/components/google-tag";
import { EinwilligungsKnopf } from "@/components/einwilligung/einwilligungs-knopf";
import { EinwilligungsLeiste } from "@/components/einwilligung/einwilligungs-leiste";
import { SupportChat } from "@/components/support-chat";
import { VoranmeldungPopup } from "@/components/voranmeldung-popup";
import { anzeigewaehrung } from "@/lib/anzeigewaehrung";
import { formatCurrency } from "@/lib/currency";
import { holePreisliste } from "@/lib/preise";
import {
  FACEBOOK_DOMAIN_VERIFICATION,
  GOOGLE_SITE_VERIFICATION,
} from "@/lib/site-verification";
import { SITE_URL } from "@/lib/site-url";
import { staffelPreisCent } from "@/lib/tarif";

import type { Metadata } from "next";

// Schriften liegen LOKAL im Repo (marketing/fonts/) — kein Google-Download,
// garantiert verfügbar, DSGVO-konform. Beide sind SIL-OFL-lizenziert.
// Inter = UI/Text, Fraunces = Display/Überschriften.
const inter = localFont({
  src: "../fonts/Inter.ttf",
  variable: "--font-inter",
  display: "swap",
});

const fraunces = localFont({
  src: "../fonts/Fraunces.ttf",
  variable: "--font-fraunces",
  display: "swap",
});

// Die Meta-Beschreibung ist das, was Google als Snippet zeigt — und sie nennt
// den Einstiegspreis. Der Betrag stand dafür bis 24.08.2026 im Klartext in
// ALLEN 24 Sprachdateien: 24 Kopien einer Zahl, die in Stripe steht (Wurzel 4).
// Zwei Folgen, beide real: beim nächsten Preiswechsel bewirbt das Snippet einen
// Preis, den die Abrechnung nicht kennt — und seit die Seite ihre Preise in der
// Währung der Sprache zeigt (lib/anzeigewaehrung), las ein dänischer Besucher
// im Snippet „19,90 €", während auf der Seite „149,00 kr." stand.
//
// Jetzt kommt der Betrag aus derselben Quelle wie die Preisseite und der
// Startseiten-Teaser: `holePreisliste(anzeigewaehrung(locale))`. Dieselbe URL,
// dasselbe Währungs-Argument — Next dedupliziert den Fetch im Request, es
// entsteht also KEINE zweite Anfrage je Seitenaufruf.
//
// Ohne Preisliste (Endpunkt weg, Stripe weg) wird die preislose `description`
// ausgeliefert. Kein Ersatzbetrag und kein leeres `{preis}`: ein Snippet, das
// „Ab /Monat" sagt, ist schlimmer als eines ohne Preis.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  const liste = await holePreisliste(anzeigewaehrung(locale));
  // Einstiegspreis = Staffel für EIN Objekt, genau wie im Preis-Teaser und im
  // Rechner. Formatiert wird mit `liste.currency` — der Währung, die das
  // Backend wirklich geliefert hat, nicht mit der angefragten.
  const einstiegCent = liste ? staffelPreisCent(liste.grundtarif_tiers, 1) : null;

  return {
    // `metadataBase` macht relative Metadaten-Pfade absolut (Open-Graph-Bilder,
    // kanonische Links). Ohne sie warnt Next beim Bauen und setzt localhost ein —
    // eine Vorschau-Karte auf einer fremden Plattform zeigte dann ins Nichts.
    metadataBase: new URL(SITE_URL),
    // Eigentumsnachweis für die Google Search Console. Er steht hier im
    // Root-Layout und NICHT je Seite: Next mischt Metadaten flach von der
    // Wurzel zur Seite, und keine Unterseite definiert `verification` — der
    // Nachweis erbt sich damit auf JEDE Route, auch auf die Rechtsseiten
    // (/cookie-richtlinie, /datenschutz, /impressum, /agb,
    // /auftragsverarbeitung), die ihre eigene `generateMetadata` nur für
    // Titel und Beschreibung nutzen. Eine zweite Kopie je Rechtsseite wäre
    // derselbe Wert an sechs Stellen (Wurzel 4) und würde beim nächsten
    // Wechsel auseinanderlaufen.
    // `other` traegt jeden Nachweis, fuer den Next kein eigenes Feld hat —
    // hier den von Meta. Er erbt sich aus demselben Grund wie der von Google
    // auf JEDE Route: Next mischt Metadaten flach von der Wurzel zur Seite.
    verification: {
      google: GOOGLE_SITE_VERIFICATION,
      other: { "facebook-domain-verification": FACEBOOK_DOMAIN_VERIFICATION },
    },
    title: t("title"),
    description:
      liste && einstiegCent !== null
        ? t("descriptionMitPreis", {
            preis: formatCurrency(einstiegCent / 100, liste.currency, locale),
          })
        : t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      {/* Das Google-Tag im Einwilligungsmodus. Es MUSS vor allem anderen
          stehen: sein erstes Skript setzt die Vorgabe „alles verweigert", und
          Google schreibt dazu, dass die Reihenfolge entscheidend ist — kommt
          die Vorgabe nach dem Tag, gilt sie nicht. Genau diese Zusage kann
          `next/script` nicht geben, deshalb ist dieses erste Skript ein ROHES
          `<script>` (Messung vom 27.08.2026 in components/google-tag.tsx).

          WARUM DAS `<head>` HIER STEHT: ein rohes `<script>` als direktes Kind
          von `<html>` ist ungültige Verschachtelung. React meldete dafür bis
          zum 29.08.2026 auf JEDER Seite „In HTML, <script> cannot be a child
          of <html>. This will cause a hydration error." — und ein
          Hydrations-Fehler an der Wurzel ist hier nicht kosmetisch: React darf
          den Baum verwerfen und neu aufbauen, und in genau diesem Baum hängen
          die Einwilligungsleiste und die Zählkomponente.

          Next verbietet nicht das `<head>`-ELEMENT, sondern nur das Schreiben
          von Kopf-TAGS wie `<title>`/`<meta>` von Hand („You should not
          manually add <head> tags such as <title> and <meta> to root layouts",
          nextjs.org/docs/app/api-reference/file-conventions/layout). Die
          bleiben in `generateMetadata` oben; Next hängt sie zusammen mit seinen
          eigenen Kopf-Elementen in dieses `<head>`. Die beiden
          `afterInteractive`-Skripte des Tags fügt Next ohnehin erst nach der
          Hydration ein — ihre Position im Baum ändert daran nichts.
          Begründung und Datenschutz-Abwägung in components/google-tag.tsx. */}
      <head>
        <GoogleTag />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          {/* Auf JEDER Seite erreichbar, auch in den Rechtsdokumenten. */}
          <SupportChat />
          {/* Fängt vor dem Start die Klicks auf „Anmelden"/„Kostenlos starten"
              ab und sammelt stattdessen Voranmeldungen. */}
          <VoranmeldungPopup />
          {/* Einwilligung: erscheint einmal, solange nichts entschieden ist.
              Sie schaltet den externen Spamschutz des Kontaktformulars — der
              einzige Drittanbieter, den diese App im Browser lädt
              (lib/einwilligung.ts). Widerruf auf /cookie-richtlinie. */}
          <EinwilligungsLeiste />
          {/* Cookie-Symbol unten links: der dauerhafte Weg zurück zur
              Einwilligung (Art. 7 Abs. 3 DSGVO). Es erscheint erst, wenn
              eine Entscheidung vorliegt — vorher steht die Leiste da. */}
          <EinwilligungsKnopf />
          {/* Hält Messung UND Spamschutz im Einklang mit der Einwilligung:
              startet nach Zustimmung, räumt nach Widerruf die Cookies weg
              (lib/analytics.ts, lib/captcha.ts). Rendert nichts.
              Das <Suspense> ist Pflicht, nicht Zierde: die Komponente liest
              `useSearchParams`, und ohne Grenze macht Next daraufhin JEDE Seite
              dieser App dynamisch — die Startseite wäre nicht mehr statisch
              vorgerendert, nur weil eine unsichtbare Zählkomponente im Layout
              hängt. */}
          <Suspense fallback={null}>
            <EinwilligungsDienste />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
