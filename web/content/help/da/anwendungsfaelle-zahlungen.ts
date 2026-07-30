import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Betalinger",
  description: "Håndter betalinger korrekt.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Betalinger",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Opsæt en forudbetaling",
          excerpt: "Sådan opkræver du kun et delbeløb ved reservationen i stedet for hele beløbet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "I stedet for at opkræve hele reservationsbeløbet med det samme kan du fastlægge en forudbetaling som betalingsregel. Gæsten betaler ved reservationen kun et delbeløb via Stripe eller PayPal, resten senere via en restbetaling.",
            },
            {
              type: "steps",
              items: [
                "Åbn afsnittet »Betalingsregler« i boligen.",
                "Opret en ny regel af typen »Forudbetaling«.",
                "Fastlæg forudbetalingsbeløbet som en procentdel eller et fast beløb af totalsummen.",
                "Fastlæg, hvornår forudbetalingen forfalder, som regel umiddelbart ved reservationen.",
                "Gem reglen, og test den med en testreservation.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Forudbetalingen håndteres via den betalingsudbyder, der er tilknyttet boligen. Det tilhørende restbeløb opsætter du under [Automatisér restbetalingen](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatisér restbetalingen",
          excerpt: "Sådan opkræves det resterende beløb automatisk før ankomst.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Efter en forudbetaling er der stadig et resterende beløb. I stedet for at følge dette manuelt op, opsætter du en betalingsregel, der automatisk opkræver restbetalingen på et fast tidspunkt før ankomst via Stripe eller PayPal.",
            },
            {
              type: "steps",
              items: [
                "Åbn afsnittet »Betalingsregler« i boligen.",
                "Opret en ny regel af typen »Restbetaling«, forudsat at der allerede findes en forudbetalingsregel.",
                "Fastlæg, hvor mange dage før ankomst restbetalingen forfalder.",
                "Aktivér den automatiske opkrævning, så den tilknyttede betalingsudbyder trækker beløbet selvstændigt.",
                "Kontrollér derefter status for restbetalingen i reservationens tidslinje.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Hvis den automatiske opkrævning mislykkes, f.eks. på grund af et udløbet kort, bliver reservationen ikke automatisk annulleret. Kontrollér mislykkede restbetalinger hurtigt, og kontakt gæsten direkte.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Gennemfør en tilbagebetaling",
          excerpt: "Sådan refunderer du et beløb helt eller delvist til en gæst.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Ved en annullering eller reklamation kan du refundere det betalte beløb helt eller delvist til en gæst. Tilbagebetalingen sker via den samme betalingsudbyder, som den oprindelige betaling blev foretaget med — Stripe eller PayPal.",
            },
            {
              type: "steps",
              items: [
                "Åbn den pågældende reservation i reservationens tidslinje.",
                "Vælg den oprindelige betaling, der skal refunderes, i afsnittet »Betalinger«.",
                "Vælg mellem fuld eller delvis tilbagebetaling.",
                "Angiv det ønskede beløb ved en delvis tilbagebetaling.",
                "Bekræft tilbagebetalingen, og kontrollér den opdaterede betalingsstatus i tidslinjen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "En tilbagebetaling ændrer ikke automatisk reservationsstatus eller de belagte kalendernætter. Kontrollér ved en annullering desuden, om de pågældende nætter skal frigives igen i belægningsplanen.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Administrér et depositum",
          excerpt: "Sådan opsætter du et depositum og frigiver det igen efter opholdet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Et depositum sikrer dig mod skader under opholdet. Det oprettes som en selvstændig betalingsregel og enten forhåndsautoriseres eller opkræves via Stripe eller PayPal, afhængigt af boligens konfiguration.",
            },
            {
              type: "steps",
              items: [
                "Åbn afsnittet »Betalingsregler« i boligen, og opret en regel af typen »Depositum«.",
                "Fastlæg depositumbeløbet og tidspunktet for autorisationen, normalt kort før ankomst.",
                "Kontrollér boligens tilstand efter udtjekning.",
                "Frigiv depositummet fuldt ud via reservationen, hvis alt er i orden.",
                "Refundér ved en skade kun den del, der ikke er nødvendig, og dokumentér årsagen til tilbageholdelsen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Et autoriseret, men ikke opkrævet depositum udløber automatisk efter en vis frist, afhængigt af betalingsudbyderen. Frigiv depositummet hurtigt efter udtjekning, eller opkræv det nødvendige beløb i tide.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Korrigér en faktura",
          excerpt: "Sådan korrigerer du en allerede udstedt faktura efterfølgende.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Hvis en allerede udstedt faktura indeholder en fejl, f.eks. i fakturaadressen eller en post, korrigerer du den via reservationen i stedet for blot at slette den oprindelige faktura.",
            },
            {
              type: "steps",
              items: [
                "Åbn den pågældende reservation i reservationens tidslinje, og skift til afsnittet »Fakturaer«.",
                "Vælg den fejlbehæftede faktura.",
                "Opret en korrektions- eller kreditnota til den oprindelige faktura.",
                "Opret derefter en ny, korrigeret faktura med de korrekte oplysninger.",
                "Send den korrigerede faktura igen til gæsten eller fakturaadressen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Af hensyn til sporbarheden bør en allerede afsendt faktura ikke overskrives direkte. Korrektionen via en kreditnota bevarer det oprindelige bilag og gør ændringen sporbar.",
            },
          ],
        },
      ],
    },
  ],
};
