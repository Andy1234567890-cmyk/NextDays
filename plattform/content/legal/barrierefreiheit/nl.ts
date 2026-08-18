import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Toegankelijkheidsverklaring",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "myBestDays moet voor iedereen bruikbaar zijn. Deze verklaring beschrijft de stand van de toegankelijkheid van het platform, bekende beperkingen en de weg om drempels bij ons te melden.",
    "Zij heeft betrekking op de eisen van Richtlijn (EU) 2019/882 betreffende de toegankelijkheidsvoorschriften voor producten en diensten, die sinds 28 juni 2025 geldt voor diensten van elektronische handel.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stand van de toegankelijkheid",
      paragraphs: [
        "Wij richten ons naar de geharmoniseerde norm EN 301 549 en de daaraan ten grondslag liggende Web Content Accessibility Guidelines (WCAG) 2.1 op conformiteitsniveau AA.",
        "Gerealiseerd zijn onder meer: doorlopende bedienbaarheid met het toetsenbord, zichtbare focus, semantische kopstructuur, labels bij alle formuliervelden, tekstalternatieven voor bedieningselementen, voldoende kleurcontrast, schaalbaarheid van de tekst zonder verlies van inhoud alsmede een weergave die zich aan de schermgrootte aanpast.",
        "De rechtsteksten zijn in alle 24 officiële talen van de Unie beschikbaar en van correcte taalmarkering voorzien, zodat schermlezers ze goed voorlezen.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Bekende beperkingen",
      paragraphs: ["Momenteel niet toegankelijk zijn met name:"],
      list: [
        "Foto's en beschrijvingen in advertenties komen van aanbieders; tekstalternatieven bij foto's kunnen ontbreken of ontoereikend zijn. Wij verzoeken aanbieders die aan te vullen.",
        "Ingesloten kaartweergaven van derden zijn slechts beperkt met het toetsenbord bedienbaar. Alle locatiegegevens zijn daarnaast als tekst beschikbaar.",
        "Door aanbieders geüploade documenten (bijvoorbeeld huisregels als pdf) zijn niet doorlopend toegankelijk gemarkeerd.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Toegankelijkheid van de accommodaties",
      paragraphs: [
        "Deze verklaring betreft het platform, niet de accommodaties. Gegevens over de bouwkundige toegankelijkheid van een accommodatie komen van de aanbieder.",
        "Bent u op bepaalde kenmerken aangewezen — drempelloze toegang, deurbreedtes, inloopdouche, lift — stem die dan vóór de boeking met de aanbieder af via de berichtenfunctie. Onjuiste gegevens over toegankelijkheid zijn een schending van onze richtlijnen en kunnen worden gemeld.",
      ],
    },
    {
      id: "melden",
      heading: "4. Drempels melden",
      paragraphs: [
        `Stuit u op een drempel, meld die dan bij ons op ${ANBIETER.email} of via de contactwegen onder [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Beschrijf welke pagina het betreft, wat u wilde doen en welke hulpmiddelen u gebruikt. Wij bevestigen de ontvangst en delen u mee hoe en wanneer wij de drempel wegnemen.",
        "Hebt u informatie in een toegankelijke vorm nodig, dan stellen wij die op verzoek beschikbaar.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Handhavingsprocedure",
      paragraphs: [
        "Bent u niet tevreden met ons antwoord, dan kunt u zich wenden tot de instantie die belast is met het markttoezicht op grond van Richtlijn (EU) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (voorheen Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Denemarken",
        "Telefoon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
