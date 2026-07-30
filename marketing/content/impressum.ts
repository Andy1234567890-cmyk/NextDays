// Anbieterdaten + Impressumstext der Marketing-Site.
//
// EINZIGE QUELLE DER WAHRHEIT für die Firmen-/Registerdaten in dieser App —
// keine verstreuten Kopien in Komponenten. Alle Angaben sind am 30.07.2026
// gegen die amtlichen Register geprüft:
//   · Firma, Adresse, Rechtsform, Telefon, Branche → cvrapi.dk (CVR 46615182)
//   · Adresse Hirtshalsvej 21, 9881 Bindslev       → Dataforsyningen/DAWA (aktiv)
//   · Direktion Jeanine + Torsten Ågaard           → CVR-Ledelse (direktører)
// Registeränderung (Direktion, Sitz, Momsregistrierung) → hier nachziehen und
// das Stand-Datum hochsetzen.
//
// OFFEN — vor dem Live-Gang klären: Die Umsatzsteuer-Identifikationsnummer
// DK46615182 wird vom EU-VIES-Dienst am 30.07.2026 als NICHT gültig
// zurückgemeldet (Kontrollabfrage mit DK54562519/Lego A/S lieferte gültig, der
// Dienst funktioniert also). Plausibel, weil die Gesellschaft erst am
// 01.07.2026 gegründet wurde und die Momsregistrierung noch aussteht.
// § 7 der dänischen E-handelslov verlangt die Umsatzsteuer-Identifikationsnummer
// nur bei bestehender Momsregistrierung — liegt sie nicht vor, muss `ustId` auf
// null gesetzt werden (die Zeile entfällt dann automatisch), statt eine nicht
// existierende Nummer zu veröffentlichen.
//
// Rechtsgrundlage: § 7 der dänischen E-handelslov (Sitzland = Dänemark), die
// Artikel 5 der Richtlinie 2000/31/EG umsetzt. Das deutsche DDG ist NICHT
// anwendbar: nach dem Herkunftslandprinzip (Art. 3 der Richtlinie, § 3 DDG)
// gilt für einen in Dänemark niedergelassenen Anbieter dänisches Recht, auch
// für das deutschsprachige Angebot.

import { AGB_URL } from "@/lib/app-url";

export type ImpressumZeile = {
  label: string;
  // Mehrzeilige Werte (z. B. Anschrift) als eigene Zeilen.
  werte: string[];
  // Optionaler Link auf den ersten Wert (mailto:/tel:/https:).
  href?: string;
};

export type ImpressumBlock = {
  heading: string;
  paragraphs?: string[];
  zeilen?: ImpressumZeile[];
  links?: { label: string; href: string }[];
};

// Kontaktkanäle: die Mail-Domäne ist bewusst .dk (dort liegt der Mailserver),
// die Website läuft unter der Hauptdomäne .com. Beides ist so gewollt.
export const ANBIETER = {
  firma: "myNextDays ApS",
  rechtsform: "Anpartsselskab (ApS) dänischen Rechts",
  strasse: "Hirtshalsvej 21",
  ort: "9881 Bindslev",
  land: "Dänemark",
  email: "info@mynextdays.dk",
  telefon: "+45 93 90 39 91",
  // E.164 für den tel:-Link — ohne Leerzeichen.
  telefonE164: "+4593903991",
  website: "www.mynextdays.com",
  websiteUrl: "https://www.mynextdays.com",
  // CVR-Nummer ist rein 8-stellig; das Präfix „DK" gehört ausschließlich an
  // die Umsatzsteuer-Identifikationsnummer (Momsnummer).
  cvr: "46615182",
  // null, solange keine Momsregistrierung vorliegt — dann entfällt die Zeile.
  ustId: "DK46615182" as string | null,
  direktion: ["Jeanine Ågaard", "Torsten Ågaard"],
} as const;

export const IMPRESSUM_STAND = "Stand: 30. Juli 2026";

export const IMPRESSUM_EINLEITUNG = [
  `Angaben zum Anbieter der Plattform myNextDays — Property-Management-System und Channel-Manager der ${ANBIETER.firma}.`,
  `Pflichtangaben nach § 7 der dänischen E-handelslov, die Artikel 5 der Richtlinie 2000/31/EG über den elektronischen Geschäftsverkehr umsetzt.`,
];

export const IMPRESSUM_BLOECKE: ImpressumBlock[] = [
  {
    heading: "Anbieter",
    zeilen: [
      {
        label: "Unternehmen",
        werte: [ANBIETER.firma, ANBIETER.rechtsform],
      },
      {
        label: "Anschrift",
        werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
      },
      {
        label: "Vertretungsberechtigte Direktion",
        werte: [`${ANBIETER.direktion.join(" und ")} (direktører)`],
      },
    ],
  },
  {
    heading: "Kontakt",
    zeilen: [
      {
        label: "E-Mail",
        werte: [ANBIETER.email],
        href: `mailto:${ANBIETER.email}`,
      },
      {
        label: "Telefon",
        werte: [ANBIETER.telefon],
        href: `tel:${ANBIETER.telefonE164}`,
      },
      {
        label: "Internet",
        werte: [ANBIETER.website],
        href: ANBIETER.websiteUrl,
      },
    ],
  },
  {
    heading: "Register und Umsatzsteuer",
    zeilen: [
      {
        label: "Handelsregister",
        werte: [
          `CVR-nr. ${ANBIETER.cvr}`,
          "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dänemark",
        ],
      },
      // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
      ...(ANBIETER.ustId
        ? [
            {
              label: "Umsatzsteuer-Identifikationsnummer",
              werte: [ANBIETER.ustId],
            },
          ]
        : []),
    ],
  },
  {
    heading: "Kontaktstelle nach dem Digital Services Act",
    paragraphs: [
      `Zentrale Kontaktstelle für Behörden nach Artikel 11 und für Nutzerinnen und Nutzer nach Artikel 12 der Verordnung (EU) 2022/2065 (Digital Services Act): ${ANBIETER.email}.`,
      "Kommunikationssprachen sind Deutsch, Dänisch und Englisch.",
    ],
  },
  {
    heading: "Verbraucherstreitbeilegung",
    paragraphs: [
      "Wir sind nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
    ],
  },
  {
    heading: "Haftung für Links",
    paragraphs: [
      "Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.",
    ],
  },
  {
    heading: "Urheberrecht",
    paragraphs: [
      `Die auf dieser Website veröffentlichten Inhalte, Texte, Grafiken und Marken sind urheber- und markenrechtlich geschützt. Eine Verwendung außerhalb der gesetzlich zugelassenen Fälle bedarf der vorherigen schriftlichen Zustimmung der ${ANBIETER.firma}.`,
    ],
  },
  {
    heading: "Weitere Rechtsdokumente",
    paragraphs: [
      "Die Nutzung der Plattform richtet sich nach unseren Allgemeinen Geschäftsbedingungen.",
    ],
    links: [{ label: "Allgemeine Geschäftsbedingungen", href: AGB_URL }],
  },
  {
    heading: "Anwendbares Recht",
    paragraphs: [
      `Die ${ANBIETER.firma} hat ihren Sitz in Dänemark und ist ausschließlich dort niedergelassen. Für dieses Online-Angebot gilt daher dänisches Recht — auch für die deutschsprachige Fassung (Herkunftslandprinzip nach Artikel 3 der Richtlinie 2000/31/EG). Die Informationspflichten richten sich nach § 7 der dänischen E-handelslov.`,
    ],
  },
];
