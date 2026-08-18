import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Databeskyttelsesstandarder for værter",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Når du udbyder via myBestDays, modtager du personoplysninger om dine gæster. For behandlingen heraf er du selvstændig dataansvarlig i henhold til forordning (EU) 2016/679 (databeskyttelsesforordningen). Disse standarder beskriver, hvad vi forventer af dig.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Formålsbegrænsning",
      paragraphs: [
        "Du anvender udelukkende gæstedata til at gennemføre bookingen, til at kommunikere med gæsten og til at opfylde dine lovbestemte pligter (f.eks. registreringsblanket, turistskat, skatte- og opbevaringspligter).",
        "Enhver yderligere anvendelse — navnlig markedsføring, nyhedsbreve, videregivelse til tredjemand, optagelse i en egen gæsteliste til senere direkte bookinger — kræver et selvstændigt retsgrundlag, som regel gæstens samtykke.",
        "Du anvender ikke gæstedata til at få gæsten til at booke uden om platformen.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Dataminimering",
      paragraphs: [
        "Du indsamler kun de oplysninger, du faktisk har brug for. Kopier af legitimation anmoder du kun om, når en retsforskrift kræver det, og opbevarer dem kun, så længe forskriften foreskriver.",
        "Betalingsoplysninger anmoder du ikke om. Betalinger går via platformen.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Sikkerhed",
      paragraphs: [
        "Du beskytter gæstedata med passende tekniske og organisatoriske foranstaltninger — adgang kun for personer, der har brug for oplysningerne, beskyttede enheder, krypteret overførsel.",
        "Anvender du medarbejdere, rengøringspersonale eller medværter, pålægger du dem tavshedspligt og giver dem kun de oplysninger, de har brug for til deres opgave.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Opbevaring og sletning",
      paragraphs: [
        "Du sletter gæstedata, så snart formålet er bortfaldet, og der ikke længere består en opbevaringspligt.",
        "Registreringsblanketter og skattemæssigt relevante bilag opbevarer du så længe, som lovgivningen i dit land foreskriver — ikke længere.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Gæsternes rettigheder",
      paragraphs: [
        "Henvender en gæst sig til dig med en anmodning om indsigt, berigtigelse, sletning eller indsigelse, besvarer du den rettidigt. Vedrører den oplysninger, der ligger hos os, henviser du gæsten til os.",
        "Du oplyser dine gæster om, hvordan du behandler deres oplysninger, for så vidt du går ud over gennemførelsen af bookingen.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Brud på persondatasikkerheden",
      paragraphs: [
        "Sker der et brud på beskyttelsen af gæstedata, underretter du straks den kompetente tilsynsmyndighed og, hvor det er påkrævet, de berørte gæster.",
        "Vedrører bruddet oplysninger, du har modtaget via platformen, underretter du desuden os, så vi kan vurdere vores egne pligter.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kameraer og optageapparater",
      paragraphs: [
        "I indendørs rum med berettiget forventning om privatliv — soverum, badeværelser — er kameraer og mikrofoner ikke tilladt, heller ikke slukkede.",
        "Alle øvrige kameraer, bevægelsessensorer med optagelse, dørklokker med kamera og lydsensorer oplyser du i opslaget med angivelse af placeringen og af, hvad der optages.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Følger af overtrædelser",
      paragraphs: [
        "Overtrædelser af disse standarder behandler vi som overtrædelser af [Supplerende vilkår for værter](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) og kan træffe foranstaltninger indtil spærring af kontoen.",
      ],
    },
  ],
};
