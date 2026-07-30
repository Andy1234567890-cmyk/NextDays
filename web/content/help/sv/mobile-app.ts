import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilapp",
  description: "myNextDays-appen för på språng.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "myNextDays-appen",
          excerpt: "Ett konto, fyra upplevelser: gäst, byrå, ägare och medarbetare.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-appen är den mobila plattformen för hela din verksamhet. Den är ingen separat produkt, utan ett likvärdigt frontend till din webbdashboard — båda använder samma konto och samma data, bara gränssnittet är optimerat för på språng.",
            },
            { type: "h2", text: "Fyra upplevelser i en app" },
            {
              type: "ul",
              items: [
                "Gäst: se bokningar, kommunicera med verksamheten, hämta incheckningsinformation.",
                "Byrå: förvalta flera verksamheter och objekt i översikt.",
                "Ägare: skrivskyddad inblick i sina egna objekt, beläggning och rapporter.",
                "Medarbetare: kalender, uppgifter och städscheman för den operativa vardagen.",
              ],
            },
            { type: "h2", text: "Vilken upplevelse du ser" },
            {
              type: "p",
              text: "Efter inloggningen visar appen automatiskt rätt upplevelse för din roll — samma roll som även gäller på webbdashboarden. En medarbetare med begränsade rättigheter ser i appen exakt samma begränsningar som i webbläsaren, eftersom behörigheten kontrolleras serverside.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mer om roller och vad de respektive får se hittar du under [Roller och behörigheter](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Du behöver ingen separat registrering för appen — logga bara in med dina befintliga myNextDays-inloggningsuppgifter.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Installera app och logga in",
          excerpt: "Så laddar du ner myNextDays-appen och loggar in.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-appen finns tillgänglig för iOS och Android. Inloggningen sker med samma uppgifter som på webbdashboarden — det behövs inget separat konto och ingen ny registrering.",
            },
            { type: "h2", text: "Installation" },
            {
              type: "steps",
              items: [
                "Öppna App Store (iOS) eller Google Play (Android).",
                "Sök efter ”myNextDays”.",
                "Installera appen på din smartphone eller surfplatta.",
                "Öppna appen efter installationen.",
              ],
            },
            { type: "h2", text: "Inloggning" },
            {
              type: "steps",
              items: [
                "Tryck på ”Logga in”.",
                "Ange din e-postadress och ditt lösenord.",
                "Bekräfta vid behov tvåfaktorsfrågan.",
                "Du kommer automatiskt till rätt upplevelse för din roll.",
              ],
            },
            {
              type: "ul",
              items: [
                "Inloggningsuppgifterna är identiska med webbdashboarden.",
                "Har din åtkomst återkallats, spärras även inloggningen i appen omedelbart.",
                "Vid problem med lösenordet använder du ”Glömt lösenord” direkt i appen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Logga in uteslutande via det officiella App Store-inlägget ”myNextDays”; appen frågar aldrig efter inloggningsuppgifter utanför inloggningsskärmen.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Förvalta på språng",
          excerpt: "Hantera bokningar, meddelanden och uppgifter direkt från smartphonen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays-appen passar särskilt bra för den löpande driften på språng: du ser aktuella bokningar, besvarar gästmeddelanden och arbetar av uppgifter utan att behöva sitta vid datorn — ändringar visas i realtid även på webbdashboarden.",
            },
            { type: "h2", text: "Koll på bokningar" },
            {
              type: "p",
              text: "I avsnittet ”Bokningar” ser du ankomster och avresor, beläggning och status per objekt. Medarbetare och städning ser här bara den för dem relevanta informationen, utan priser eller försäljningsdetaljer.",
            },
            { type: "h2", text: "Meddelanden och uppgifter" },
            {
              type: "steps",
              items: [
                "Öppna avsnittet ”Meddelanden” för att besvara gästförfrågningar direkt.",
                "Byt till ”Uppgifter” för att se dina tilldelade att-göra-poster.",
                "Tryck på en uppgift för att öppna detaljer och slutföra den.",
                "Markera utförda städtider som avslutade direkt på plats.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nya meddelanden och uppgifter visas direkt, utan manuell uppdatering.",
                "Avslutade uppgifter syns omedelbart även på webbdashboarden.",
                "Ägare ser bokningar och rapporter för sina objekt, men rent läsande.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push-notiser informerar dig om nya meddelanden och tilldelade uppgifter, så snart du tillåter dem i enhetsinställningarna.",
            },
          ],
        },
      ],
    },
  ],
};
