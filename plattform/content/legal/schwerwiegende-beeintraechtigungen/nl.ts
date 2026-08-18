import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Beleid bij ernstige verstoringen",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Soms verhindert een gebeurtenis de reis of het verblijf waaraan gast noch aanbieder iets kan doen. Dit beleid beschrijft welke gebeurtenissen dat zijn en wat dan geldt.",
    "Het gaat vóór op de in de advertentie gekozen annuleringsvoorwaarde.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Welke gebeurtenissen zijn gedekt",
      paragraphs: [
        "Gedekt zijn gebeurtenissen die na de boeking intreden, voor beide partijen onvoorzienbaar waren en de reis of het verblijf onmogelijk of rechtens ontoelaatbaar maken:",
      ],
      list: [
        "overheidsmatige reis- of verblijfsverboden, uitgaansverboden en grenssluitingen die de bestemming of de plaats van vertrek betreffen;",
        "natuurrampen en natuurgebeurtenissen die de bestemming treffen — aardbeving, overstroming, storm, grote brand, vulkaanuitbarsting;",
        "oorlog, gewapend conflict, terreuraanslagen en onlusten op de bestemming;",
        "een door de overheid vastgestelde epidemie of pandemie met maatregelen die het verblijf verbieden;",
        "uitval van de levering van elektriciteit, water of warmte op de bestemming gedurende langere tijd;",
        "het volledig wegvallen van de reismogelijkheid naar de bestemming als gevolg van een van de voorgaande gebeurtenissen.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Welke gebeurtenissen niet zijn gedekt",
      paragraphs: ["Niet gedekt zijn met name:"],
      list: [
        "ziekte of letsel van de gast of zijn naasten — daarvoor is een reisverzekering bedoeld;",
        "beroepsmatige verhindering, examendata of het vervallen van verlof;",
        "de afgelasting van een evenement waarvoor de reis was geboekt, mits de accommodatie bruikbaar blijft;",
        "weer dat geen natuurramp vormt — regen, kou, hitte, ontbrekende sneeuw;",
        "het uitvallen van afzonderlijke vervoermiddelen, zolang een redelijke reis mogelijk blijft;",
        "de annulering van een vlucht of een staking bij een vervoersonderneming — daarvoor bestaan aanspraken jegens de vervoersonderneming.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Wat geldt wanneer een gedekte gebeurtenis intreedt",
      paragraphs: [
        "Betreft de gebeurtenis de periode van uw boeking, dan kunt u kosteloos annuleren. U krijgt het via het platform betaalde bedrag volledig gerestitueerd.",
        "Is het verblijf al begonnen, dan restitueren wij het aandeel voor de niet meer bruikbare nachten.",
        "De aanbieder ondervindt van een dergelijke annulering geen nadeel bij de beoordeling van zijn betrouwbaarheid.",
        "Als alternatief kunt u met de aanbieder een verschuiving afspreken; wij helpen bij het omboeken.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Hoe u zich hierop beroept",
      paragraphs: [
        "Meld u via de contactwegen onder [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden) en noem boekingsnummer en gebeurtenis.",
        "Wij toetsen aan de hand van openbaar toegankelijke bronnen — overheidsbesluiten, officiële waarschuwingen, berichten van erkende nieuwsbronnen — en beslissen vlot.",
        "Is de situatie nog niet definitief te beoordelen, dan wachten wij de ontwikkeling tot kort vóór de aankomstdag af en beslissen dan. Uw boeking blijft tot dan ongewijzigd bestaan.",
      ],
    },
  ],
};
