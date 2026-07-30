import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Plattformen (marknadsplats)",
  description: "Sälja på myNextDays-marknadsplatsen.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marknadsplats",
      articles: [
        {
          slug: "der-marktplatz",
          title: "myNextDays-marknadsplatsen",
          excerpt: "Den globala myNextDays-marknadsplatsen är en egen bokningskanal vid sidan av portaler och webbplats.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-marknadsplatsen (/plattform) är myNextDays egen globala bokningskanal — jämförbar med Booking eller Airbnb, men del av samma plattform. Där söker gäster bland objekt från alla anslutna verksamheter och bokar direkt.",
            },
            { type: "h2", text: "Inte ”direkt”, utan en likvärdig kanal" },
            {
              type: "p",
              text: "Marknadsplatsen ersätter inte direktbokning via din egen webbplats. Den är en fristående, tredje försäljningsväg med egen synlighetsaxel, egen gästbas och egen provision — precis som en portal, bara driven av myNextDays själv.",
            },
            { type: "h2", text: "Hur objekt kommer till marknadsplatsen" },
            {
              type: "ul",
              items: [
                "Objektet måste vara aktivt (objektstatusen tillåter försäljning).",
                "Marknadsplatssynligheten måste vara påslagen — separat från portaler och webbplats.",
                "Tillgänglighet måste finnas i kalendern för den önskade perioden.",
              ],
            },
            { type: "h2", text: "Bokningar från marknadsplatsen" },
            {
              type: "p",
              text: "En marknadsplatsbokning spärrar motsvarande nätter omedelbart på alla andra kanaler — precis som en portal- eller webbplatsbokning. Den visas i din kalender och i reservationerna som vilken annan bokning som helst, märkt med kanalen ”Plattform”.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-sell och en inaktiv objektstatus verkar kanalövergripande och spärrar även marknadsplatsen — oberoende av marknadsplatsens synlighetsreglage.",
            },
            {
              type: "p",
              text: "Hur du gör ett objekt tillgängligt för marknadsplatsen läser du under [Lista objekt på marknadsplatsen](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Lista objekt på marknadsplatsen",
          excerpt: "Marknadsplatssynlighet är ett eget reglage, separat från portaler och webbplats.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Synligheten på marknadsplatsen styr du via ett eget reglage på objektet — oberoende av om samma objekt även är synligt på portaler eller din webbplats.",
            },
            { type: "h2", text: "Så listar du ett objekt" },
            {
              type: "steps",
              items: [
                "Öppna objektet under Objekt.",
                "Byt till fliken Synlighet.",
                "Aktivera reglaget Plattformens marknadsplats.",
                "Kontrollera att objektstatusen är aktiv och att kalendertillgänglighet finns.",
              ],
            },
            { type: "h2", text: "Förutsättning: komplett profil" },
            {
              type: "p",
              text: "Marknadsplatsen visar bara objekt med kompletta uppgifter — titelfoto, beskrivning, utrustning och grundpris måste vara angivna. Saknas obligatoriska uppgifter förblir objektet osynligt trots aktiverat reglage.",
            },
            {
              type: "ul",
              items: [
                "Minst ett titelfoto och en beskrivning",
                "Utrustningsegenskaper från kategorilistan",
                "Beläggning och grundpris i den angivna objektvalutan",
                "Kalendertillgänglighet för den önskade perioden",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Klickar du på Publicera aktiverar myNextDays normalt marknadsplats, portaler och webbplats tillsammans — du kan därefter alltid stänga av marknadsplatsreglaget individuellt igen.",
            },
            { type: "h2", text: "Ta bort synlighet igen" },
            {
              type: "p",
              text: "Inaktiverar du reglaget Plattformens marknadsplats försvinner objektet från marknadsplatssökningen. Redan bekräftade bokningar påverkas inte och fortlöper som vanligt, se [Marknadsplatsprovision](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Marknadsplatsprovision",
          excerpt: "För varje bokning som förmedlas via marknadsplatsen tas den provision ut som anges i tariffen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Precis som på varje bokningsportal tas en provision ut för bokningar som kommer till via myNextDays-marknadsplatsen. Den beräknas per bokning och är oberoende av eventuella provisioner för portaler.",
            },
            { type: "h2", text: "Hur provisionen beräknas" },
            {
              type: "p",
              text: "Storleken följer den provision som anges i din verksamhets tariff. Du hittar den aktuella satsen när som helst under Konto i området Avräkning — där antas inget schablonvärde, utan den sats som faktiskt gäller för din tariff visas.",
            },
            { type: "h2", text: "Var du ser provisionen" },
            {
              type: "steps",
              items: [
                "Öppna Konto i menyn.",
                "Byt till området Avräkning.",
                "Öppna en marknadsplatsbokning för att se omsättning och provision i detalj.",
                "Kontrollera översikten över provisioner för den löpande avräkningsperioden.",
              ],
            },
            { type: "h2", text: "Avgränsning mot portalprovisioner" },
            {
              type: "ul",
              items: [
                "Marknadsplatsprovisionen gäller uteslutande för bokningar via myNextDays-marknadsplatsen.",
                "Portalbokningar (Booking, Airbnb & Co.) lyder under respektive portals villkor.",
                "Webbplatsbokningar lyder under de villkor som anges för din tariff, utan marknadsplatsprovision.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provisionen fastställs automatiskt utifrån din tariff. En saknad eller oklar tariff leder till ett tydligt felmeddelande istället för ett uppskattat värde.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Gästprofil och recensioner",
          excerpt: "Marknadsplatsgäster har en profil med bokningshistorik och kan lämna recensioner.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Gäster som bokar via myNextDays-marknadsplatsen skapar en egen gästprofil. Där samlas deras bokningar, meddelanden med verksamheter och lämnade recensioner — på liknande sätt som ett portalgästkonto.",
            },
            { type: "h2", text: "Vad du som verksamhet ser" },
            {
              type: "p",
              text: "I bokningsdetaljerna för en marknadsplatsbokning hittar du gästprofilen med tidigare vistelser hos din verksamhet och, om gästen har godkänt det, offentligt synliga recensioner om andra boenden.",
            },
            { type: "h2", text: "Recensioner efter vistelsen" },
            {
              type: "steps",
              items: [
                "Efter utcheckningen får gästen en uppmaning att lämna en recension.",
                "Recensionen visas efter en kort granskning på objektsidan i marknadsplatsen.",
                "Du kan som verksamhet svara offentligt på varje recension.",
                "Osakliga eller kränkande recensioner kan du anmäla för granskning.",
              ],
            },
            {
              type: "ul",
              items: [
                "Recensioner är kopplade till en faktisk bokning — ingen recension utan vistelse.",
                "Gästen betygsätter renlighet, kommunikation, läge och prisvärdhet.",
                "Ditt svar är synligt för alla besökare på marknadsplatsen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Bra recensioner påverkar direkt placeringen av ditt objekt i marknadsplatssökningen — reagera snabbt och sakligt på kritik.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blockerade personer",
          excerpt: "En verksamhet kan spärra en gäst, så att meddelanden och bokningar förhindras.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Uppstår problem med en gäst kan du som verksamhet spärra hen. En blockerad person kan inte längre skicka dig meddelanden och kan inte skapa någon ny bokning hos din verksamhet.",
            },
            { type: "h2", text: "Blockera en person" },
            {
              type: "steps",
              items: [
                "Öppna meddelandehistoriken eller reservationen med den aktuella gästen.",
                "Klicka på Blockera gäst.",
                "Bekräfta dialogrutan — spärren gäller omedelbart.",
                "Den blockerade personen visas därefter under Konto under Blockerade personer.",
              ],
            },
            { type: "h2", text: "Vad spärren innebär" },
            {
              type: "ul",
              items: [
                "Gästen kan inte längre skicka nya meddelanden till din verksamhet.",
                "Gästen kan inte skapa någon ny bokning hos din verksamhet.",
                "En pågående bokning med en redan bekräftad ankomst inom de kommande två veckorna påverkas inte av spärren, så att vistelsen kan avslutas på ett ordnat sätt.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Spärren gäller uteslutande för din verksamhet. Andra verksamheter på marknadsplatsen ser inte spärren och påverkas inte av den.",
            },
            { type: "h2", text: "Ta bort spärren igen" },
            {
              type: "p",
              text: "Öppna Konto och där Blockerade personer. Välj posten och klicka på Ta bort spärr — gästen kan därefter åter skicka meddelanden och boka.",
            },
          ],
        },
      ],
    },
  ],
};
