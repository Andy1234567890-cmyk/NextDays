import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Antidiscriminatiebeleid",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "myBestDays staat open voor iedereen. Wie via het platform boekt of aanbiedt, mag niemand slechter behandelen wegens persoonlijke kenmerken.",
    "Dit beleid maakt deel uit van de [Gebruiksvoorwaarden](https://mybestdays.dk/rechtliches/nutzungsbedingungen) en geldt voor gasten en aanbieders.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Uitgangspunt",
      paragraphs: [
        "Op myBestDays is het niet toegestaan een persoon te benadelen wegens herkomst, huidskleur, nationaliteit, etnische afkomst, godsdienst of levensovertuiging, geslacht, genderidentiteit, seksuele gerichtheid, handicap, leeftijd of burgerlijke staat.",
        "Dat geldt voor het aanvaarden of weigeren van boekingen, voor prijzen en voorwaarden, voor de omgang tijdens het verblijf en voor de communicatie via het platform.",
        "Daarnaast geldt artikel 20 van Verordening (EU) 2018/302: aanbieders mogen de toegang tot hun aanbod niet beperken wegens de nationaliteit, de woonplaats of de plaats van vestiging van een gast binnen de Unie.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Wat dit betekent voor aanbieders",
      paragraphs: ["Als aanbieder mag u met name niet:"],
      list: [
        "een boekingsaanvraag weigeren wegens een van de genoemde kenmerken;",
        "andere prijzen, borgen of voorwaarden van gasten verlangen omdat zij aan een van de kenmerken voldoen;",
        "in de advertentie of in berichten verklaren dat bepaalde groepen personen ongewenst zijn;",
        "assistentie- of blindengeleidehonden weigeren, ook wanneer uw huisregels dieren uitsluiten;",
        "een gast anders behandelen wegens zijn woonplaats in een andere lidstaat van de Unie.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Wat toegestaan blijft",
      paragraphs: [
        "U mag de maximale bezetting, een minimumleeftijd voor de hoofdboeker en zakelijke huisregels (zoals een rookverbod of rusttijden) vaststellen, zolang die voor alle gasten gelijk gelden.",
        "Bewoont u de accommodatie zelf mee en deelt u woonruimte met de gast, dan mag u dat in de advertentie duidelijk maken; de kenmerken uit onderdeel 1 rechtvaardigen niettemin geen weigering.",
        "U mag een boeking weigeren wanneer er concrete aanwijzingen zijn voor een schending van de huisregels of voor fraude. De grond moet op het gedrag betrekking hebben, niet op de persoon.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Toegankelijkheid",
      paragraphs: [
        "Gegevens over de toegankelijkheid van een accommodatie moeten kloppen. Een accommodatie als toegankelijk beschrijven terwijl zij dat niet is, is tevens een schending van de [Richtlijnen voor passende inhoud](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Wanneer een aanpassing zonder onevenredige inspanning mogelijk is, verwachten wij dat aanbieders die doorvoeren.",
      ],
    },
    {
      id: "melden",
      heading: "5. Discriminatie melden",
      paragraphs: [
        "Hebt u discriminatie ervaren of waargenomen, meld het ons dan via de meldfunctie of via de contactwegen onder [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden).",
        "Wij onderzoeken elke melding. Wordt een schending bevestigd, dan nemen wij maatregelen tot en met blijvende blokkering van het account. Is u om die reden een boeking geweigerd, dan helpen wij u een vergelijkbare accommodatie te vinden.",
      ],
    },
  ],
};
