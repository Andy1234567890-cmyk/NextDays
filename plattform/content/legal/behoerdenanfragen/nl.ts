import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Richtlijnen voor verzoeken van instanties en opsporingsdiensten",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Deze richtlijnen zijn gericht tot instanties, gerechten en opsporingsdiensten die van myBestDays gegevens verlangen of een bevel tegen inhoud richten. Zij zijn hier openbaar zodat ook gebruikers kunnen nalezen onder welke voorwaarden wij gegevens verstrekken.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Uitgangspunt",
      paragraphs: [
        "Wij verstrekken gebruikersgegevens alleen wanneer een geldige rechtsgrondslag bestaat en het verzoek aan de formele eisen voldoet. Een vormvrij verzoek om gegevens volstaat niet.",
        "Wij toetsen elk verzoek op bevoegdheid, rechtsgrondslag, bepaaldheid en evenredigheid en verstrekken alleen de gegevens die het verzoek aanduidt.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Eisen aan een verzoek",
      paragraphs: ["Een verzoek zou moeten bevatten:"],
      list: [
        "de verzoekende instantie, het zaaknummer en de contactgegevens van de behandelende persoon op officieel briefpapier;",
        "de rechtsgrondslag naar nationaal recht of Unierecht;",
        "een nauwkeurige aanduiding van de betrokken persoon of het betrokken account — e-mailadres, boekingsnummer of advertentie-URL;",
        "de nauwkeurig aangeduide gegevens en de periode;",
        "in voorkomend geval een rechterlijk bevel, voor zover het toepasselijke recht dat verlangt;",
        "een aanwijzing wanneer het informeren van de betrokkene het onderzoek in gevaar zou brengen, met vermelding van de rechtsgrondslag.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Bevelen op grond van Verordening (EU) 2022/2065",
      paragraphs: [
        "Bevelen om op te treden tegen onrechtmatige inhoud (artikel 9) en bevelen om informatie te verstrekken (artikel 10) moeten de daar genoemde gegevens bevatten, met name de rechtsgrondslag, de exacte elektronische locatie, de motivering, de rechtsmiddelen en de taal.",
        "Wij bevestigen de ontvangst en delen de bevelende instantie mee welke maatregelen wij hebben genomen en wanneer.",
        "Over een bevel informeren wij de betrokkene uiterlijk op het moment van uitvoering, tenzij de instantie onder vermelding van de rechtsgrondslag uitstel beveelt.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Noodgevallen",
      paragraphs: [
        "Bestaat er een onmiddellijk gevaar voor leven of lichamelijke integriteit, dan verstrekken wij de voor de afwending noodzakelijke gegevens ook zonder voorafgaand formeel bevel. Merk een dergelijk verzoek uitdrukkelijk als noodgeval aan en beschrijf het gevaar.",
        "Bestaan er aanwijzingen voor een strafbaar feit dat een gevaar oplevert voor het leven of de veiligheid van een persoon, dan informeren wij uit eigen beweging de bevoegde instanties (artikel 18 van Verordening (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Welke gegevens wij bewaren",
      paragraphs: [
        "Welke categorieën gegevens wij verwerken en hoelang wij ze bewaren, staat in de [Privacyverklaring](https://mybestdays.dk/rechtliches/datenschutz). Buiten de daar genoemde termijnen bewaren wij geen gegevens.",
        "Bewaring op voorraad boven de behoefte vindt niet plaats. Een verzoek gegevens tijdelijk veilig te stellen voor een lopende procedure voeren wij binnen de rechtens toelaatbare grenzen uit.",
        "Volledige betaalgegevens berusten niet bij ons; die moeten bij de betaaldienstverlener worden opgevraagd.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Informeren van de betrokkene",
      paragraphs: [
        "Wij informeren betrokken gebruikers over een verzoek dat hun gegevens betreft, tenzij een wettelijk voorschrift of een gemotiveerd bevel van een instantie dat verbiedt of er een onmiddellijk gevaar voor leven of lichamelijke integriteit bestaat.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Waarheen verzoeken moeten worden gericht",
      paragraphs: [
        "Verzoeken richt u aan het centrale contactpunt voor instanties dat is genoemd onder [Digitaledienstenverordening](https://mybestdays.dk/rechtliches/dsa). Wij behandelen ze in het Duits, Deens en Engels.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparantie",
      paragraphs: [
        "Aantal en aard van de bevelen van instanties vermelden wij in ons jaarlijkse transparantieverslag; zie [Digitaledienstenverordening](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
