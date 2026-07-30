import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reservationer & bookinger",
  description: "Administrer, flyt og annullér bookinger.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Bookinger",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Registrer booking manuelt",
          excerpt:
            "Sådan registrerer du en booking modtaget telefonisk eller via e-mail direkte i myNextDays.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Hvornår du registrerer manuelt" },
            {
              type: "p",
              text: "Ikke alle bookinger kommer ind via et portal eller din egen Platform — forespørgsler pr. telefon, e-mail eller på stedet skal du selv oprette, så boligen er korrekt spærret i myNextDays, og der ikke opstår dobbeltbooking.",
            },
            {
              type: "steps",
              items: [
                "Åbn Reservationer, og klik på »Ny booking«.",
                "Vælg boligen — hver bolig i myNextDays er én enkelt bookbar enhed, altså et bestemt værelse eller feriehus.",
                "Angiv ankomst og afrejse samt antal gæster.",
                "Registrer gæstens oplysninger (navn, kontakt, evt. adresse til fakturaen).",
                "Kontrollér den foreslåede pris, og tilpas den om nødvendigt.",
                "Gem bookingen — nætterne spærres straks i kalenderen.",
              ],
            },
            { type: "h2", text: "Betaling og bekræftelse" },
            {
              type: "p",
              text: "Efter gemning gælder de samme betalingsregler som ved online-bookinger. Er en betalingsudbyder tilsluttet, kan du direkte sende et betalingslink til gæsten eller manuelt markere betalingen som modtaget.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Notér særlige ønsker (tidlig ankomst, ekstrasenge) med det samme i noterne — teamet ser dem i booking-tidslinjen.",
            },
            { type: "h2", text: "Efter oprettelsen" },
            {
              type: "p",
              text: "Den nye booking vises straks i [Booking-tidslinjen](/hilfe/reservierungen/buchungs-zeitleiste) med alle yderligere trin som beskeder, opgaver og betalinger samlet ét sted.",
            },
            {
              type: "ul",
              items: [
                "Kalender og portaler synkroniseres automatisk, så snart du gemmer.",
                "Gæsten modtager om nødvendigt en automatisk bekræftelsesbesked.",
                "Ændringer af datoer registrerer du via »Flyt booking«.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Booking-tidslinjen",
          excerpt:
            "Booking-tidslinjen samler hele forløbet af en reservation ét sted.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Hvad tidslinjen viser" },
            {
              type: "p",
              text: "Hver reservation har sin egen tidslinje, der viser hele forløbet kronologisk — fra bookingforespørgslen eller portal-importen til check-out. Sådan ser du med ét blik, hvad der allerede er sket, og hvad der er næste skridt.",
            },
            {
              type: "ul",
              items: [
                "Beskeder med gæsten",
                "Opgaver, for eksempel rengøring eller klargøring",
                "Betalinger og fakturaer",
                "Bookede add-ons og tillægsydelser",
                "Flytninger (move) og annulleringer",
              ],
            },
            { type: "h2", text: "Brug tidslinjen i hverdagen" },
            {
              type: "steps",
              items: [
                "Åbn Reservationer, og vælg den ønskede booking.",
                "Skift til fanen »Tidslinje«.",
                "Rul kronologisk gennem alle begivenheder.",
                "Brug hurtighandlingerne til direkte at sende en besked eller oprette en opgave.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Bliver en booking flyttet eller annulleret, vises dette trin også i tidslinjen — inklusive de nætter, der frigives i kalenderen.",
            },
            { type: "h2", text: "Hvorfor det er vigtigt" },
            {
              type: "p",
              text: "Fordi team, ejer og support ser den samme tidslinje, opstår der ingen informationshuller mellem beskeder, opgaver og betalinger. Detaljer om tilbagebetalinger finder du under [Tilbagebetalinger](/hilfe/zahlungen/rueckerstattungen), om tillægsydelser under [Add-ons & tillægsydelser](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Flyt booking",
          excerpt:
            "Sådan flytter du en eksisterende booking til en ny periode, uden at rode kalenderen til.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Kontrollér inden flytning" },
            {
              type: "p",
              text: "Før du flytter en booking, skal du kontrollere tilgængeligheden i den nye periode for den bookede bolig. myNextDays frigiver først de oprindeligt reserverede nætter, når den nye periode er bekræftet — sådan opstår der ikke et hul, hvor boligen fejlagtigt anses som ledig eller dobbeltbooket.",
            },
            {
              type: "steps",
              items: [
                "Åbn bookingen i Reservationer.",
                "Vælg »Flyt«, og angiv den nye periode.",
                "Kontrollér den viste tilgængelighed for de nye datoer.",
                "Bekræft flytningen.",
                "Kontrollér, om prisen ændres på grund af det nye antal nætter, og tilpas den om nødvendigt.",
              ],
            },
            { type: "h2", text: "Hvad der sker automatisk" },
            {
              type: "p",
              text: "Efter bekræftelsen frigives de gamle nætter korrekt i kalenderen, og de nye nætter spærres, tilsluttede portaler opdateres. Forløbet registreres i booking-tidslinjen.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Er bookingen modtaget via et portal, kan en flytning være underlagt egne regler dér — kontrollér portalens retningslinjer, før du foretager større ændringer.",
            },
            { type: "h2", text: "Betalingsforskelle" },
            {
              type: "p",
              text: "Ændres prisen på grund af flytningen, skal du tilpasse betalingsreglerne tilsvarende — se [Betalingsregler](/hilfe/zahlungen/zahlungsregeln). Mere om det samlede forløb af en booking finder du under [Booking-tidslinjen](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Annullering & tilbagebetaling",
          excerpt:
            "Sådan annullerer du en booking korrekt og udløser om nødvendigt en tilbagebetaling.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Annullér booking" },
            {
              type: "p",
              text: "En annullering frigiver straks boligen for den bookede periode igen — i din kalender såvel som på alle tilsluttede portaler. Kontrollér inden annulleringen, hvilke afbestillingsbetingelser der gælder for denne booking.",
            },
            {
              type: "steps",
              items: [
                "Åbn bookingen i Reservationer.",
                "Vælg »Annullér«, og angiv en årsag.",
                "Kontrollér det foreslåede tilbagebetalingsbeløb.",
                "Bekræft annulleringen.",
              ],
            },
            { type: "h2", text: "Udløs tilbagebetaling" },
            {
              type: "p",
              text: "Er betalingen blevet håndteret via en tilsluttet betalingsudbyder, kan du udløse tilbagebetalingen direkte fra bookingen. Beløbet vises i den valuta, der er registreret for denne bolig. Detaljer om forløbet finder du under [Tilbagebetalinger](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Fuld eller delvis tilbagebetaling mulig",
                "Forløbet vises i booking-tidslinjen",
                "Ved portal-bookinger gælder desuden det pågældende portals regler",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En annullering kan ikke fortrydes. Kontrollér periode og gæst omhyggeligt, før du bekræfter.",
            },
            { type: "h2", text: "Efter annulleringen" },
            {
              type: "p",
              text: "Boligen kan bookes igen med det samme, åbne opgaver til bookingen — for eksempel klargøring — markeres automatisk som ikke længere nødvendige. Hele forløbet forbliver sporbart i [Booking-tidslinjen](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in & check-out",
          excerpt: "Sådan dokumenterer du en gæsts ankomst og afrejse i myNextDays.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Registrer check-in" },
            {
              type: "p",
              text: "Check-in markerer starten på opholdet og er især nyttig ved selv-check-in eller nøgleoverdragelse via teamet til at holde statussen for hver booking opdateret.",
            },
            {
              type: "steps",
              items: [
                "Åbn bookingen i Reservationer.",
                "Vælg »Check-in« på ankomstdagen.",
                "Tilføj om nødvendigt en note, for eksempel tidspunkt eller særlige forhold.",
              ],
            },
            { type: "h2", text: "Check-out og overdragelse" },
            {
              type: "p",
              text: "Ved check-out markerer du opholdet som afsluttet. Det udløser i mange tilfælde automatisk en rengøringsopgave for boligen, så den klargøres til den næste booking.",
            },
            {
              type: "ul",
              items: [
                "Check-in og check-out er en del af booking-tidslinjen",
                "Tidspunkter kan defineres pr. bolig i boligindstillingerne",
                "Ved mobil adgang kan teamet registrere check-in og check-out direkte på stedet",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "En glemt check-out blokerer ikke automatisk efterfølgende opgaver — kontrollér regelmæssigt forfaldne statusser i Reservationer.",
            },
            { type: "h2", text: "Sammenhæng med opgaver" },
            {
              type: "p",
              text: "Check-in og check-out er tæt forbundet med opgaver og tidslinjen. Mere om det samlede forløb kan du læse under [Booking-tidslinjen](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-ons & tillægsydelser",
          excerpt:
            "Sådan tilbyder du gæster bookbare tillægsydelser som morgenmad eller transfer og registrerer dem i reservationen.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Hvad add-ons er" },
            {
              type: "p",
              text: "Add-ons er valgfrie tillægsydelser til en booking — for eksempel morgenmad, tidlig ankomst, transfer eller sen check-out. De registreres pr. bolig og kan tilføjes til bookingen af gæsten selv eller af dit team.",
            },
            {
              type: "steps",
              items: [
                "Åbn boligen, og opret de ønskede tillægsydelser med pris under »Add-ons«.",
                "Åbn en eksisterende booking i Reservationer.",
                "Vælg »Tilføj add-on«, og vælg den ønskede ydelse.",
                "Bekræft mængde og tidspunkt for ydelsen.",
              ],
            },
            { type: "h2", text: "Afregning" },
            {
              type: "p",
              text: "Add-ons afregnes i den valuta, der gælder for den pågældende bolig, og vises som en separat post på fakturaen. Allerede betalte add-ons kan tilbagebetales forholdsmæssigt ved en annullering.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Registrer populære add-ons én gang centralt på boligen — så kan de tilføjes med få klik ved hver ny booking.",
            },
            { type: "h2", text: "Synlighed for gæsten" },
            {
              type: "p",
              text: "Er Platform eller den egne hjemmeside aktiv, kan gæster ofte selv vælge passende add-ons allerede under bookingen. Hver tilføjelse vises derefter i [Booking-tidslinjen](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Add-ons kan navngives og prissættes individuelt pr. bolig",
                "Efterfølgende tilføjelse er mulig til enhver tid via bookingen",
                "Annullerede add-ons tilbagebetales forholdsmæssigt",
              ],
            },
          ],
        },
      ],
    },
  ],
};
