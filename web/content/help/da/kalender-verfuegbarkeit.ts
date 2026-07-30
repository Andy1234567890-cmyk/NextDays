import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalender & tilgængelighed",
  description: "Belægningsplan, stop-sell og minimumsophold.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalender",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Sådan læser du belægningsplanen",
          excerpt: "Sådan læser du reservationer, tilgængelighed og priser korrekt i belægningsplanen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Belægningsplanen viser dig med ét blik, hvilke nætter der er booket, tilgængelige eller spærrede. For feriehuse ser du én linje pr. bolig, for hoteller en indlejret visning med én linje pr. værelseskategori og rateplan.",
            },
            { type: "h2", text: "Visningens opbygning" },
            {
              type: "steps",
              items: [
                "Åbn kalenderen via menupunktet »Belægningsplan«.",
                "Vælg den periode, du vil se, øverst.",
                "Filtrer om nødvendigt efter enkelte boliger eller værelseskategorier.",
                "Klik på en dag for at åbne detaljer om pris og tilgængelighed.",
                "Klik på en optaget periode for at åbne den tilhørende reservation.",
              ],
            },
            { type: "h2", text: "Farver og symboler" },
            {
              type: "ul",
              items: [
                "Optaget: perioden er reserveret af en booking.",
                "Tilgængelig: dagen kan bookes på alle aktive kanaler.",
                "Spærret: dagen kan ikke bookes på grund af stop-sell eller manuel blokering.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hver linje i belægningsplanen står for præcis én bookbar enhed — et værelse eller et feriehus. Der findes ingen container-linje for flere værelser på én gang.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mere om målrettet at åbne og lukke enkelte dage finder du under [Sæt tilgængelighed](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Sæt tilgængelighed",
          excerpt: "Åbn og luk enkelte dage eller perioder målrettet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Tilgængelighed bestemmer, om en bolig kan bookes på en bestemt dag. Du kan åbne eller lukke enkelte dage eller hele perioder direkte i belægningsplanen.",
            },
            { type: "h2", text: "Rediger periode" },
            {
              type: "steps",
              items: [
                "Åbn belægningsplanen for den ønskede bolig.",
                "Marker den ønskede periode ved at klikke og trække.",
                "Vælg »Rediger tilgængelighed« i handlingsmenuen.",
                "Bekræft, om perioden skal åbnes eller lukkes.",
                "Gem ændringen.",
              ],
            },
            { type: "h2", text: "Effekt på kanaler" },
            {
              type: "p",
              text: "En ændring af tilgængelighed påvirker alle salgskanaler, hvor boligen er synlig: portaler som Booking, Airbnb & Co., den egne Platform samt appen. Overførslen til portalerne sker automatisk i baggrunden.",
            },
            {
              type: "ul",
              items: [
                "Åbn: dagen bliver bookbar på alle aktive kanaler.",
                "Luk: dagen forsvinder fra muligheden for booking, men forbliver synlig i kalenderen.",
                "Allerede eksisterende reservationer påvirkes ikke af en ændring af tilgængelighed.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Luk ikke en periode med det formål at spærre den helt og permanent for salg — til det er stop-sell den rigtige funktion, se [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-sell",
          excerpt: "Stop-sell spærrer en dag øjeblikkeligt på alle salgskanaler samtidig.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Stop-sell er den hurtigste måde at tage en enkelt dag helt ud af salg på. I modsætning til en almindelig ændring af tilgængelighed virker stop-sell hårdt og øjeblikkeligt på alle kanaler samtidig — på portalerne, den egne Platform og i appen.",
            },
            { type: "h2", text: "Aktivér stop-sell" },
            {
              type: "steps",
              items: [
                "Åbn belægningsplanen for den berørte bolig.",
                "Vælg den ønskede dag eller periode.",
                "Klik på »Aktivér stop-sell« i handlingsmenuen.",
                "Bekræft spærringen.",
              ],
            },
            { type: "h2", text: "Hvornår stop-sell er hensigtsmæssigt" },
            {
              type: "ul",
              items: [
                "Kortsigtet vedligeholdelse eller tekniske problemer i boligen.",
                "Et særtilfælde, hvor du øjeblikkeligt og uden undtagelse ikke ønsker nye reservationer.",
                "En hurtig nødspærring på tværs af hele platformen, uden at skulle behandle hver kanal enkeltvis.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell kender ingen kanalspecifik undtagelse: Er en dag spærret, kan ingen gæst booke via nogen kanal, heller ikke via receptionen eller en direkte forespørgsel.",
            },
            {
              type: "note",
              variant: "info",
              text: "Til permanent egen brug eller planlagt vedligeholdelse egner [Manuel blokering](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung) sig i stedet.",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimums- og maksimumsophold",
          excerpt: "Hvor længe gæster mindst eller højst må booke.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Med minimums- og maksimumsophold fastlægger du, hvor mange nætter en gæst mindst eller højst kan booke for en given ankomstdag. Det hjælper med at undgå korte hulreservationer eller målrettet positionere din bolig til længere ophold.",
            },
            { type: "h2", text: "Opsæt regel" },
            {
              type: "steps",
              items: [
                "Åbn belægningsplanen eller fanen »Priser« i boligen.",
                "Vælg den berørte periode.",
                "Angiv det mindste antal nætter under »Minimumsophold«.",
                "Angiv eventuelt et maksimalt antal nætter under »Maksimumsophold«.",
                "Gem reglen.",
              ],
            },
            { type: "h2", text: "Typiske anvendelsestilfælde" },
            {
              type: "ul",
              items: [
                "Højsæson: højere minimumsophold for at samle skiftedage.",
                "Lavsæson: lavere minimumsophold for at muliggøre flere reservationer.",
                "Maksimumsophold: hensigtsmæssigt, når en bolig bagefter skal være ledig til vedligeholdelse eller anden brug.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reglen gælder for ankomstdagen: En gæst kan ikke ankomme til en dag med minimumsophold på tre nætter for kun to nætter, selv om de enkelte dage er tilgængelige.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinér længere minimumsophold med [Opholdsrabatter](/hilfe/preise-raten/aufenthaltsrabatte) for at øge incitamentet for gæster.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Manuel blokering",
          excerpt: "Reservér perioder målrettet til egen brug eller vedligeholdelse.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "En manuel blokering reserverer en periode i kalenderen, uden at der foreligger en reel gæstereservation — for eksempel til egen brug, planlagt vedligeholdelse eller renovering. Perioden vises i belægningsplanen som en booking, men er tydeligt genkendelig som en blokering.",
            },
            { type: "h2", text: "Opret blokering" },
            {
              type: "steps",
              items: [
                "Åbn belægningsplanen for den berørte bolig.",
                "Marker den ønskede periode.",
                "Vælg »Bloker manuelt« i handlingsmenuen.",
                "Angiv en årsag, f.eks. »Egen brug« eller »Vedligeholdelse«.",
                "Gem blokeringen.",
              ],
            },
            { type: "h2", text: "Forskel til stop-sell" },
            {
              type: "p",
              text: "En manuel blokering reserverer konkret en periode til et bestemt, dokumenteret formål og kan frigives igen senere. Til en øjeblikkelig nødspærring på tværs af hele platformen uden dokumenteret periode er stop-sell derimod beregnet.",
            },
            {
              type: "ul",
              items: [
                "Manuel blokering: planlagt, med årsag, til egen brug eller vedligeholdelse.",
                "Frigivelse er mulig til enhver tid, så snart perioden ikke længere er nødvendig.",
                "Blokerede nætter tæller ikke som en gæstereservation og vises ikke i omsætningsoversigten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Slet en manuel blokering, så snart årsagen bortfalder — ellers forbliver boligen unødvendigt spærret på alle kanaler.",
            },
            {
              type: "note",
              variant: "info",
              text: "Til en øjeblikkelig spærring uden planlagt periode bruger du [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
