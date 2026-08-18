import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Stornierungsbedingungen",
  stand: "Stand: 18. August 2026",
  intro: [
    "Jeder Anbieter wählt für seine Unterkunft eine Stornierungsbedingung aus. Welche gilt, steht im Angebot und in Ihrer Buchungsbestätigung. Diese Seite beschreibt die Bedingungen, die wir Anbietern zur Auswahl stellen.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Die Stornierungsbedingungen im Überblick",
      paragraphs: [
        "Maßgeblich ist stets die im Angebot ausgewiesene Bedingung. Die Fristen beziehen sich auf den Beginn des Anreisetags in der Ortszeit der Unterkunft.",
      ],
      list: [
        "Flexibel — kostenfreie Stornierung bis 24 Stunden vor Anreise. Danach wird die erste Nacht berechnet, die übrigen Nächte werden erstattet.",
        "Moderat — kostenfreie Stornierung bis 5 Tage vor Anreise. Danach werden 50 % des Übernachtungspreises berechnet.",
        "Streng — kostenfreie Stornierung bis 14 Tage vor Anreise, sofern die Buchung mindestens 14 Tage vor Anreise erfolgte. Danach werden 50 % bis 7 Tage vor Anreise berechnet, anschließend der volle Preis.",
        "Nicht erstattbar — keine kostenfreie Stornierung. Der Preis ist in der Regel niedriger; auf die fehlende Erstattung weisen wir vor der Buchung gesondert hin.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Was in jedem Fall erstattet wird",
      paragraphs: [
        "Unabhängig von der gewählten Bedingung erstatten wir bei jeder Stornierung:",
      ],
      list: [
        "die Kurtaxe und andere durchlaufende Abgaben, soweit sie über die Plattform abgerechnet wurden und die Übernachtung nicht stattfindet;",
        "eine über die Plattform eingezogene Kaution vollständig;",
        "Zusatzleistungen, die nicht erbracht wurden.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Stornierung durch den Anbieter",
      paragraphs: [
        "Storniert der Anbieter, erhalten Sie den über die Plattform gezahlten Betrag vollständig zurück — unabhängig von der gewählten Stornierungsbedingung.",
        "Zusätzlich unterstützen wir Sie bei der Suche nach einer vergleichbaren Unterkunft; siehe [Umbuchungs- und Rückerstattungsrichtlinie](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Kein gesetzliches Widerrufsrecht",
      paragraphs: [
        "Bei Beherbergungsleistungen, die für einen bestimmten Zeitraum gebucht werden, besteht nach Artikel 16 Buchstabe l der Richtlinie 2011/83/EU in der Regel kein gesetzliches Widerrufsrecht. Die hier beschriebenen Stornierungsbedingungen sind daher eine vertragliche Zusage, keine Umsetzung eines Widerrufsrechts.",
        "Zwingende gesetzliche Rechte, insbesondere Gewährleistungsrechte bei Mängeln der Unterkunft, bleiben unberührt.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Änderung statt Stornierung",
      paragraphs: [
        "Möchten Sie den Zeitraum oder die Anzahl der Reisenden ändern, stellen Sie die Änderung über Ihre Buchung. Der Anbieter muss zustimmen; bis dahin bleibt die ursprüngliche Buchung bestehen.",
        "Führt die Änderung zu einem höheren Preis, wird die Differenz fällig. Führt sie zu einem niedrigeren Preis, erstatten wir die Differenz, soweit die geltende Stornierungsbedingung dies für den entfallenden Teil zulässt.",
      ],
    },
    {
      id: "wie",
      heading: "6. Wie Sie stornieren",
      paragraphs: [
        "Stornieren Sie über Ihr Konto unter „Buchungen“. Maßgeblich für die Frist ist der Zeitpunkt, zu dem die Stornierung bei uns eingeht.",
        "Sie erhalten eine Stornierungsbestätigung mit dem Erstattungsbetrag. Zur Auszahlung siehe die [Zahlungsbedingungen](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
