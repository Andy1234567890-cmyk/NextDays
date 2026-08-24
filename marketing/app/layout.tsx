// Root-Layout der Marketing-App: Schriften (lokal), globale Styles und
// next-intl-Provider. Die Sprache kommt aus dem nd_locale-Cookie
// (i18n/request.ts) und landet auch im lang-Attribut des <html>.
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import localFont from "next/font/local";

import "./globals.css";

import { EinwilligungsLeiste } from "@/components/einwilligung/einwilligungs-leiste";
import { SupportChat } from "@/components/support-chat";
import { VoranmeldungPopup } from "@/components/voranmeldung-popup";
import { anzeigewaehrung } from "@/lib/anzeigewaehrung";
import { formatCurrency } from "@/lib/currency";
import { holePreisliste } from "@/lib/preise";
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
