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
import { PartnerHinweis } from "@/components/partner-hinweis";
import { SupportChat } from "@/components/support-chat";
import { VoranmeldungPopup } from "@/components/voranmeldung-popup";
import { anzeigewaehrung } from "@/lib/anzeigewaehrung";
import { formatCurrency } from "@/lib/currency";
import { holePreisliste } from "@/lib/preise";
import {
  FACEBOOK_DOMAIN_VERIFICATION,
  GOOGLE_SITE_VERIFICATION,
} from "@/lib/site-verification";
import {
  organisationSchema,
  produktSchema,
  websiteSchema,
} from "@/lib/organisation-schema";
import { SITE_URL, siteUrl } from "@/lib/site-url";
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

  // EINMAL berechnet und an alle drei Stellen gegeben, die sie brauchen:
  // `description`, Open Graph und Twitter. Drei getrennte Aufrufe wären
  // dieselbe Formatierung dreimal — und damit die Stelle, an der die
  // Vorschaukarte irgendwann einen anderen Preis nennt als das Suchergebnis.
  const beschreibung =
    liste && einstiegCent !== null
      ? t("descriptionMitPreis", {
          preis: formatCurrency(einstiegCent / 100, liste.currency, locale),
        })
      : t("description");

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
    description: beschreibung,
    // Kanonische Adresse der Startseite. Sie fehlte hier bis zum 03.09.2026,
    // während JEDE Unterseite eine hatte — ausgerechnet auf der wichtigsten URL
    // also nicht. Folge, live nachgemessen: `https://mynextdays.com/` und
    // `https://www.mynextdays.com/` lieferten zwei byte-identische, beide
    // indexierbare Dokumente ohne jeden Hinweis, welches das echte ist.
    //
    // Der Wert ist relativ ("/"); `metadataBase` oben macht daraus die
    // www-Adresse — dieselbe, die Sitemap, robots.txt und llms.txt nennen.
    // Ein zweiter Ort mit einer ausgeschriebenen Domain wäre die Stelle, an der
    // die vier beim nächsten Domainwechsel auseinanderlaufen (Wurzel 4).
    //
    // Das ersetzt KEINE Server-Weiterleitung von apex auf www — die steht in
    // next.config.ts. Canonical ist ein Hinweis, den eine Suchmaschine
    // befolgen darf; der Redirect ist die Tatsache. Ein Sprachmodell, das die
    // Seite abruft, sieht ohnehin nur die Weiterleitung.
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: "myNextDays",
      locale,
      url: siteUrl("/"),
      title: t("title"),
      description: beschreibung,
      // KEIN `images` hier: `app/opengraph-image.tsx` erzeugt das Bild und
      // Next hängt `og:image` samt Maßen und `alt` von selbst an. Eine hier
      // getippte Angabe würde das erzeugte Bild VERDRÄNGEN (Next übernimmt es
      // nur, solange `openGraph.images` nicht gesetzt ist) — also genau das
      // geprüfte 1200×630-Bild gegen einen handgepflegten Pfad tauschen, der
      // beim nächsten Umbenennen ins Leere zeigt.
    },
    // Twitter/X liest `og:*` als Rückfallebene, aber `summary_large_image`
    // muss explizit gesetzt sein — ohne die Karte zeigt X nur einen nackten
    // Link. Titel und Beschreibung kommen aus derselben Quelle wie oben, damit
    // eine Änderung nicht an einer von drei Stellen hängen bleibt.
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: beschreibung,
      // `twitter:image` kommt ebenfalls aus opengraph-image.tsx — gleiche
      // Begründung wie oben.
    },
    // Wegweiser für Sprachmodelle auf /llms.txt (llmstxt.org). Die Datei
    // existiert und liefert 200 — sie war nur von der Seite aus nicht
    // auffindbar: ein Modell, das die Startseite liest, hatte keinen Hinweis
    // darauf, dass es eine kompakte, verlässliche Fassung gibt, und musste
    // 450 KB gerendertes Marketing-HTML raten.
    //
    // Zwei Wege, weil es keinen etablierten Standard-Mechanismus gibt:
    // `<link rel="llms-txt">` (die Konvention, die sich um llmstxt.org
    // gebildet hat) und ein `<meta name="llms-txt">`, weil manche Abrufer nur
    // Meta-Tags auswerten. Beide zeigen auf dieselbe absolute URL — eine
    // relative wäre für einen Abrufer ohne Basis-URL wertlos.
    other: {
      "llms-txt": siteUrl("/llms.txt"),
    },
    // Die Vorgabe. Bewusst ausgeschrieben statt weggelassen: ohne dieses Tag
    // ist das Verhalten zwar dasselbe, aber es steht nirgends, dass die Seite
    // indexiert werden SOLL. `max-snippet: -1` und `max-image-preview: large`
    // heben die Längenbegrenzung von Snippet und Vorschaubild auf — ohne sie
    // kürzt Google in manchen Regionen (EU-Leistungsschutzrecht) auf wenige
    // Wörter, und genau diese Kürzung trifft auch die Textmenge, die
    // KI-Übersichten aus der Seite übernehmen dürfen.
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("meta");

  // Für das Produkt-Schema BEWUSST die preislose Beschreibung, nicht die aus
  // `generateMetadata` mit dem Einstiegsbetrag: strukturierte Daten sind eine
  // dauerhafte Aussage über das Produkt, kein Snippet. Ein Preis darin würde
  // bei jedem Tarifwechsel eine veraltete Zahl in den Wissensgraphen tragen —
  // und wäre je Besuchersprache eine andere Währung für dieselbe Entität.
  const produktBeschreibung = t("description");

  return (
    // suppressHydrationWarning: Tag Assistant & Co. schreiben eigene
    // data-Attribute ins <html>, bevor React hydratisiert.
    <html lang={locale} suppressHydrationWarning>
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
        {/* Wegweiser für Sprachmodelle auf /llms.txt (llmstxt.org). Das
            gleichnamige `<meta>` setzt `generateMetadata` oben; hier steht die
            Link-Beziehung, die Next selbst nicht kennt — `alternates` erlaubt
            nur eine feste Liste von `rel`-Werten, `llms-txt` gehört nicht dazu.

            `type` ist ausdrücklich `text/markdown`: llms.txt IST Markdown,
            ausgeliefert als text/plain. Ein Abrufer, der nur den Content-Type
            der Antwort sieht, hielte sie sonst für unstrukturierten Text. */}
        <link
          rel="llms-txt"
          type="text/markdown"
          href={siteUrl("/llms.txt")}
        />
        {/* Strukturierte Daten zu Firma, Produkt und Website. Sie stehen im
            Layout und gelten damit für jede Route — eine Suchmaschine und ein
            Sprachmodell erfahren auf JEDER Seite, wer myNextDays ist und dass
            myBestDays etwas anderes ist.

            Drei getrennte `<script>`-Blöcke statt eines `@graph`: jeder Knoten
            bleibt für sich prüfbar (Rich Results Test meldet den fehlerhaften
            einzeln), und ein Fehler in einem macht nicht die anderen zwei
            ungültig. Die Verknüpfung leisten die `@id`-Verweise.

            `JSON.stringify` ist hier sicher, weil ALLE Werte aus dem Repo
            stammen (content/legal/anbieter) — kein Nutzer-Input, also keine
            Stelle, an der ein `</script>` im Wert den Block verlassen könnte. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organisationSchema()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(produktSchema(produktBeschreibung)),
          }}
        />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* Partnerprogramm (0517): nach einem Klick auf /p/CODE steht der
              Code in der Adresse — die Leiste macht ihn sichtbar und führt in
              die Registrierung. `useSearchParams` verlangt eine Suspense-
              Grenze, sonst fällt die ganze Seite auf Client-Rendering zurück. */}
          <Suspense fallback={null}>
            <PartnerHinweis />
          </Suspense>
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
