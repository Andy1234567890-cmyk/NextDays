import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portaler & kanalstyring",
  description: "Styr Booking, Airbnb, Expedia & Co. centralt.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Tilslut portaler",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Hvad er kanalstyringen?",
          excerpt:
            "Kanalstyringen synkroniserer automatisk priser, tilgængelighed og bookinger mellem myNextDays og portalerne.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Én forbindelse til alle portaler" },
            {
              type: "p",
              text: "Kanalstyringen er broen mellem myNextDays og de store bookingportaler som Booking, Airbnb & Co. I stedet for at vedligeholde priser, tilgængelighed og belægning enkeltvis i hvert portal, indtaster du alt én gang i myNextDays — kanalstyringen fordeler det automatisk til alle tilsluttede portaler.",
            },
            { type: "h2", text: "Hvad der synkroniseres automatisk" },
            {
              type: "ul",
              items: [
                "Tilgængelighed — hver reservation spærrer nætten øjeblikkeligt på alle portaler",
                "Priser og minimumsophold fra din priskalender",
                "Indgående portal-bookinger importeres automatisk til myNextDays",
                "Annulleringer og stop-sell virker på tværs af kanaler",
              ],
            },
            { type: "h2", text: "Hvad du derved ikke længere behøver at gøre manuelt" },
            {
              type: "p",
              text: "Uden kanalstyring skulle du manuelt spærre nætten i hvert portal efter hver booking — en hyppig årsag til dobbeltbookinger. Med aktiv kanalstyring overtager myNextDays denne synkronisering i begge retninger, flere gange dagligt og i realtid ved nye bookinger.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portal-forbindelsen oprettes én gang for hele kontoen. For hver enkelt bolig aktiverer du derefter kun mappingen — mere om det under [Tildel bolig til et portal](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Opsæt portal-forbindelse",
          excerpt:
            "Du opsætter forbindelsen til portalerne én gang for hele kontoen — ikke på ny for hver bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Én gang for hele kontoen" },
            {
              type: "p",
              text: "Tilslutningen til portalerne er en kontoindstilling: Du forbinder din myNextDays-konto præcis én gang med kanalstyringen. Alle boliger, du opretter senere, bruger automatisk denne ene forbindelse — du behøver ikke oprette den på ny for hver bolig.",
            },
            { type: "h2", text: "Sådan opsætter du forbindelsen" },
            {
              type: "steps",
              items: [
                "Åbn /konto, og vælg afsnittet »Portaler & kanalstyring«",
                "Klik på »Opsæt forbindelse«, og bekræft dine virksomhedsoplysninger (adresse, kontakt, selskabsform)",
                "Kontrollér de automatisk overførte stamdata — de videregives til alle portaler",
                "Afslut opsætningen; status skifter til »Forbundet«",
              ],
            },
            { type: "h2", text: "Næste skridt: tildel boliger" },
            {
              type: "p",
              text: "Efter den engangsopsætning er endnu ingen bolig synlig — til det tildeler du hver bolig enkeltvis til et portal (mapping) og forbinder de ønskede portaler som Booking.com eller Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden fuldstændige stamdata (adresse, skatteoplysninger, kontakt) afviser portalerne forbindelsen. Kontrollér først disse oplysninger under /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Tildel bolig til et portal",
          excerpt:
            "Efter den kontoomfattende forbindelse aktiverer du kun mappingen til det pågældende portal pr. bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Mapping i stedet for ny forbindelse" },
            {
              type: "p",
              text: "Når portal-forbindelsen én gang er opsat for hele kontoen, forbinder du kun hver bolig via en såkaldt mapping: Du fastlægger, hvilken myNextDays-bolig der svarer til hvilken værelses- eller udbudstype i portalet. Det er et engangstrin pr. bolig.",
            },
            { type: "h2", text: "Sådan tildeler du en bolig" },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, og skift til fanen »Portaler«",
                "Vælg det ønskede portal, for eksempel Booking.com eller Airbnb",
                "Tildel boligen den passende værelses- eller udbudstype i portalet",
                "Aktivér synkroniseringen — priser og tilgængelighed overføres med det samme",
              ],
            },
            { type: "h2", text: "Én bolig, flere portaler" },
            {
              type: "p",
              text: "En enkelt bolig kan samtidig være tildelt flere portaler. Hver tildeling er uafhængig — du kan for eksempel gøre en bolig synlig på Booking.com og Airbnb, men foreløbig lade den være deaktiveret på Expedia.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollér synligheden direkte efter mappingen — se [Synlighed pr. portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Tilslut Booking.com",
          excerpt: "Sådan aktiverer du Booking.com som salgskanal for en bolig.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Forudsætning: kontoomfattende forbindelse" },
            {
              type: "p",
              text: "Før du aktiverer Booking.com for en bolig, skal den kontoomfattende portal-forbindelse være opsat (se [Opsæt portal-forbindelse](/hilfe/portale-kanalmanager/portal-verbindung)). Derefter er Booking.com for hver yderligere bolig kun et spørgsmål om mapping.",
            },
            { type: "h2", text: "Aktivér Booking.com" },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, fanen »Portaler«",
                "Vælg »Booking.com« fra listen over tilgængelige portaler",
                "Tildel den passende værelses- eller udbudstype, og bekræft rateplanerne",
                "Aktivér synligheden — boligen sættes live, efter Booking.com har godkendt den",
              ],
            },
            { type: "h2", text: "Hvad Booking.com forventer af dig" },
            {
              type: "ul",
              items: [
                "Fuldstændig boligbeskrivelse, billeder og faciliteter",
                "Mindst én rate med pris og afbestillingsbetingelser",
                "En gyldig betalingsmetode til provisioner",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Godkendelsen fra Booking.com kan tage nogle timer. Status i boligens fane »Portaler« viser, om forbindelsen allerede er aktiv.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Tilslut Airbnb",
          excerpt: "Sådan gør du en bolig bookbar på Airbnb via kanalstyringen.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Airbnb som endnu et portal" },
            {
              type: "p",
              text: "Airbnb tilsluttes ligesom alle andre portaler via den kontoomfattende forbindelse. Er denne opsat, aktiverer du Airbnb pr. bolig via mappingen — uanset om boligen allerede er synlig på Booking.com eller andre portaler.",
            },
            { type: "h2", text: "Aktivér Airbnb for en bolig" },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, fanen »Portaler«",
                "Vælg »Airbnb« fra listen over tilgængelige portaler",
                "Bekræft boligkategorien og den tildelte udbudstype",
                "Kontrollér billeder, faciliteter og husregler — Airbnb kræver fuldstændige oplysninger inden godkendelse",
                "Aktivér synligheden for Airbnb",
              ],
            },
            { type: "h2", text: "Efter aktiveringen" },
            {
              type: "p",
              text: "Så snart Airbnb har godkendt boligen, kører priser og tilgængelighed automatisk via kanalstyringen. Bookinger, der kommer ind på Airbnb, vises derefter automatisk i din reservationskalender.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden registrerede afbestillingsbetingelser og husregler afviser Airbnb godkendelsen. Tilføj først disse oplysninger på boligen.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Synkronisér priser & tilgængelighed",
          excerpt:
            "Priser og tilgængelighed overføres automatisk til alle tilsluttede portaler.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Én kalender, alle portaler" },
            {
              type: "p",
              text: "Du vedligeholder udelukkende priser og tilgængelighed i myNextDays-kalenderen for den pågældende bolig. Kanalstyringen overfører automatisk hver ændring til alle portaler, boligen aktivt er mappet til — uden at du skal indtaste noget dobbelt.",
            },
            { type: "h2", text: "Hvad der overføres" },
            {
              type: "ul",
              items: [
                "Dagspriser fra din priskalender eller rateplanerne",
                "Tilgængelige nætter og spærringer",
                "Minimumsophold og ankomst-/afrejsebegrænsninger",
                "Stop-sell-dage — disse spærrer automatisk på alle portaler",
              ],
            },
            { type: "h2", text: "Hvor hurtigt synkroniseringen virker" },
            {
              type: "p",
              text: "Ændringer af priser og tilgængelighed videregives til portalerne inden for få minutter. Nye reservationer spærrer straks de berørte nætter, så den samme nat ikke kan sælges igen på nogen anden kanal.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mere om at spærre enkelte dage på tværs af kanaler finder du under [Undgå overbookinger](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Modtag portal-bookinger",
          excerpt: "Bookinger fra Booking, Airbnb & Co. lander automatisk i din kalender.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Automatisk import" },
            {
              type: "p",
              text: "Booker en gæst via et portal som Booking.com eller Airbnb, importerer kanalstyringen automatisk reservationen til myNextDays. Du behøver ikke overføre noget manuelt — bookingen vises i kalenderen og i reservationslisten for den berørte bolig.",
            },
            { type: "h2", text: "Hvad der sker ved en portal-booking" },
            {
              type: "steps",
              items: [
                "Portalet melder den nye booking til kanalstyringen",
                "myNextDays opretter reservationen med gæsteoplysninger, periode og pris",
                "De bookede nætter spærres straks på alle andre kanaler",
                "Du modtager en notifikation og finder bookingen i kalenderen",
              ],
            },
            { type: "h2", text: "Annulleringer og ændringer" },
            {
              type: "p",
              text: "Annullerer en gæst via portalet, eller ændrer gæsten perioden, overføres dette også automatisk til myNextDays, og de berørte nætter frigives igen.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portal-bookinger kan genkendes i reservationsdetaljerne på deres oprindelses-badge, for eksempel Booking.com eller Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Undgå overbookinger",
          excerpt: "Stop-sell og automatiske spærringer forhindrer dobbeltbookinger på tværs af flere portaler.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Hvorfor overbookinger opstår" },
            {
              type: "p",
              text: "Uden central styring sker det let, at den samme nat sælges på to portaler samtidig — for eksempel når priser og tilgængelighed vedligeholdes manuelt i flere systemer. Kanalstyringen lukker dette hul ved, at hver booking på enhver kanal øjeblikkeligt spærrer alle andre kanaler.",
            },
            { type: "h2", text: "Dine værktøjer mod overbookinger" },
            {
              type: "ul",
              items: [
                "Automatisk spærring: Hver ny reservation — uanset kanal — spærrer nætterne overalt",
                "Stop-sell: Spærrer manuelt en dag på alle kanaler samtidig, for eksempel til egen brug eller vedligeholdelse",
                "Minimumsophold og ankomstbegrænsninger forhindrer uhensigtsmæssige kortidsbookinger",
              ],
            },
            { type: "h2", text: "Aktivér stop-sell" },
            {
              type: "steps",
              items: [
                "Åbn belægningskalenderen for boligen",
                "Marker den berørte dag eller periode",
                "Vælg »Stop-sell« — dagen er derefter spærret på alle portaler samt på hjemmeside og Platform",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell gælder uden undtagelse for alle kanaler. Der er ingen mulighed for kun at spærre en dag for et enkelt portal og lade den være åben for andre.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Synlighed pr. portal",
          excerpt: "Hvert portal kan tændes eller slukkes uafhængigt af hjemmeside og Platform-markedsplads.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Tre uafhængige salgskanaler" },
            {
              type: "p",
              text: "En bolig kan sælges via flere veje samtidig: via portalerne (Booking, Airbnb & Co.), via myBestDays-Platform-markedspladsen og via din egen hjemmeside. Hver vej har sin egen synligheds-kontakt — de er fuldstændig uafhængige af hinanden.",
            },
            { type: "h2", text: "Styr synlighed pr. portal" },
            {
              type: "p",
              text: "Inden for portalerne kan hvert enkelt portal desuden slås til og fra separat. En bolig kan for eksempel være aktiv på Booking.com, men deaktiveret på Airbnb — begge tildelinger forbliver upåvirket bestående.",
            },
            { type: "h2", text: "Sådan ændrer du synligheden" },
            {
              type: "steps",
              items: [
                "Åbn boligen under /objekte, fanen »Portaler«",
                "Tænd eller sluk den ønskede kanal (enkelt portal, hjemmeside eller Platform-markedsplads) enkeltvis",
                "Gem — ændringen virker inden for få minutter",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Bolig-status (aktiv/inaktiv) samt stop-sell virker overordnet på alle kanaler. Synligheds-kontakterne styrer kun, på hvilke yderligere kanaler en allerede aktiv bolig vises.",
            },
          ],
        },
      ],
    },
  ],
};
