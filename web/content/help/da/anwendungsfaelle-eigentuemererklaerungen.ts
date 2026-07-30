import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Ejererklæringer",
  description: "Opret ejererklæringer.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Ejererklæringer",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Generér en ejeropgørelse",
          excerpt: "Sådan opretter du en overskuelig afregning for en ejers periode.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Administrerer du boliger for ejere, har de regelmæssigt brug for et gennemsigtigt overblik over indtægter, fratrukket provision og udbetaling for deres boliger i en given periode — ejeropgørelsen samler automatisk disse data.",
            },
            {
              type: "steps",
              items: [
                "Åbn afsnittet Ejere i kontoen, og vælg den pågældende ejer.",
                "Vælg den afregningsperiode, opgørelsen skal oprettes for.",
                "Kontrollér, at alle denne ejers boliger er korrekt tilknyttet, da kun tilknyttede boliger indgår i opgørelsen.",
                "Generér opgørelsen, og kontrollér, at de opførte reservationer er fuldstændige.",
                "Gør opgørelsen tilgængelig for ejeren via ejeradgangen, eller eksportér den som dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Opgørelsen viser hver reservation med beløb i boligens respektive valuta — der findes ingen generel valutaangivelse, da flere boliger også kan have forskellige valutaer. Mere om tilknytning under [Tilknyt en bolig til en ejer](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Afregn provision med ejeren",
          excerpt: "Sådan sikrer du, at din provision beregnes korrekt ud fra ejerens indtægter.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Din provision for administrationen af en bolig er angivet i ejerens tarif og trækkes automatisk fra bruttoindtægterne ved hver opgørelse. For at afregningen stemmer, skal provisionssatsen være korrekt fastlagt, inden den første reservation i perioden.",
            },
            {
              type: "steps",
              items: [
                "Åbn tariffen for den pågældende ejer i kontoen, og kontrollér den angivne provisionssats.",
                "Justér satsen om nødvendigt, før nye reservationer kommer ind i den kommende afregningsperiode.",
                "Generér ejeropgørelsen for perioden, og kontrollér, at provisionen vises korrekt for hver reservation.",
                "Kontrollér, at summen af bruttoindtægter, fratrukket provision og nettoudbetaling er plausibel.",
                "Afklar afvigelser direkte med ejeren, før opgørelsen frigives, i stedet for at ændre opgørelsen efterfølgende.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En efterfølgende ændring af provisionssatsen virker kun på fremtidige perioder, ikke tilbagevirkende på allerede genererede opgørelser. Kontrollér derfor satsen i god tid før starten på en ny afregningsperiode — se også [Ejerafregning (opgørelse)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
