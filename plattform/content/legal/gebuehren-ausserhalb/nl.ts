import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kosten buiten het platform",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Dit beleid regelt welke bedragen een aanbieder buiten het platform mag verlangen en welke niet. Het beschermt gasten ertegen ter plaatse te worden geconfronteerd met vorderingen die niet in de advertentie stonden.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Uitgangspunt",
      paragraphs: [
        "Alles wat voor de geboekte dienst moet worden betaald, moet vóór het afronden van de boeking in de advertentie zijn vermeld — hetzij als onderdeel van de totaalprijs, hetzij als kostenpost ter plaatse.",
        "Een bedrag dat noch in de totaalprijs noch als kosten ter plaatse was vermeld, is de gast niet verschuldigd.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Wat ter plaatse mag worden verlangd",
      paragraphs: ["Ter plaatse mag uitsluitend worden verlangd:"],
      list: [
        "bedragen die in de advertentie uitdrukkelijk als kosten ter plaatse zijn vermeld (bijvoorbeeld eindschoonmaak, linnenpakket, parkeerplaats);",
        "plaatselijke heffingen zoals toeristenbelasting, voor zover die volgens de plaatselijke voorschriften ter plaatse moet worden voldaan;",
        "een in de advertentie vermelde borg;",
        "diensten die de gast pas ter plaatse en vrijwillig bijboekt, tegen een vooraf genoemde prijs;",
        "vergoeding van aangetoonde schade die de gast heeft veroorzaakt.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Wat niet mag worden verlangd",
      paragraphs: ["Niet toegestaan is met name:"],
      list: [
        "een naheffing op de overnachtingsprijs na het afronden van de boeking;",
        "kosten voor het feit dat de boeking via myBestDays is gedaan;",
        "administratie-, boekings- of kaartkosten die niet in de advertentie waren vermeld;",
        "het verzoek de boeking te annuleren en dezelfde accommodatie buiten het platform opnieuw te boeken;",
        "het verzoek de prijs of een deel ervan per overboeking, contant of via een betaaldienst buiten het platform te voldoen, wanneer de advertentie betaling via het platform voorziet.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Omzeilen van het platform",
      paragraphs: [
        "Kwam het contact tussen gast en aanbieder via het platform tot stand, dan mag de boeking niet buiten het platform om worden afgewikkeld. Dat geldt voor beide partijen.",
        "Wie het platform omzeilt, verliest de bescherming ervan: betalingen zijn niet gedekt, ons annulerings- en restitutiebeleid geldt niet, en wij kunnen bij een geschil niet bemiddelen.",
        "Schendingen kunnen leiden tot blokkering van het account. Bij aanbieders kunnen wij daarnaast de gederfde servicekosten vorderen.",
      ],
    },
    {
      id: "melden",
      heading: "5. Melden",
      paragraphs: [
        "Wordt ter plaatse een bedrag van u verlangd dat niet in de advertentie stond, betaal het dan niet en meld het ons via de contactwegen onder [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden). Hebt u al betaald, dan helpen wij bij de terugvordering.",
      ],
    },
  ],
};
