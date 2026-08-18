import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Afbestillingsvilkår",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Enhver udbyder vælger et afbestillingsvilkår for sin indkvartering. Hvilket der gælder, fremgår af opslaget og af din bookingbekræftelse. Denne side beskriver de vilkår, vi stiller til rådighed for udbydere.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Afbestillingsvilkårene i overblik",
      paragraphs: [
        "Afgørende er altid det vilkår, der er angivet i opslaget. Fristerne regnes fra begyndelsen af ankomstdagen i indkvarteringens lokale tid.",
      ],
      list: [
        "Fleksibel — gratis afbestilling indtil 24 timer før ankomst. Derefter beregnes den første nat, de øvrige nætter refunderes.",
        "Moderat — gratis afbestilling indtil 5 dage før ankomst. Derefter beregnes 50 % af overnatningsprisen.",
        "Streng — gratis afbestilling indtil 14 dage før ankomst, forudsat at bookingen skete mindst 14 dage før ankomst. Derefter beregnes 50 % indtil 7 dage før ankomst, herefter den fulde pris.",
        "Ikke-refunderbar — ingen gratis afbestilling. Prisen er som regel lavere; på den manglende refusion gør vi særskilt opmærksom før bookingen.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Hvad der refunderes i alle tilfælde",
      paragraphs: [
        "Uanset det valgte vilkår refunderer vi ved enhver afbestilling:",
      ],
      list: [
        "turistskat og andre gennemløbsafgifter, for så vidt de er afregnet via platformen, og overnatningen ikke finder sted;",
        "et depositum opkrævet via platformen, fuldt ud;",
        "tillægsydelser, der ikke er leveret.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Afbestilling fra udbyderens side",
      paragraphs: [
        "Afbestiller udbyderen, får du det beløb, der er betalt via platformen, fuldt ud tilbage — uanset det valgte afbestillingsvilkår.",
        "Desuden hjælper vi dig med at finde en sammenlignelig indkvartering; se [Ombookings- og refusionspolitik](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Ingen lovbestemt fortrydelsesret",
      paragraphs: [
        "Ved overnatningsydelser, der bookes for en bestemt periode, består der som udgangspunkt ingen lovbestemt fortrydelsesret efter artikel 16, litra l), i direktiv 2011/83/EU. De her beskrevne afbestillingsvilkår er derfor et aftalemæssigt tilsagn, ikke en gennemførelse af en fortrydelsesret.",
        "Ufravigelige lovbestemte rettigheder, navnlig mangelsbeføjelser ved mangler ved indkvarteringen, berøres ikke.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Ændring i stedet for afbestilling",
      paragraphs: [
        "Ønsker du at ændre perioden eller antallet af rejsende, anmoder du om ændringen via din booking. Udbyderen skal acceptere; indtil da består den oprindelige booking.",
        "Fører ændringen til en højere pris, forfalder differencen. Fører den til en lavere pris, refunderer vi differencen, for så vidt det gældende afbestillingsvilkår tillader det for den bortfaldende del.",
      ],
    },
    {
      id: "wie",
      heading: "6. Sådan afbestiller du",
      paragraphs: [
        "Afbestil via din konto under „Bookinger“. Afgørende for fristen er det tidspunkt, hvor afbestillingen når frem til os.",
        "Du modtager en afbestillingsbekræftelse med refusionsbeløbet. Om udbetaling se [Betalingsvilkår](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
