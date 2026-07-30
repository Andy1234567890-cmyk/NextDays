import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanalhanterare",
  description: "Bemästra portaler och kanalhanteraren.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanalhanterare",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Ansluta din första portal",
          excerpt: "Så aktiverar du en portal för ett objekt för första gången.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: du har skapat ett objekt men ännu inte anslutit någon portal",
            },
            {
              type: "p",
              text: "Ditt objekt är fullständigt inställt i myNextDays, men ännu inte synligt på någon portal som Booking.com eller Airbnb. Innan en portal godkänner ett objekt behöver ditt konto en engångs kontoomfattande portalanslutning — därefter räcker det med en mappning för varje ytterligare objekt.",
            },
            {
              type: "steps",
              items: [
                "Öppna /konto, avsnittet ”Portaler och kanalhanterare”, och ställ in den kontoomfattande anslutningen med dina verksamhetsuppgifter",
                "Öppna därefter objektet under /objekte och byt till fliken ”Portaler”",
                "Välj önskad portal och koppla den till rätt rums- respektive erbjudandetyp",
                "Kontrollera foton, utrustning, priser och avbokningsvillkor — portaler kräver kompletta uppgifter",
                "Aktivera synligheten; statusen ändras till ”Ansluten” efter portalens granskning",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Den kontoomfattande anslutningen ställer du in bara en gång. Detaljer om det under [Ansluta Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) och [Ansluta Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Ansluta Booking.com",
          excerpt: "Så gör du ett objekt bokningsbart på Booking.com via kanalhanteraren.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: ditt objekt ska dessutom bli synligt på Booking.com",
            },
            {
              type: "p",
              text: "Booking.com är en av de portaler som ansluts via kanalhanteraren. Förutsättningen är den kontoomfattande portalanslutningen — är den redan inställd behöver du för Booking.com bara en mappning per objekt.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte, fliken ”Portaler”",
                "Välj ”Booking.com” från listan över tillgängliga portaler",
                "Koppla rätt rums- respektive erbjudandetyp och bekräfta minst en rate med pris och avbokningsvillkor",
                "Ange en giltig betalningsmetod för provisionsfaktureringen",
                "Aktivera synligheten för Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Godkännandet från Booking.com kan ta några timmar. Statusen i fliken ”Portaler” visar när anslutningen är aktiv.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Ansluta Airbnb",
          excerpt: "Så gör du ett objekt bokningsbart på Airbnb via kanalhanteraren.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: ditt objekt ska dessutom bli synligt på Airbnb",
            },
            {
              type: "p",
              text: "Airbnb ansluts som vilken annan portal som helst via den kontoomfattande anslutningen. Är den inställd aktiverar du Airbnb per objekt via en mappning — oberoende av om objektet redan är synligt på Booking.com eller andra portaler.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte, fliken ”Portaler”",
                "Välj ”Airbnb” från listan över tillgängliga portaler",
                "Bekräfta objektkategorin och den kopplade erbjudandetypen",
                "Komplettera foton, utrustning och husregler — Airbnb kräver kompletta uppgifter innan godkännande",
                "Aktivera synligheten för Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan angivna avbokningsvillkor och husregler avvisar Airbnb godkännandet. Komplettera dessa uppgifter först på objektet.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Hålla priser synkroniserade över alla portaler",
          excerpt: "En kalender räcker — kanalhanteraren distribuerar prisändringar automatiskt till alla portaler.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: du ändrar ett pris och vill säkerställa att det stämmer överallt",
            },
            {
              type: "p",
              text: "Du underhåller priser uteslutande i myNextDays-kalendern för objektet — aldrig separat i portalerna själva. Kanalhanteraren överför varje ändring automatiskt till alla portaler där objektet är aktivt mappat.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektets priskalender respektive rateplaner",
                "Justera dagspriset, minsta vistelse eller ankomst-/avresebegränsningen",
                "Spara ändringen — den gäller först internt i objektet",
                "Kontrollera i fliken ”Portaler” att alla önskade portaler fortfarande är aktivt mappade",
                "Vänta några minuter tills ändringen har överförts till portalerna",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ange aldrig priser direkt i portalen — sådana ändringar skrivs över av myNextDays-kalendern vid nästa avstämning.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Importera en portalbokning",
          excerpt: "Portalbokningar hamnar automatiskt i kalendern — här kontrollerar du att importen lyckades.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: en gäst har bokat via en portal, bokningen ska nå myNextDays",
            },
            {
              type: "p",
              text: "Bokar en gäst via Booking.com, Airbnb eller en annan ansluten portal, importerar kanalhanteraren reservationen automatiskt — du behöver inte överföra något manuellt. Detta förlopp beskriver hur du följer upp och bekräftar importen.",
            },
            {
              type: "steps",
              items: [
                "Öppna kalendern eller bokningslistan för det berörda objektet",
                "Sök upp den nya reservationen — den har en ursprungsmärkning från portalen, till exempel Booking.com eller Airbnb",
                "Kontrollera gästuppgifter, period och pris för fullständighet",
                "Kontrollera att de bokade nätterna visas som spärrade på alla andra kanaler",
                "Öppna vid behov bokningsdetaljerna för att hantera extratjänster eller meddelanden från gästen",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Avbokar gästen via portalen eller ändrar perioden, tas även detta automatiskt över och nätterna frigörs igen.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Lösa en dubbelbokning",
          excerpt: "Så går du tillväga när samma natt undantagsvis har sålts på två kanaler.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: två reservationer överlappar för samma objekt och samma nätter",
            },
            {
              type: "p",
              text: "Kanalhanteraren spärrar normalt bokade nätter omedelbart kanalövergripande. En dubbelbokning kan ändå uppstå, till exempel vid samtidiga bokningar på två portaler i exakt samma ögonblick eller vid en manuellt skapad reservation som kolliderar med en portalbokning.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektets kalender och identifiera båda de överlappande reservationerna",
                "Kontrollera bokningstidpunkt och ursprungsmärkning för båda reservationerna",
                "Kontakta den senast inkomna gästen och erbjud ett alternativt objekt eller en alternativ period",
                "Avboka den ohållbara reservationen i respektive portal, inte bara i myNextDays",
                "Ställ därefter in stop-sell för de berörda nätterna tills fallet är helt utrett",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Avboka alltid en portalbokning via portalen själv — en avbokning bara i myNextDays frigör visserligen natten internt, men informerar inte portalen tillförlitligt.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Pausa en portal tillfälligt",
          excerpt: "Stänga av synligheten per portal individuellt, utan att förlora mappningen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: ett objekt ska tillfälligt inte gå att boka på en portal",
            },
            {
              type: "p",
              text: "Synligheten kan slås på och av individuellt per portal — oberoende av webbplats och plattformens marknadsplats. Vill du till exempel pausa Airbnb kortvarigt men låta Booking.com fortsätta löpa, inaktiverar du uteslutande den ena kanalen.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte, fliken ”Portaler”",
                "Sök upp posten för den portal du vill pausa",
                "Stäng av synligheten för denna portal",
                "Spara — ändringen gäller inom några minuter, objektet försvinner från denna portals sökresultat",
                "Slå på synligheten igen så snart objektet ska vara bokningsbart på nytt",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mappningen bevaras vid pausning — du behöver inte ställa in kopplingen till portalen på nytt senare. För en fullständig spärrning av alla kanaler använder du istället stop-sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Kontrollera objektmappningen",
          excerpt: "Så kontrollerar du om ditt objekt fortfarande är korrekt kopplat till rätt erbjudandetyp i portalen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: priser eller tillgänglighet stämmer inte längre överens med myNextDays på en portal",
            },
            {
              type: "p",
              text: "Avviker visningen i portalen från din myNextDays-kalender ligger orsaken ofta i en felaktig eller avbruten mappning — kopplingen mellan ditt objekt och rums- respektive erbjudandetypen i portalen.",
            },
            {
              type: "steps",
              items: [
                "Öppna objektet under /objekte, fliken ”Portaler”",
                "Kontrollera statusen för den berörda portalen — den bör visa ”Ansluten”, inte ”Fel” eller ”Väntande”",
                "Kontrollera om den kopplade rums- respektive erbjudandetypen i portalen fortfarande motsvarar det faktiska objektet",
                "Vid avvikelse: koppla bort mappningen och koppla på nytt, aktivera därefter synligheten igen",
                "Vänta några minuter efter korrigeringen och kontrollera priser och tillgänglighet igen i portalen",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ett objekt kan vara kopplat till flera portaler samtidigt — kontrollera vid avvikelser målinriktat den ena berörda portalen, inte alla på en gång.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Olika rateplaner per portal",
          excerpt: "Hur du tilldelar en portal en egen rateplan, utan att påverka de övriga kanalerna.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: du vill erbjuda ett annat pris på en portal än på de övriga kanalerna",
            },
            {
              type: "p",
              text: "Rateplaner kan kopplas individuellt per portal, till exempel en icke avbokningsbar rateplan för en portal och en flexibel för en annan. Grundpriserna underhålls centralt i objektet, mappningen avgör vilken rateplan som går till vilken portal.",
            },
            {
              type: "steps",
              items: [
                "Skapa den ytterligare rateplanen i objektet med önskade villkor (pris, avbokningsvillkor, minsta vistelse)",
                "Öppna fliken ”Portaler” och välj den berörda portalen",
                "Koppla den nya rateplanen till denna portal i mappningen",
                "Lämna de övriga portalerna oförändrade på sin tidigare rateplan",
                "Spara och kontrollera prisvisningen i respektive portal efter några minuter",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Varje rateplan överförs oberoende — en ändring av en rateplan påverkar inte portaler som är kopplade till en annan rateplan.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Åtgärda vanliga portalfel",
          excerpt: "Typiska orsaker när en portal avvisar ett objekt eller synkroniseringen stannar av.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge: statusen för en portal visar ett fel eller objektet godkänns inte",
            },
            {
              type: "p",
              text: "Portaler avvisar oftast en anslutning på grund av saknade grunduppgifter eller ofullständiga objektuppgifter. Gå igenom de vanligaste orsakerna i tur och ordning innan du kontaktar supporten.",
            },
            {
              type: "steps",
              items: [
                "Kontrollera under /konto om adress, skatteuppgifter och kontaktuppgifter är fullständigt angivna",
                "Kontrollera i objektet om beskrivning, foton, utrustning och minst en rate är kompletta",
                "Kontrollera om en giltig betalningsmetod för provisioner har angetts",
                "Öppna fliken ”Portaler” och läs det exakta felmeddelandet bredvid den berörda portalen",
                "Åtgärda den angivna luckan och aktivera synligheten igen",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ett portalfel gäller alltid bara den ena portalen — de övriga kanalerna fortsätter oberoende av det, så länge deras egna krav är uppfyllda.",
            },
          ],
        },
      ],
    },
  ],
};
