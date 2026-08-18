import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

// Firmen-, Register- und Kontaktdaten kommen AUSSCHLIESSLICH aus
// @nextdays/anbieter — nie als Literal in einen Rechtstext schreiben, sonst
// stehen sie irgendwann in 24 Sprachfassungen unterschiedlich da.
// Rechtsgrundlage ist § 7 der dänischen E-handelslov (Sitzland Dänemark), die
// Artikel 5 der Richtlinie 2000/31/EG umsetzt; nach dem Herkunftslandprinzip
// gilt dänisches Recht auch für die deutschsprachige Fassung.
export const doc: LegalDoc = {
  title: "Impressum",
  stand: "Stand: 18. August 2026",
  intro: [
    `Angaben zum Anbieter des Marktplatzes myBestDays. Betreiberin ist die ${ANBIETER.firma}; myBestDays ist eine Marke dieser Gesellschaft und keine eigene juristische Person.`,
    "Pflichtangaben nach § 7 der dänischen E-handelslov, die Artikel 5 der Richtlinie 2000/31/EG über den elektronischen Geschäftsverkehr umsetzt, sowie Angaben nach Artikel 11 und 12 der Verordnung (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Betreiberin der Plattform",
      paragraphs: [
        `${ANBIETER.firma} — ${ANBIETER.rechtsform}`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}`,
        `Vertretungsberechtigte Direktion: ${ANBIETER.direktion.join(" und ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-Mail: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "Für Anliegen zu einer bestehenden Buchung nutzen Sie die Nachrichtenfunktion in Ihrem Konto — dann liegen uns Buchung und Verlauf bereits vor; siehe [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register und Umsatzsteuer",
      paragraphs: [
        `CVR-nr. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dänemark.`,
        ...(ANBIETER.ustId
          ? [`Umsatzsteuer-Identifikationsnummer: ${ANBIETER.ustId}.`]
          : [
              "Eine Umsatzsteuer-Identifikationsnummer besteht derzeit nicht; § 7 der E-handelslov verlangt ihre Angabe nur bei bestehender Momsregistrierung.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktstellen nach der Verordnung (EU) 2022/2065",
      paragraphs: [
        `Zentrale Kontaktstelle für Behörden nach Artikel 11 und für Nutzerinnen und Nutzer nach Artikel 12: ${ANBIETER.email}, postalisch unter der oben genannten Anschrift.`,
        "Kommunikationssprachen sind Deutsch, Dänisch und Englisch.",
        "Die Verfahren nach dieser Verordnung — Meldung rechtswidriger Inhalte, Begründung von Maßnahmen, Beschwerdeverfahren — sind unter [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa) beschrieben.",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Zuständige Behörden",
      paragraphs: [
        `Koordinator für digitale Dienste nach Artikel 49 der Verordnung (EU) 2022/2065: ${DSA_KOORDINATOR.name}, ${DSA_KOORDINATOR.land} ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Datenschutz-Aufsichtsbehörde: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, ${AUFSICHTSBEHOERDE.email}.`,
        "Die Vermittlung von Beherbergungsleistungen bedarf in Dänemark keiner besonderen Zulassung; eine berufsrechtliche Aufsichtsbehörde besteht daher nicht.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Verbraucherstreitbeilegung",
      paragraphs: [
        "Die Plattform der Europäischen Kommission zur Online-Streitbeilegung wurde durch die Verordnung (EU) 2024/3228 aufgehoben und hat ihren Betrieb eingestellt.",
        "Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
        `Unabhängig davon können Sie sich als Verbraucher an die zuständige dänische Stelle wenden: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, ${VERBRAUCHERSCHLICHTUNG.land} ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Wohnen Sie in einem anderen Mitgliedstaat, hilft Ihnen das Europäische Verbraucherzentrum Ihres Landes weiter.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Hinweise zu Inhalten und Links",
      paragraphs: [
        "Angebotsinhalte stammen von den jeweiligen Anbietern. myBestDays macht sie sich nicht zu eigen; siehe Abschnitt A4 der [Nutzungsbedingungen](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Für die Inhalte verlinkter Seiten Dritter ist deren Betreiber verantwortlich. Erlangen wir Kenntnis von einer Rechtsverletzung, entfernen wir den Link unverzüglich.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Urheberrecht",
      paragraphs: [
        `Die auf dieser Plattform veröffentlichten eigenen Inhalte, Texte, Grafiken und Marken sind urheber- und markenrechtlich geschützt. Eine Verwendung außerhalb der gesetzlich zugelassenen Fälle bedarf der vorherigen schriftlichen Zustimmung der ${ANBIETER.firma}; für Marken gelten die [Richtlinien für Markenzeichen](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Anwendbares Recht",
      paragraphs: [
        `Die ${ANBIETER.firma} hat ihren Sitz in Dänemark und ist ausschließlich dort niedergelassen. Für dieses Online-Angebot gilt daher dänisches Recht — auch für die deutschsprachige Fassung (Herkunftslandprinzip nach Artikel 3 der Richtlinie 2000/31/EG). Zwingende Verbraucherschutzvorschriften Ihres Wohnsitzstaates bleiben unberührt.`,
      ],
    },
  ],
};
