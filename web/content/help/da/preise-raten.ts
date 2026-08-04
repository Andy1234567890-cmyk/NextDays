import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Priser & rater",
  description: "Rateplaner, sæsonpriser og dynamiske priser.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Prisfastsættelse",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Grundpris & valuta",
          excerpt: "Sådan fastsætter du grundprisen og tildeler den korrekte valuta til din bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Hver bolig i myNextDays er præcis én bookbar enhed — et enkelt værelse eller en feriebolig. For denne enhed angiver du en grundpris samt en central valuta, som gælder for hele boligen.",
            },
            { type: "h2", text: "Fastlæg valuta centralt" },
            {
              type: "p",
              text: "Boligvalutaen fastsættes én gang pr. bolig og gælder automatisk for alle rateplaner, du opretter for denne bolig. Der findes ingen separat valuta-fallback — mangler valutaen, kan du ikke gemme priser.",
            },
            {
              type: "steps",
              items: [
                "Åbn din bolig under »Boliger«.",
                "Skift til fanen »Priser«.",
                "Vælg den relevante valuta under »Boligvaluta«.",
                "Angiv grundprisen for standardbelægningen.",
                "Gem ændringerne.",
              ],
            },
            { type: "h2", text: "Hvad der sker ved en valutaændring" },
            {
              type: "p",
              text: "Ændrer du boligvalutaen senere, påvirker det alle eksisterende rateplaner for denne bolig, da de altid føres i boligvalutaen. Kontrollér dine priser bagefter, før du overfører dem til portalerne igen.",
            },
            {
              type: "ul",
              items: [
                "En bolig har præcis én valuta — ikke flere pr. rateplan.",
                "Grundprisen er udgangsværdien for afledte rater.",
                "Beløb vises altid med den registrerede boligvaluta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden en registreret valuta kan ingen pris gemmes, og ingen rate kan overføres til portaler. Kontrollér dette først, hvis en prisændring mislykkes.",
            },
            {
              type: "note",
              variant: "info",
              text: "Læs mere om afledte priser under [Afledte rater](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Opret rateplaner",
          excerpt: "Rateplaner samler pris, afbestillingsbetingelser og forplejning for en bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "En rateplan definerer, på hvilke betingelser en bolig kan bookes: pris, afbestillingsregler, forplejning og minimumsophold. En bolig kan tilbyde flere rateplaner samtidig, for eksempel en fleksibel og en ikke-refunderbar plan.",
            },
            { type: "h2", text: "Opret ny rateplan" },
            {
              type: "steps",
              items: [
                "Åbn boligen, og skift til fanen »Priser«.",
                "Klik på »Opret ny rateplan«.",
                "Giv den et sigende navn, f.eks. »Fleksibel« eller »Ikke-refunderbar«.",
                "Fastlæg, om planen er en basisrate eller en afledt rate.",
                "Angiv afbestillingsbetingelser og forplejning.",
                "Gem og aktivér rateplanen.",
              ],
            },
            { type: "h2", text: "Basisrate vs. øvrige rateplaner" },
            {
              type: "p",
              text: "Opret først din basisrate (ofte betegnet »BAR«, Best Available Rate). Alle øvrige rateplaner kan enten vedligeholdes selvstændigt eller afledes af denne basisrate.",
            },
            {
              type: "ul",
              items: [
                "Basisrate: manuelt vedligeholdt grundpris pr. nat.",
                "Øvrige rateplaner: selvstændige eller som tillæg/fradrag på basisraten.",
                "Hver rateplan kan overføres individuelt til portaler.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Hold antallet af rateplaner pr. bolig overskueligt — for mange varianter gør det sværere for gæster at sammenligne og øger vedligeholdelsesarbejdet.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detaljer om tillæg og fradrag finder du under [Afledte rater](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Afledte rater",
          excerpt: "Afledte rateplaner beregnes automatisk ud fra en basisrate.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "En afledt rate er en rateplan, hvis pris ikke vedligeholdes manuelt, men beregnes automatisk ud fra en basisrate — som et fast tillæg, fradrag eller en procentsats. Det sparer vedligeholdelsesarbejde, da en prisændring på basisraten automatisk opdaterer alle afledte planer.",
            },
            { type: "h2", text: "Typisk eksempel" },
            {
              type: "p",
              text: "Et almindeligt mønster er en plan med morgenmad, der afledes af basisraten uden forplejning: Morgenmadsprisen defineres som et tillæg pr. nat og person på basisraten. Ændrer du basisraten, tilpasses morgenmadsprisen automatisk.",
            },
            { type: "h2", text: "Opsæt afledt rate" },
            {
              type: "steps",
              items: [
                "Åbn den ønskede rateplan i fanen »Priser«.",
                "Vælg »Afledt af …« som priskilde og den tilhørende basisrate.",
                "Bestem, om forskellen gælder som et fast beløb eller en procentsats.",
                "Fastlæg, om der er tale om et tillæg eller et fradrag.",
                "Gem tilknytningen.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tillæg: f.eks. forplejning, senere afbestillingsmulighed.",
                "Fradrag: f.eks. ikke-refunderbar plan med prisfordel.",
                "Basisraten forbliver den eneste manuelt vedligeholdte kilde.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En afledt rate kan ikke samtidig overskrives manuelt. Ophæv først afledningen, hvis du vil sætte en enkelt pris afvigende.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Sæson- & weekendpriser",
          excerpt: "Tilpas priser for sæsonperioder og weekender målrettet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Efterspørgslen svinger hen over året og inden for ugen. Med sæson- og weekendpriser tilpasser du grundprisen for bestemte perioder eller ugedage uden at skulle ind i kalenderen for hver dag enkeltvis.",
            },
            { type: "h2", text: "Opret sæsonperiode" },
            {
              type: "steps",
              items: [
                "Åbn fanen »Priser« i boligen og området »Sæsonpriser«.",
                "Opret en ny periode med start- og slutdato.",
                "Angiv prisen eller den procentvise afvigelse fra grundprisen for denne periode.",
                "Gem sæsonperioden.",
              ],
            },
            { type: "h2", text: "Weekendpriser" },
            {
              type: "p",
              text: "Derudover kan du give enkelte ugedage, for eksempel fredag og lørdag, et eget tillæg. Dette tillæg virker oveni den til enhver tid gældende sæson- eller grundpris.",
            },
            {
              type: "ul",
              items: [
                "Sæsonpriser gælder for sammenhængende perioder.",
                "Weekendpriser gælder pr. ugedag, uafhængigt af sæsonen.",
                "Begge regler kan kombineres.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Overlapper flere sæsonperioder hinanden, gælder den senest oprettede eller mest specifikke regel. Kontrollér kalenderen efter gemning.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Til automatiske, efterspørgselsbaserede tilpasninger egner [Dynamiske priser](/hilfe/preise-raten/dynamische-preise) sig desuden.",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynamiske priser",
          excerpt: "Tilpas priser automatisk til efterspørgsel, bookingforspring og belægning.",
          updated: "Opdateret: august 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dynamiske priser er et betalt tilvalgsmodul. Du tilkøber det under “Udvidelser”, hvor prisen også står. Uden modulet beregner automatikken ingenting.",
            },
            {
              type: "p",
              text: "Dynamiske priser tilpasser automatisk grundprisen ud fra faktorer som bookingforspring, aktuel belægning og efterspørgsel — på samme måde som store portaler gør med deres egne prisanbefalinger. Sådan reagerer du på markedsændringer uden at skulle justere manuelt hver dag.",
            },
            { type: "h2", text: "Aktivér dynamiske priser" },
            {
              type: "steps",
              items: [
                "Tilkøb modulet under »Værktøjer → Udvidelser« — uden modulet beregner automatikken ikke.",
                "Åbn »Distribution → Dynamisk prissætning« i hovedmenuen.",
                "Klik på blyantikonet ud for den ønskede bolig i oversigten (»Fastsæt basispris«).",
                "Vælg strategien for basisprisen: datadrevet eller en fast basispris.",
                "Fastsæt en minimums- og maksimumpris, og bestem med »Belægningsfølsomhed (%)«, hvor meget belægningen må påvirke prisen.",
                "Slå »Dynamiske priser aktive« til, og gem.",
              ],
            },
            { type: "h2", text: "Grænser og sikkerhed" },
            {
              type: "p",
              text: "Prismindstegrænse og prismaksimumsgrænse forhindrer, at den automatiske algoritme sætter priser, der ikke er bæredygtige for din virksomhed. Afledte rateplaner følger automatisk den dynamisk beregnede basisrate.",
            },
            {
              type: "ul",
              items: [
                "Prismindstegrænse beskytter mod for lave priser ved svag efterspørgsel.",
                "Prismaksimumsgrænse beskytter mod overdrevne priser ved høj efterspørgsel.",
                "Afledte rater overtager automatisk den nye basisrate.",
                "En dagspris, der er sat manuelt i kalenderen, har altid forrang for automatikken.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynamiske priser virker kun på basisraten. Manuelt fastsatte rateplaner uden afledning ændres ikke automatisk med.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Opholdsrabatter",
          excerpt: "Opsæt rabatter for længere ophold og tidlige bookinger.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Opholdsrabatter belønner gæster for længere bookinger eller tidlig booking. De anvendes som en procentsats på den samlede pris for opholdet og kan konfigureres uafhængigt pr. bolig.",
            },
            { type: "h2", text: "Rabattyper" },
            {
              type: "ul",
              items: [
                "Langtidsrabat: fra et bestemt antal nætter, f.eks. fra 7 eller 28 nætter.",
                "Tidligbookingrabat: ved booking tilstrækkeligt langt i forvejen.",
                "Sidste-øjeblik-rabat: ved kortvarig booking tæt på ankomstdatoen.",
              ],
            },
            { type: "h2", text: "Opsæt rabat" },
            {
              type: "steps",
              items: [
                "Åbn fanen »Priser« i boligen og området »Rabatter«.",
                "Vælg den ønskede rabattype.",
                "Fastlæg tærsklen, f.eks. minimumsnætter eller forspring.",
                "Angiv rabatten i procent.",
                "Gem reglen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Rabatter virker på totalprisen for den pågældende rateplan og vises for gæsten allerede i prisoversigten.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinér langtidsrabatter med [Minimums- & maksimumsophold](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) for målrettet at fremme længere bookinger.",
            },
          ],
        },
      ],
    },
  ],
};
