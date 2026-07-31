import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Komma igång",
  description: "Ställ in kontot och kom igång på några minuter.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Konfiguration",
      articles: [
        {
          slug: "willkommen",
          title: "Välkommen till myNextDays",
          excerpt: "En översikt över PMS, kanalhanterare, marknadsplats och app.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays är din centrala plattform för semesterboenden och hotell. Istället för flera separata system hanterar du tillgänglighet, priser, bokningar och gästkommunikation på ett och samma ställe — oavsett om du driver ett enda semesterhus eller flera hotellrum.",
            },
            { type: "h2", text: "De fyra byggstenarna" },
            {
              type: "ul",
              items: [
                "PMS (fastighetsförvaltningssystem): objekt, kalender, priser, bokningar, uppgifter och betalningar.",
                "Kanalhanterare: koppling till portaler som Booking, Airbnb & Co. — en inmatning, många portaler synkroniserade.",
                "Plattformens marknadsplats: myBestDays egen marknadsplats, en likvärdig bokningskanal vid sidan av portalerna.",
                "App: mobilapplikationen för gäster, ägare och medarbetare med samma data som på webben.",
              ],
            },
            { type: "h2", text: "Hur byggstenarna samverkar" },
            {
              type: "p",
              text: "Du underhåller objekt, priser och tillgänglighet på ett ställe centralt i PMS. Därifrån distribuerar myNextDays automatiskt informationen till alla aktiva kanaler. En bokning — oavsett vilken kanal den kommer in via — spärrar direkt motsvarande nätter överallt, så att dubbelbokningar utesluts.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Börja med att ställa in konto och verksamhet, lägg sedan till ditt första objekt — den ordningen sparar dig korrigeringar senare.",
            },
            { type: "h2", text: "Nästa steg" },
            {
              type: "steps",
              items: [
                "Öppna Konto i menyn och fyll i dina verksamhetsuppgifter.",
                "Lägg till ditt första objekt under Objekt.",
                "Kontrollera att utrustning, foton och priser är kompletta.",
                "Klicka på Publicera för att göra objektet synligt på alla kanaler.",
              ],
            },
            {
              type: "p",
              text: "Mer om de enskilda stegen hittar du under [Ställ in konto och verksamhet](/hilfe/erste-schritte/konto-einrichten) och [Lägg till ditt första objekt](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Ställ in konto och verksamhet",
          excerpt: "Ange grunduppgifter, fakturaadress och valuta korrekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Innan du lägger till objekt ställer du in din verksamhet under Konto. Dessa uppgifter behövs för fakturor, portaler och avräkningen med myNextDays och bör därför vara kompletta och korrekta.",
            },
            { type: "h2", text: "Ange grunduppgifter" },
            {
              type: "steps",
              items: [
                "Öppna Konto i menyn.",
                "Fyll i företagsnamn respektive namnet på enskild firma, adress och kontaktuppgifter under Grunduppgifter.",
                "Ange fakturaadressen — den visas på alla utställda fakturor.",
                "Välj din basvaluta. Den gäller för alla priser tills du ändrar den specifikt per objekt.",
              ],
            },
            { type: "h2", text: "Varför valutan är viktig" },
            {
              type: "p",
              text: "Valutan gissas inte fram och fylls inte i automatiskt: saknas den kan inget pris visas eller faktureras korrekt. Därför kräver myNextDays ett medvetet val vid inställningen, istället för att sätta ett standardvärde.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ändrar du valutan för ett objekt i efterhand ändras alla prisplaner som hänger på det. Kontrollera priserna en gång till efteråt.",
            },
            { type: "h2", text: "Fakturaadress och avräkning" },
            {
              type: "p",
              text: "Under Avräkning i kontot ser du dina löpande fakturor och den angivna fakturaadressen. Håll dessa uppdaterade, särskilt vid ändring av företagsform eller adress, så att fakturor ställs ut korrekt.",
            },
            {
              type: "ul",
              items: [
                "Företagsnamn respektive namnet på enskild firma",
                "Fakturaadress med land",
                "Skatte- respektive momsregistreringsnummer, om det finns",
                "Basvaluta för nya objekt",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Lägg till ditt första objekt",
          excerpt: "Så lägger du steg för steg till ditt första bokningsbara objekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Ett objekt i myNextDays är alltid exakt en bokningsbar enhet: antingen ett enskilt rum på ett hotell eller ett komplett semesterboende. Driver du ett hotell med flera rum lägger du till ett eget objekt för varje rum.",
            },
            { type: "h2", text: "Lägg till objekt" },
            {
              type: "steps",
              items: [
                "Öppna Objekt i menyn.",
                "Klicka på Lägg till objekt.",
                "Välj objekttyp: kategori, fastighetstyp och erbjudandetyp.",
                "Fyll i adress, beläggning och grundpris i din angivna valuta.",
                "Spara objektet som utkast för att komplettera det senare.",
              ],
            },
            { type: "h2", text: "Vad som saknas efter det" },
            {
              type: "p",
              text: "Ett nyskapat objekt är till en början ett utkast och syns inte på någon kanal. Komplettera utrustning, foton, beskrivning och kalendertillgänglighet innan du publicerar det — bara ett komplett objekt kan marknadsföras tillförlitligt.",
            },
            {
              type: "ul",
              items: [
                "Välj utrustningsegenskaper från kategorilistan",
                "Ange minst ett titelfoto och en beskrivning",
                "Fyll i beläggning (vuxna, barn, sängar) korrekt",
                "Kontrollera grundpris och kalendertillgänglighet",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Driver du flera rumstyper upprepar du detta för varje enskilt rum — det finns ingen övergripande byggnadsnivå med rum under sig.",
            },
            {
              type: "p",
              text: "När alla obligatoriska fält är ifyllda kan du publicera objektet, se [Publicera ett objekt](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Publicera ett objekt",
          excerpt: "Ett klick aktiverar plattformens marknadsplats, portaler och webbplats tillsammans.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Publicera gör ett objekt synligt och bokningsbart. Normalt räcker ett enda klick för att aktivera alla tre försäljningskanaler samtidigt — men du kan alltid justera synligheten per kanal individuellt.",
            },
            { type: "h2", text: "Så publicerar du" },
            {
              type: "steps",
              items: [
                "Öppna objektet under Objekt.",
                "Kontrollera i fliken Översikt att alla obligatoriska uppgifter är gröna.",
                "Klicka på Publicera.",
                "Bekräfta dialogrutan — plattformens marknadsplats, portaler och webbplats aktiveras.",
              ],
            },
            { type: "h2", text: "Styr kanaler individuellt" },
            {
              type: "p",
              text: "Efter publiceringen hittar du tre separata reglage i fliken Synlighet: webbplats, plattformens marknadsplats och portaler. Vill du till exempel bara erbjuda ett objekt på din egen webbplats men inte via portaler, stänger du helt enkelt av motsvarande reglage.",
            },
            {
              type: "ul",
              items: [
                "Webbplats: synlighet på din egen myNextDays-webbplats",
                "Plattformens marknadsplats: synlighet på den globala myBestDays-marknadsplatsen",
                "Portaler: synlighet på Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dessa tre reglage är oberoende av objektets status (aktiv/inaktiv). Ett aktivt objekt kan ändå vara osynligt på enskilda kanaler.",
            },
            { type: "h2", text: "Spärra objekt tillfälligt" },
            {
              type: "p",
              text: "Vill du spärra en enskild dag istället för hela objektet, använder du Stop-Sell i kalendern — det spärrar dagen på alla kanaler samtidigt, oberoende av synlighetsreglagen.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Förstå de tre försäljningskanalerna",
          excerpt: "Portaler, plattformens marknadsplats och app i översikt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays marknadsför varje objekt via flera likvärdiga vägar samtidigt. Att förstå hur dessa samverkar hjälper dig att styra synlighet och priser målinriktat.",
            },
            { type: "h2", text: "Portaler" },
            {
              type: "p",
              text: "Via kanalhanteraren kopplar du ditt objekt till stora bokningsportaler som Booking, Airbnb & Co. Tillgänglighet och priser synkroniseras automatiskt, så att du slipper underhålla flera portalkalendrar manuellt.",
            },
            { type: "h2", text: "Plattformens marknadsplats" },
            {
              type: "p",
              text: "myBestDays-marknadsplatsen är en egen, global bokningskanal — jämförbar med Booking eller Airbnb, men del av samma plattform. Den är inget ersättningsnamn för ”direktbokning”, utan en likvärdig kanal med egen synlighetsaxel.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "Mobilappen ger gäster, ägare och medarbetare tillgång till samma data som på webben — till exempel bokningsdetaljer, meddelanden eller uppgifter, beroende på respektive roll.",
            },
            { type: "h2", text: "Tre separata synlighetsaxlar" },
            {
              type: "ul",
              items: [
                "Webbplats — din egen myNextDays-webbplats",
                "Plattformens marknadsplats — den globala myBestDays-marknadsplatsen",
                "Portaler — Booking, Airbnb & Co. via kanalhanteraren",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Alla tre axlar kan slås av och på oberoende av varandra. Stop-Sell och objektets status verkar däremot kanalövergripande på alla tre samtidigt.",
            },
          ],
        },
      ],
    },
  ],
};
