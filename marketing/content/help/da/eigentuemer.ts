import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Ejere & afregninger",
  description: "Ejerkonti, afregninger og provisioner.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Ejere",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Opret ejer",
          excerpt: "Sådan opretter du en ny ejerkonto i myNextDays.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Ejere er selvstændige konti i myNextDays, hvorigennem du administrerer boliger, der tilhører en bestemt person eller et selskab. En ejerkonto får et begrænset, read-only indblik i sine egne boliger, uden selv at kunne foretage ændringer i virksomheden.",
            },
            { type: "h2", text: "Opret en ny ejerkonto" },
            {
              type: "steps",
              items: [
                "Åbn afsnittet »Ejere« i hovedmenuen.",
                "Klik på »Opret ny ejer«.",
                "Angiv navn, e-mailadresse og kontaktoplysninger.",
                "Registrer eventuelt fakturaadressen til brug for afregninger.",
                "Gem kontoen.",
              ],
            },
            { type: "h2", text: "Opsæt adgang" },
            {
              type: "p",
              text: "Efter oprettelsen kan du sende ejeren en invitation til egen adgang. Ejeren logger derefter ind med egne loginoplysninger og ser udelukkende de boliger, der er tilknyttet vedkommende.",
            },
            {
              type: "ul",
              items: [
                "En ejerkonto kan omfatte flere boliger.",
                "Hver bolig tilhører præcis én ejer.",
                "Kontaktoplysninger og fakturaadresse kan til enhver tid tilpasses efterfølgende.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hvordan du tilknytter en eksisterende bolig til en ejer, kan du læse under [Tilknyt bolig til en ejer](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Tilknyt bolig til en ejer",
          excerpt: "Hver bolig tilhører præcis én ejer — sådan opsætter du tilknytningen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "I myNextDays tilhører hver bolig præcis én ejer. En flertilknytning er ikke understøttet — skal en bolig tilhøre en anden ejer, skal du først ophæve den eksisterende tilknytning, før du opretter en ny.",
            },
            { type: "h2", text: "Foretag tilknytningen" },
            {
              type: "steps",
              items: [
                "Åbn boligen under »Boliger«.",
                "Skift til fanen »Ejer«.",
                "Vælg den ansvarlige ejer fra listen.",
                "Bekræft tilknytningen.",
                "Gem ændringen på boligen.",
              ],
            },
            { type: "h2", text: "Skift af ejer" },
            {
              type: "p",
              text: "Ændrer boligens ejer sig, for eksempel ved et salg, erstatter du den eksisterende tilknytning med den nye. Allerede oprettede afregninger for tidligere perioder forbliver knyttet til den oprindelige ejer.",
            },
            {
              type: "ul",
              items: [
                "En bolig kan på et givet tidspunkt kun være tilknyttet én ejer.",
                "Uden tilknytning fremgår boligen ikke i nogen ejeradgang.",
                "Tidligere afregninger forbliver hos den oprindelige ejer.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En flertilknytning af en bolig til flere ejere er udelukket — systemet tillader ikke en anden samtidig tilknytning.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Ejerafregning (opgørelse)",
          excerpt: "Sådan opretter du en opgørelse med indtægter fratrukket provision for en ejer.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Ejerafregningen, også kaldet en opgørelse, samler for en valgt periode alle indtægter fra de tilknyttede boliger og trækker din aftalte provision fra. Resultatet er det beløb, du udbetaler til ejeren.",
            },
            { type: "h2", text: "Opret opgørelse" },
            {
              type: "steps",
              items: [
                "Åbn afsnittet »Ejere«, og vælg den ønskede ejer.",
                "Skift til fanen »Afregning«.",
                "Vælg afregningsperioden.",
                "Gennemgå de opførte bookinger og indtægter pr. bolig.",
                "Lad opgørelsen oprette med provisionen fratrukket.",
              ],
            },
            { type: "h2", text: "Opgørelsens opbygning" },
            {
              type: "p",
              text: "En opgørelse viser pr. bolig bruttoindtægter fra bookinger, den fratrukne provision og det deraf resulterende udbetalingsbeløb. Ekstra omkostninger som rengøring eller gebyrer kan, afhængigt af aftalen, opføres separat.",
            },
            {
              type: "ul",
              items: [
                "Bruttoindtægter: summen af alle bookinger i perioden pr. bolig.",
                "Provision: din aftalte andel, trækkes fra indtægterne.",
                "Udbetalingsbeløb: indtægter fratrukket provision og eventuelt yderligere poster.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Beløb i opgørelsen angives altid i boligens valuta — der findes ingen generel valuta-fallback.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Opret opgørelser regelmæssigt på samme skæringsdato, så ejere har en pålidelig rytme for deres udbetalinger.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Ejeradgang",
          excerpt: "Hvad ejere kan se i deres read-only adgang.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Ejeradgangen er et separat, read-only login til myNextDays. Ejere ser her udelukkende de boliger, der er tilknyttet dem, samt de tilhørende belægninger og opgørelser — uden mulighed for selv at ændre indstillinger.",
            },
            { type: "h2", text: "Hvad ejere ser" },
            {
              type: "ul",
              items: [
                "Belægningskalender for deres egne boliger.",
                "Oprettede opgørelser med indtægter og fratrukket provision.",
                "Grunddata for deres boliger, f.eks. udstyr og beskrivelse.",
              ],
            },
            { type: "h2", text: "Aktiver adgang" },
            {
              type: "steps",
              items: [
                "Åbn ejeren under »Ejere«.",
                "Klik på »Inviter adgang«.",
                "Ejeren modtager en e-mail til oprettelse af egen adgangskode.",
                "Efter login ser ejeren automatisk kun sine tilknyttede boliger.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ejeradgangen er strengt read-only: priser, tilgængelighed eller boligdata kan kun ændres af dig som virksomhed, ikke af ejeren selv.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mere om tilknytning af boliger finder du under [Tilknyt bolig til en ejer](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
