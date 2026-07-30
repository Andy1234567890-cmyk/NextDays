import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reservationer & kalender",
  description: "Hold styr på reservationer og kalender.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reservationer & kalender",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Undgå dobbeltbookinger pålideligt",
          excerpt: "Sådan sikrer du, at en bolig aldrig bliver booket dobbelt.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "En bolig sælges samtidig via flere kanaler — portaler som Booking, Airbnb & Co., Platform og mobilappen. En dobbeltbooking opstår, når tilgængeligheden ikke bliver spærret rettidigt på én kanal, efter der er booket på en anden.",
            },
            {
              type: "steps",
              items: [
                "Kontrollér i belægningsplanen, at hver bolig udgør præcis én række med én bookbar enhed — ingen fælles kapacitet for flere værelser.",
                "Lad kun nye bookinger blive oprettet via belægningsplanen eller de tilkoblede kanaler, aldrig ved manuelt at markere enkelte dage.",
                "Kontrollér efter hver booking, at de bookede nætter straks fremstår som optaget i kalenderen.",
                "Brug straks stop-sell ved tekniske problemer eller vedligeholdelse i stedet for at lade dagen stå åben.",
                "Kontrollér reservationens bookings-tidslinje ved uklarheder for at følge det tidsmæssige forløb.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rør aldrig nætter eller spærringer manuelt uden om belægningsplanen — kun sådan er det sikret, at alle kanaler ser den samme tilgængelighedsstatus, og at der ikke opstår et hul, der giver plads til en dobbeltbooking.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Flyt en booking til en anden bolig",
          excerpt: "Sådan flytter du en eksisterende reservation korrekt til en anden bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Nogle gange skal en gæst flyttes fra én bolig til en anden, for eksempel på grund af en teknisk defekt eller efter gæstens ønske. Ved flytningen frigives de hidtidige kalendernætter automatisk og belægges på ny i målboligen.",
            },
            {
              type: "steps",
              items: [
                "Åbn den pågældende booking i bookings-tidslinjen.",
                "Vælg »Skift bolig« eller »Flyt« i handlingsmenuen.",
                "Vælg målboligen, og kontrollér dens tilgængelighed i den valgte periode.",
                "Bekræft flytningen.",
                "Kontrollér derefter i belægningsplanen, at de gamle nætter i den oprindelige bolig igen vises som tilgængelige.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Frigivelsen af de gamle nætter overtager systemet automatisk — du behøver ikke selv manuelt åbne den oprindelige periode. Informér gæsten om boligskiftet, især hvis udstyr eller adgang er forskellig.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Opret en langtidsbooking",
          excerpt: "Sådan opretter du korrekt en reservation over en længere periode.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "For langtidsgæster — for eksempel over flere uger eller måneder — opretter du en reservation som normalt, men skal desuden være opmærksom på minimumsophold, betalingsregler og boligens kanal-synlighed i hele perioden.",
            },
            {
              type: "steps",
              items: [
                "Åbn belægningsplanen for den ønskede bolig, og markér hele perioden.",
                "Opret bookingen med gæstens oplysninger samt planlagt ankomst- og afrejsedato.",
                "Opsæt om nødvendigt en betalingsregel med depositum og restbeløb i stedet for at gøre hele beløbet forfaldent med det samme.",
                "Kontrollér, at ingen minimums- eller maksimumsopholdsregel er i modstrid med den lange periode.",
                "Gem bookingen, og kontrollér, at hele perioden fremstår korrekt som optaget i kalenderen.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ved meget lange ophold anbefales en restbetaling i flere delbeløb i stedet for én stor forfaldsdato — sådan holdes betalingsrisikoen overskuelig. Læs mere under [Automatisér restbetalingen](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
