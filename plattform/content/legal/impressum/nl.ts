import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Colofon",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    `Gegevens over de aanbieder van de marktplaats myBestDays. Exploitant is ${ANBIETER.firma}; myBestDays is een merk van deze vennootschap en geen zelfstandige rechtspersoon.`,
    "Verplichte vermeldingen op grond van § 7 van de Deense e-handelslov, die artikel 5 van Richtlijn 2000/31/EG inzake elektronische handel omzet, alsmede vermeldingen op grond van de artikelen 11 en 12 van Verordening (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Exploitant van het platform",
      paragraphs: [
        `${ANBIETER.firma} — anpartsselskab (ApS) naar Deens recht`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Denemarken`,
        `Vertegenwoordigingsbevoegde directie: ${ANBIETER.direktion.join(" en ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Contact",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefoon: ${ANBIETER.telefon}`,
        "Voor zaken rond een bestaande boeking gebruikt u de berichtenfunctie in uw account — dan liggen boeking en verloop al bij ons; zie [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register en btw",
      paragraphs: [
        `CVR-nr. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Denemarken.`,
        ...(ANBIETER.ustId
          ? [`Btw-identificatienummer: ${ANBIETER.ustId}.`]
          : [
              "Er bestaat momenteel geen btw-identificatienummer; § 7 van de e-handelslov verlangt vermelding daarvan alleen bij een bestaande btw-registratie.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Contactpunten op grond van Verordening (EU) 2022/2065",
      paragraphs: [
        `Centraal contactpunt voor instanties op grond van artikel 11 en voor gebruikers op grond van artikel 12: ${ANBIETER.email}, per post op het hierboven genoemde adres.`,
        "De communicatietalen zijn Duits, Deens en Engels.",
        "De procedures op grond van die verordening — melding van onrechtmatige inhoud, motivering van maatregelen, klachtafhandeling — zijn beschreven onder [Digitaledienstenverordening](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Bevoegde instanties",
      paragraphs: [
        `Coördinator voor digitale diensten op grond van artikel 49 van Verordening (EU) 2022/2065: ${DSA_KOORDINATOR.name}, Denemarken ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Toezichthoudende autoriteit gegevensbescherming: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Denemarken, ${AUFSICHTSBEHOERDE.email}.`,
        "Het bemiddelen van logiesdiensten vereist in Denemarken geen bijzondere vergunning; een beroepsrechtelijke toezichthouder bestaat daarom niet.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Consumentengeschillenbeslechting",
      paragraphs: [
        "Het platform van de Europese Commissie voor onlinegeschillenbeslechting is bij Verordening (EU) 2024/3228 ingetrokken en heeft zijn werkzaamheden gestaakt.",
        "Wij zijn niet verplicht en niet bereid deel te nemen aan een geschillenbeslechtingsprocedure voor een consumentengeschillencommissie.",
        `Los daarvan kunt u zich als consument wenden tot de bevoegde Deense instantie: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Denemarken ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Woont u in een andere lidstaat, dan helpt het Europees Consumenten Centrum in uw land verder.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Opmerkingen over inhoud en links",
      paragraphs: [
        "Advertentie-inhoud komt van de betreffende aanbieders. myBestDays maakt die niet tot de zijne; zie onderdeel A4 van de [Gebruiksvoorwaarden](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Voor de inhoud van gelinkte sites van derden is de exploitant daarvan verantwoordelijk. Krijgen wij kennis van een rechtsinbreuk, dan verwijderen wij de link onverwijld.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Auteursrecht",
      paragraphs: [
        `De op dit platform gepubliceerde eigen inhoud, teksten, afbeeldingen en merken zijn auteurs- en merkenrechtelijk beschermd. Gebruik buiten de wettelijk toegestane gevallen vereist de voorafgaande schriftelijke toestemming van ${ANBIETER.firma}; voor merken gelden de [Richtlijnen voor merken](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Toepasselijk recht",
      paragraphs: [
        `${ANBIETER.firma} is gevestigd in Denemarken en uitsluitend daar gevestigd. Op dit onlineaanbod is daarom Deens recht van toepassing — ook op de Nederlandstalige versie (oorsprongslandbeginsel op grond van artikel 3 van Richtlijn 2000/31/EG). Dwingende consumentenbeschermingsbepalingen van uw woonstaat blijven onaangetast.`,
      ],
    },
  ],
};
