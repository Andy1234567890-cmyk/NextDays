import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Priser, rangordning og anbefalinger",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Denne side forklarer, hvordan priser vises på myBestDays, hvad der bestemmer rækkefølgen af søgeresultaterne, og hvordan anbefalinger opstår. Den opfylder gennemsigtighedspligterne efter artikel 6a i direktiv 2005/29/EF, artikel 5 i forordning (EU) 2019/1150 og artikel 27 i forordning (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Hvordan priser vises",
      paragraphs: [
        "Så snart periode og antal rejsende er fastlagt, viser vi totalprisen for hele opholdet, inklusive skatter og alle gebyrer, der afregnes via platformen.",
        "Så længe der endnu ikke er valgt en periode, viser vi en pris pr. nat til orientering og markerer den som sådan.",
        "Omkostninger, der først forfalder på stedet, oplyser vi særskilt før gennemførelsen af bookingen. De er ikke en del af totalprisen, men er synlige før bookingen.",
        "Viser vi en overstreget sammenligningspris, er det den laveste pris, udbyderen har forlangt for samme ydelse i de sidste 30 dage før nedsættelsen (artikel 6a i direktiv 98/6/EF).",
        "Priser er ens for alle gæster. Vi tilpasser ikke prisen til din person, din enhed eller din hidtidige søgeadfærd.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Hvad der bestemmer rækkefølgen af søgeresultaterne",
      paragraphs: [
        "I standardsorteringen bestemmer følgende forhold rækkefølgen, i faldende betydning:",
      ],
      list: [
        "overensstemmelse med din søgning — ledighed i den søgte periode, kapacitet til antallet af rejsende, beliggenhed i det søgte område og de valgte filtre;",
        "opslagets fuldstændighed og kvalitet — beskrivelse, billeder, vedligeholdte facilitetsoplysninger;",
        "anmeldelser — samlet karakter og antal anmeldelser;",
        "udbyderens pålidelighed — svaradfærd, accepteringsgrad og afbestillinger fra udbyderens side;",
        "hvor aktuelle priser og ledighed er;",
        "forholdet mellem pris og ydelse sammenlignet med lignende opslag i samme område.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Betalt placering",
      paragraphs: [
        "En udbyder kan ikke købe sig til en bedre plads i standardsorteringen. Servicegebyrets størrelse påvirker ikke rækkefølgen.",
        "Skulle vi fremover tilbyde betalte placeringer, markerer vi dem utvetydigt som annonce og adskiller dem synligt fra de øvrige resultater.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Skift sortering",
      paragraphs: [
        "Du kan til enhver tid ændre sorteringen, f.eks. efter pris eller anmeldelse. Hvilken sortering der er aktiv, vises over resultatlisten.",
        "Der står mindst én sortering til din rådighed, som ikke beror på profilering i henhold til artikel 4, nr. 4, i forordning (EU) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Anbefalinger",
      paragraphs: [
        "Viser vi dig forslag („kunne interessere dig“, „lignende indkvartering“), beror disse på den aktuelle søgning, på tidligere viste opslag og på egenskaber ved lignende indkvartering.",
        "Du kan slå personaliserede anbefalinger fra i din konto. Derefter ser du forslag, der alene beror på den aktuelle søgning.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Anmeldelser i rangordningen",
      paragraphs: [
        "Hvordan anmeldelser opstår og kontrolleres, fremgår af [Anmeldelsespolitik](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Anmeldelser indgår i rækkefølgen, men vi vægter hverken enkelte anmeldelser højere eller undertrykker negative.",
      ],
    },
  ],
};
