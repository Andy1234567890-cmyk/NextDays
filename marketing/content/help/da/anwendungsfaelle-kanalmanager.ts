import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanalstyring",
  description: "Bliv fortrolig med portaler og kanalstyring.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanalstyring",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Tilslut dit første portal",
          excerpt: "Sådan aktiverer du et portal for en bolig for første gang.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: Du har oprettet en bolig, men endnu ikke tilsluttet et portal",
            },
            {
              type: "p",
              text: "Din bolig er fuldt oprettet i myNextDays, men endnu ikke synlig på noget portal som Booking.com eller Airbnb. Før et portal kan modtage en bolig, skal din konto have en kontobred portalforbindelse én gang — derefter er kun en mapping nødvendig for hver yderligere bolig.",
            },
            {
              type: "steps",
              items: [
                "Åbn /konto, afsnittet »Portaler & kanalstyring«, og opsæt den kontobrede forbindelse med dine virksomhedsoplysninger",
                "Åbn derefter boligen under /objekte, og skift til fanen »Portaler«",
                "Vælg det ønskede portal, og tilknyt det til den relevante værelses- eller udbudstype",
                "Kontrollér fotos, faciliteter, priser og afbestillingsbetingelser — portalerne kræver fuldstændige oplysninger",
                "Aktivér synligheden; status skifter til »Tilsluttet«, når portalet har gennemført kontrollen",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Du opsætter kun den kontobrede forbindelse én gang. Se detaljer under [Tilslut Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) og [Tilslut Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Tilslut Booking.com",
          excerpt: "Sådan gør du en bolig bookbar på Booking.com via kanalstyringen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: Din bolig skal desuden være synlig på Booking.com",
            },
            {
              type: "p",
              text: "Booking.com er et af de portaler, der tilsluttes via kanalstyringen. Forudsætningen er den kontobrede portalforbindelse — er den allerede opsat, skal du kun bruge en mapping pr. bolig for Booking.com.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, fanen »Portaler«",
                "Vælg »Booking.com« fra listen over tilgængelige portaler",
                "Tilknyt den relevante værelses- eller udbudstype, og bekræft mindst én rate med pris og afbestillingsbetingelser",
                "Angiv en gyldig betalingsmetode til provisionsafregningen",
                "Aktivér synligheden for Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Godkendelsen fra Booking.com kan tage nogle timer. Status på fanen »Portaler« viser det, så snart forbindelsen er aktiv.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Tilslut Airbnb",
          excerpt: "Sådan gør du en bolig bookbar på Airbnb via kanalstyringen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: Din bolig skal desuden være synlig på Airbnb",
            },
            {
              type: "p",
              text: "Airbnb tilsluttes ligesom ethvert andet portal via den kontobrede forbindelse. Når den er opsat, aktiverer du Airbnb pr. bolig via en mapping — uafhængigt af, om boligen allerede er synlig på Booking.com eller andre portaler.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, fanen »Portaler«",
                "Vælg »Airbnb« fra listen over tilgængelige portaler",
                "Bekræft boligkategori og den tilknyttede udbudstype",
                "Tilføj fotos, faciliteter og husregler — Airbnb kræver fuldstændige oplysninger før godkendelse",
                "Aktivér synligheden for Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden angivne afbestillingsbetingelser og husregler afviser Airbnb godkendelsen. Tilføj først disse oplysninger i boligen.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Hold priserne synkroniseret på tværs af alle portaler",
          excerpt: "Én kalender er nok — kanalstyringen fordeler automatisk prisændringer til alle portaler.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: Du ændrer en pris og vil sikre, at den er korrekt overalt",
            },
            {
              type: "p",
              text: "Du vedligeholder priser udelukkende i myNextDays-kalenderen for boligen — aldrig enkeltvis i selve portalerne. Kanalstyringen overfører automatisk hver ændring til alle portaler, som boligen er aktivt mappet til.",
            },
            {
              type: "steps",
              items: [
                "Åbn priskalenderen eller rateplanerne for boligen",
                "Justér dagsprisen, minimumsopholdet eller ankomst-/afrejsebegrænsningen",
                "Gem ændringen — den slår først igennem internt i boligen",
                "Kontrollér på fanen »Portaler«, at alle ønskede portaler stadig er aktivt mappet",
                "Vent et par minutter, indtil ændringen er overført til portalerne",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Indtast aldrig priser direkte i portalet — sådanne ændringer bliver overskrevet af myNextDays-kalenderen ved næste synkronisering.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importér en portalreservation",
          excerpt: "Portalreservationer havner automatisk i kalenderen — her kontrollerer du, at importen er lykkedes.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: En gæst har booket via et portal, og reservationen skal ankomme i myNextDays",
            },
            {
              type: "p",
              text: "Booker en gæst via Booking.com, Airbnb eller et andet tilsluttet portal, importerer kanalstyringen reservationen automatisk — du behøver ikke overføre noget manuelt. Dette forløb beskriver, hvordan du sporer og bekræfter importen.",
            },
            {
              type: "steps",
              items: [
                "Åbn kalenderen eller reservationslisten for den pågældende bolig",
                "Find den nye reservation — den har et kildemærke fra portalet, f.eks. Booking.com eller Airbnb",
                "Kontrollér, at gæsteoplysninger, periode og pris er fuldstændige",
                "Kontrollér, at de bookede nætter vises som spærrede på alle andre kanaler",
                "Åbn om nødvendigt reservationsdetaljerne for at behandle ekstraydelser eller beskeder fra gæsten",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Annullerer gæsten via portalet eller ændrer perioden, overtages det også automatisk, og nætterne frigives igen.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Løs en dobbeltbooking",
          excerpt: "Sådan går du frem, hvis den samme nat undtagelsesvis er blevet solgt på to kanaler.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: To reservationer overlapper for samme bolig og samme nætter",
            },
            {
              type: "p",
              text: "Kanalstyringen spærrer normalt bookede nætter øjeblikkeligt på tværs af alle kanaler. Alligevel kan en dobbeltbooking opstå, f.eks. ved samtidige bookinger på to portaler i samme øjeblik, eller ved en manuelt oprettet reservation, der kolliderer med en portalreservation.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligens kalender, og identificér begge overlappende reservationer",
                "Kontrollér bookingtidspunkt og kildemærke for begge reservationer",
                "Kontakt den gæst, hvis booking kom ind sidst, og tilbyd en alternativ bolig eller periode",
                "Annullér den reservation, der ikke kan opretholdes, i det pågældende portal — ikke kun i myNextDays",
                "Sæt derefter stop-sell for de pågældende nætter, indtil sagen er fuldt afklaret",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Annullér altid en portalreservation via selve portalet — en annullering kun i myNextDays frigiver ganske vist natten internt, men informerer ikke portalet pålideligt.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Sæt et portal midlertidigt på pause",
          excerpt: "Slå synligheden fra for det enkelte portal uden at miste mappingen.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: En bolig skal midlertidigt ikke være bookbar på et portal",
            },
            {
              type: "p",
              text: "Synligheden kan slås til og fra for hvert portal for sig — uafhængigt af hjemmeside og Platform-markedsplads. Vil du f.eks. sætte Airbnb på pause kortvarigt, men lade Booking.com fortsætte, deaktiverer du udelukkende denne ene kanal.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, fanen »Portaler«",
                "Find posten for det portal, du vil sætte på pause",
                "Slå synligheden fra for dette portal",
                "Gem — ændringen slår igennem inden for få minutter, og boligen forsvinder fra dette portals søgeresultater",
                "Slå synligheden til igen, så snart boligen skal være bookbar igen",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mappingen bevares, når du sætter på pause — du skal ikke oprette tilknytningen til portalet igen senere. Til en fuldstændig spærring af alle kanaler bruger du i stedet stop-sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Kontrollér boligens mapping",
          excerpt: "Sådan kontrollerer du, om din bolig stadig er korrekt tilknyttet den rigtige udbudstype i portalet.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: Priser eller tilgængelighed stemmer ikke længere overens mellem et portal og myNextDays",
            },
            {
              type: "p",
              text: "Afviger visningen i portalet fra din myNextDays-kalender, skyldes det ofte en fejlbehæftet eller afbrudt mapping — tilknytningen mellem din bolig og værelses- eller udbudstypen i portalet.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, fanen »Portaler«",
                "Kontrollér status for det pågældende portal — den bør vise »Tilsluttet«, ikke »Fejl« eller »Afventer«",
                "Kontrollér, om den tilknyttede værelses- eller udbudstype i portalet stadig svarer til den faktiske bolig",
                "Ved afvigelse: Fjern mappingen, opret den igen, og aktivér derefter synligheden på ny",
                "Vent et par minutter efter korrektionen, og kontrollér priser og tilgængelighed i portalet igen",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "En bolig kan være tilknyttet flere portaler samtidig — kontrollér ved uoverensstemmelser målrettet det ene berørte portal, ikke alle på én gang.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Forskellige rater pr. portal",
          excerpt: "Sådan tildeler du et portal en egen rateplan uden at påvirke de øvrige kanaler.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: Du vil tilbyde en anden pris på et portal end på de øvrige kanaler",
            },
            {
              type: "p",
              text: "Rateplaner kan tilknyttes enkeltvis pr. portal, f.eks. en ikke-refunderbar rateplan til et portal og en fleksibel til et andet. Grundpriserne vedligeholdes fortsat centralt i boligen, og mappingen bestemmer, hvilken rateplan der går til hvilket portal.",
            },
            {
              type: "steps",
              items: [
                "Opret den ekstra rateplan i boligen med de ønskede betingelser (pris, afbestillingsbetingelser, minimumsophold)",
                "Åbn fanen »Portaler«, og vælg det pågældende portal",
                "Tilknyt den nye rateplan til dette portal i mappingen",
                "Lad de øvrige portaler forblive uændrede på deres nuværende rateplan",
                "Gem, og kontrollér prisvisningen i det pågældende portal efter få minutter",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hver rateplan overføres uafhængigt — en ændring i én rateplan påvirker ikke portaler, der er tilknyttet en anden rateplan.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Løs almindelige portalfejl",
          excerpt: "Typiske årsager, når et portal afviser en bolig, eller synkroniseringen går i stå.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt: Status for et portal viser en fejl, eller boligen bliver ikke overtaget",
            },
            {
              type: "p",
              text: "Portaler afviser typisk en forbindelse på grund af manglende stamdata eller ufuldstændige boligoplysninger. Gennemgå de mest almindelige årsager i rækkefølge, før du kontakter support.",
            },
            {
              type: "steps",
              items: [
                "Kontrollér under /konto, om adresse, skatteoplysninger og kontaktoplysninger er fuldstændigt angivet",
                "Kontrollér i boligen, om beskrivelse, fotos, faciliteter og mindst én rate er fuldstændige",
                "Kontrollér, om der er angivet en gyldig betalingsmetode til provisioner",
                "Åbn fanen »Portaler«, og læs den præcise fejlmeddelelse ved det pågældende portal",
                "Ret den angivne mangel, og aktivér synligheden igen",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En portalfejl vedrører altid kun dette ene portal — de øvrige kanaler fortsætter uafhængigt, så længe deres egne krav er opfyldt.",
            },
          ],
        },
      ],
    },
  ],
};
