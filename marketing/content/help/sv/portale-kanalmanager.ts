import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portaler och kanalhanterare",
  description: "Styr Booking, Airbnb, Expedia & Co. centralt.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Ansluta portaler",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Vad är kanalhanteraren?",
          excerpt:
            "Kanalhanteraren stämmer automatiskt av priser, tillgänglighet och bokningar mellan myNextDays och portalerna.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "En anslutning för alla portaler" },
            {
              type: "p",
              text: "Kanalhanteraren är bron mellan myNextDays och de stora bokningsportalerna som Booking, Airbnb & Co. Istället för att underhålla priser, tillgänglighet och beläggning separat i varje portal anger du allt en gång i myNextDays — kanalhanteraren distribuerar det automatiskt till alla anslutna portaler.",
            },
            { type: "h2", text: "Vad som synkroniseras automatiskt" },
            {
              type: "ul",
              items: [
                "Tillgänglighet — varje bokning spärrar natten omedelbart på alla portaler",
                "Priser och minsta vistelser från din priskalender",
                "Inkommande portalbokningar importeras automatiskt till myNextDays",
                "Avbokningar och stop-sell verkar kanalövergripande",
              ],
            },
            { type: "h2", text: "Vad du därför slipper göra manuellt" },
            {
              type: "p",
              text: "Utan kanalhanterare skulle du efter varje bokning behöva spärra natten för hand i varje portal — en vanlig orsak till dubbelbokningar. Med aktiv kanalhanterare sköter myNextDays denna avstämning i båda riktningarna, flera gånger dagligen och i realtid vid nya bokningar.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portalanslutningen ställs in en gång kontoomfattande. För varje enskilt objekt aktiverar du därefter bara mappningen — mer om det under [Koppla objekt till en portal](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Ställa in portalanslutning",
          excerpt:
            "Anslutningen till portalerna ställer du in en gång kontoomfattande — inte på nytt för varje objekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "En gång för hela kontot" },
            {
              type: "p",
              text: "Anslutningen till portalerna är en kontoomfattande inställning: du kopplar ditt myNextDays-konto exakt en gång till kanalhanteraren. Alla objekt du lägger till senare använder automatiskt denna enda anslutning — du behöver inte bygga upp den på nytt för varje objekt.",
            },
            { type: "h2", text: "Så ställer du in anslutningen" },
            {
              type: "steps",
              items: [
                "Öppna /konto och välj avsnittet ”Portaler och kanalhanterare”",
                "Klicka på ”Ställ in anslutning” och bekräfta dina verksamhetsuppgifter (adress, kontakt, företagsform)",
                "Kontrollera de automatiskt övertagna grunduppgifterna — de skickas vidare till alla portaler",
                "Slutför inställningen; statusen ändras till ”Ansluten”",
              ],
            },
            { type: "h2", text: "Nästa steg: koppla objekt" },
            {
              type: "p",
              text: "Efter den engångsinställningen är inget objekt ännu synligt — därför kopplar du varje objekt individuellt till en portal (mappning) och ansluter de önskade portalerna som Booking.com eller Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan kompletta grunduppgifter (adress, skatteuppgifter, kontakt) avvisar portalerna anslutningen. Kontrollera dessa uppgifter först under /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Koppla objekt till en portal",
          excerpt:
            "Efter den kontoomfattande anslutningen aktiverar du bara mappningen till respektive portal per objekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Mappning istället för ny anslutning" },
            {
              type: "p",
              text: "Är portalanslutningen väl inställd kontoomfattande, kopplar du varje objekt bara via en så kallad mappning: du fastställer vilket myNextDays-objekt som motsvarar vilken rums- respektive erbjudandetyp i portalen. Det är ett engångssteg per objekt.",
            },
            { type: "h2", text: "Så kopplar du ett objekt" },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte och byt till fliken ”Portaler”",
                "Välj önskad portal, till exempel Booking.com eller Airbnb",
                "Koppla objektet till rätt rums- respektive erbjudandetyp i portalen",
                "Aktivera synkroniseringen — priser och tillgänglighet överförs från och med nu",
              ],
            },
            { type: "h2", text: "Ett objekt, flera portaler" },
            {
              type: "p",
              text: "Ett enskilt objekt kan vara kopplat till flera portaler samtidigt. Varje koppling är oberoende — du kan till exempel göra ett objekt synligt på Booking.com och Airbnb, men lämna det inaktiverat på Expedia tills vidare.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollera synligheten direkt efter mappningen — se [Synlighet per portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Ansluta Booking.com",
          excerpt: "Så aktiverar du Booking.com som försäljningskanal för ett objekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Förutsättning: kontoomfattande anslutning" },
            {
              type: "p",
              text: "Innan du aktiverar Booking.com för ett objekt måste den kontoomfattande portalanslutningen vara inställd (se [Ställa in portalanslutning](/hilfe/portale-kanalmanager/portal-verbindung)). Därefter är Booking.com för varje ytterligare objekt bara en fråga om mappning.",
            },
            { type: "h2", text: "Aktivera Booking.com" },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte, fliken ”Portaler”",
                "Välj ”Booking.com” från listan över tillgängliga portaler",
                "Koppla rätt rums- respektive erbjudandetyp och bekräfta rateplanerna",
                "Aktivera synligheten — objektet publiceras efter Booking.coms granskning",
              ],
            },
            { type: "h2", text: "Vad Booking.com förväntar sig av dig" },
            {
              type: "ul",
              items: [
                "Fullständig objektbeskrivning, bilder och utrustning",
                "Minst en rate med pris och avbokningsvillkor",
                "En giltig betalningsmetod för provisioner",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Godkännandet från Booking.com kan ta några timmar. Statusen i objektfliken ”Portaler” visar om anslutningen redan är aktiv.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Ansluta Airbnb",
          excerpt: "Så gör du ett objekt bokningsbart på Airbnb via kanalhanteraren.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Airbnb som ytterligare portal" },
            {
              type: "p",
              text: "Airbnb ansluts som vilken annan portal som helst via den kontoomfattande anslutningen. Är den inställd, aktiverar du Airbnb per objekt via mappningen — oberoende av om objektet redan är synligt på Booking.com eller andra portaler.",
            },
            { type: "h2", text: "Aktivera Airbnb för ett objekt" },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte, fliken ”Portaler”",
                "Välj ”Airbnb” från listan över tillgängliga portaler",
                "Bekräfta objektkategorin och den kopplade erbjudandetypen",
                "Kontrollera foton, utrustning och husregler — Airbnb kräver kompletta uppgifter innan godkännande",
                "Aktivera synligheten för Airbnb",
              ],
            },
            { type: "h2", text: "Efter aktiveringen" },
            {
              type: "p",
              text: "Så snart Airbnb har godkänt objektet sköts priser och tillgänglighet automatiskt via kanalhanteraren. Bokningar som kommer in på Airbnb visas därefter automatiskt i din bokningskalender.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan angivna avbokningsvillkor och husregler avvisar Airbnb godkännandet. Komplettera dessa uppgifter först på objektet.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Synkronisera priser och tillgänglighet",
          excerpt:
            "Priser och tillgänglighet överförs automatiskt till alla anslutna portaler.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "En kalender, alla portaler" },
            {
              type: "p",
              text: "Du underhåller priser och tillgänglighet uteslutande i myNextDays-kalendern för respektive objekt. Kanalhanteraren överför varje ändring automatiskt till alla portaler där objektet är aktivt mappat — utan att du behöver ange något dubbelt.",
            },
            { type: "h2", text: "Vad som överförs" },
            {
              type: "ul",
              items: [
                "Dagspriser från din priskalender respektive rateplanerna",
                "Tillgängliga nätter och spärrningar",
                "Minsta vistelse och ankomst-/avresebegränsningar",
                "Stop-sell-dagar — dessa spärrar automatiskt på alla portaler",
              ],
            },
            { type: "h2", text: "Hur snabbt synkroniseringen verkar" },
            {
              type: "p",
              text: "Ändringar av priser och tillgänglighet skickas vidare till portalerna inom några minuter. Nya bokningar spärrar de berörda nätterna omedelbart, så att samma natt inte kan säljas igen på någon annan kanal.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mer om kanalövergripande spärrning av enskilda dagar hittar du under [Undvika överbokningar](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Ta emot portalbokningar",
          excerpt: "Bokningar från Booking, Airbnb & Co. hamnar automatiskt i din kalender.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Automatisk import" },
            {
              type: "p",
              text: "Bokar en gäst via en portal som Booking.com eller Airbnb, importerar kanalhanteraren reservationen automatiskt till myNextDays. Du behöver inte överföra något manuellt — bokningen visas i kalendern och i bokningslistan för det berörda objektet.",
            },
            { type: "h2", text: "Vad som händer vid en portalbokning" },
            {
              type: "steps",
              items: [
                "Portalen meddelar den nya bokningen till kanalhanteraren",
                "myNextDays skapar reservationen med gästuppgifter, period och pris",
                "De bokade nätterna spärras omedelbart på alla andra kanaler",
                "Du får en notifiering och hittar bokningen i kalendern",
              ],
            },
            { type: "h2", text: "Avbokningar och ändringar" },
            {
              type: "p",
              text: "Avbokar en gäst via portalen eller ändrar gästen perioden, överförs även detta automatiskt till myNextDays och de berörda nätterna frigörs igen.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portalbokningar känns igen i bokningsdetaljerna på sin ursprungsmärkning, till exempel Booking.com eller Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Undvika överbokningar",
          excerpt: "Stop-sell och automatiska spärrningar förhindrar dubbelbokningar över flera portaler.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Varför överbokningar uppstår" },
            {
              type: "p",
              text: "Utan central styrning händer det lätt att samma natt säljs på två portaler samtidigt — till exempel när priser och tillgänglighet underhålls manuellt i flera system. Kanalhanteraren stänger denna lucka genom att varje bokning på varje kanal omedelbart spärrar alla andra kanaler.",
            },
            { type: "h2", text: "Dina verktyg mot överbokningar" },
            {
              type: "ul",
              items: [
                "Automatisk spärrning: varje ny bokning — oavsett kanal — spärrar nätterna överallt",
                "Stop-sell: spärrar en dag manuellt på alla kanaler samtidigt, till exempel för egenanvändning eller underhåll",
                "Minsta vistelse och ankomstbegränsningar förhindrar olämpliga kortbokningar",
              ],
            },
            { type: "h2", text: "Ställa in Stop-Sell" },
            {
              type: "steps",
              items: [
                "Öppna objektets beläggningskalender",
                "Markera den berörda dagen eller perioden",
                "Välj ”Stop-sell” — dagen är därefter spärrad på alla portaler samt på webbplats och plattform",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell gäller undantagslöst för alla kanaler. Det finns ingen möjlighet att spärra en dag bara för en enskild portal och lämna den öppen för andra.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Synlighet per portal",
          excerpt: "Varje portal kan slås på eller av oberoende av webbplats och plattformens marknadsplats.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Tre oberoende försäljningsvägar" },
            {
              type: "p",
              text: "Ett objekt kan säljas via flera vägar samtidigt: via portalerna (Booking, Airbnb & Co.), via myBestDays plattformens marknadsplats och via din egen webbplats. Varje väg har ett eget synlighetsreglage — de är helt oberoende av varandra.",
            },
            { type: "h2", text: "Styra synlighet per portal" },
            {
              type: "p",
              text: "Inom portalerna kan dessutom varje enskild portal slås på och av separat. Ett objekt kan till exempel vara aktivt på Booking.com men inaktiverat på Airbnb — båda kopplingarna finns kvar opåverkade.",
            },
            { type: "h2", text: "Så ändrar du synligheten" },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte, fliken ”Portaler”",
                "Slå på eller av önskad kanal (enskild portal, webbplats eller plattformens marknadsplats) individuellt",
                "Spara — ändringen gäller inom några minuter",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objektstatusen (aktiv/inaktiv) samt stop-sell verkar övergripande på alla kanaler. Synlighetsreglagen styr bara på vilka ytterligare kanaler ett redan aktivt objekt visas.",
            },
          ],
        },
        {
          slug: "bewertungen",
          title: "Omdömen från alla kanaler",
          excerpt: "Omdömen från portalerna och från myBestDays samlas i en lista — där svarar du också.",
          updated: "Uppdaterat: augusti 2026",
          body: [
            { type: "h2", text: "En lista för alla kanaler" },
            {
              type: "p",
              text: "Under /bewertungen ser du varje omdöme om dina boenden på ett ställe: de från portalerna (Booking.com, Airbnb, Expedia) och de från myBestDays-marknadsplatsen. Portalerna betygsätter på 10, myBestDays på 5 stjärnor — stjärnor visas, med det ursprungliga betyget intill så att inget verkar förvanskat.",
            },
            { type: "h2", text: "Svara på ett omdöme" },
            {
              type: "steps",
              items: [
                "Öppna /bewertungen och filtrera vid behov på ”Endast obesvarade”",
                "Klicka på ”Svara” vid omdömet och skriv ditt svar",
                "Skicka — hos en portal går svaret först dit och visas först därefter här som besvarat",
              ],
            },
            { type: "h2", text: "Vad du dessutom ser" },
            {
              type: "ul",
              items: [
                "Genomsnitt, antal och svarsfrekvens per kanal som nyckeltal",
                "”Ännu inte publicerat”: motparten har inte lämnat omdöme än och 14-dagarsfristen löper",
                "”Svarstiden har gått ut”: portalen tar inte längre emot något svar",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Portalernas omdömen är endast synliga för dig. På myBestDays-marknadsplatsen och på din egen webbplats visas uteslutande dina egna, verifierade myBestDays-omdömen — Booking.com och Airbnb tillåter bara i begränsad omfattning att deras omdömen återpubliceras.",
            },
          ],
        },
      ],
    },
  ],
};
