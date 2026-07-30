import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Team och behörigheter",
  description: "Medarbetare, roller och åtkomsträttigheter.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Åtkomst",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Bjuda in medarbetare",
          excerpt: "Så bjuder du in nya medarbetare till ditt myNextDays-konto.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Till din verksamhet kan du bjuda in valfritt antal medarbetare — till exempel för reception, städning eller administration. Varje inbjudan är kopplad till en e-postadress och tilldelar direkt en fast roll som avgör åtkomsten på webben och i myNextDays-appen.",
            },
            { type: "h2", text: "Skicka inbjudan" },
            {
              type: "steps",
              items: [
                "Öppna ”Konto” och byt till avsnittet ”Team”.",
                "Klicka på ”Bjud in medarbetare”.",
                "Ange personens e-postadress.",
                "Välj rätt roll, t.ex. medarbetare eller städning.",
                "Bekräfta inbjudan.",
              ],
            },
            { type: "h2", text: "Vad som händer därefter" },
            {
              type: "p",
              text: "Den inbjudna personen får ett e-postmeddelande med en länk för att ange ett eget lösenord och logga in. Inloggningen gäller lika för webbdashboarden och myNextDays-appen — det finns inget separat konto per frontend.",
            },
            {
              type: "ul",
              items: [
                "En inbjudan är giltig tills den accepteras eller dras tillbaka.",
                "Öppna inbjudningar ser du i avsnittet ”Team” med status ”Väntande”.",
                "Rollen kan alltid justeras i efterhand.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vilken roll som får se vilka områden framgår av [Roller och behörigheter](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ge från början den snävast passande rollen — rättigheter kan alltid utökas senare.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Roller och behörigheter",
          excerpt: "De fem rollerna i myNextDays och vad de respektive får göra.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays skiljer på fem roller: admin, co-admin, medarbetare, städning och ägare. Varje roll avgör vilka områden som är synliga på webbdashboarden och i myNextDays-appen — rättigheterna tillämpas serverside, inte bara döljs i gränssnittet.",
            },
            { type: "h2", text: "Rollerna i översikt" },
            {
              type: "ul",
              items: [
                "Admin: full åtkomst till alla områden, inklusive finanser, försäljning och teamhantering.",
                "Co-admin: nästan full åtkomst som admin, för verksamhetens andra ledningsnivå.",
                "Medarbetare: operativ åtkomst till bokningar, kalender och uppgifter, utan finans- eller försäljningsinblick.",
                "Städning: uteslutande åtkomst till tilldelade städuppgifter och objektdetaljer, utan finans- eller försäljningsinblick.",
                "Ägare: skrivskyddad inblick i sina egna objekt, ingen förvaltning av andras objekt.",
              ],
            },
            { type: "h2", text: "Tilldela eller ändra roll" },
            {
              type: "steps",
              items: [
                "Öppna ”Konto” → ”Team”.",
                "Välj den aktuella medarbetaren från listan.",
                "Klicka på ”Ändra roll”.",
                "Välj den nya rollen och bekräfta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Medarbetare och städning ser i grunden inga priser, intäkter eller bokningskanaler — denna uteslutning gäller serverside och kan inte kringgås via gränssnittet.",
            },
            {
              type: "note",
              variant: "info",
              text: "En översikt per roll hittar du under [Vad varje roll ser](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Vad varje roll ser",
          excerpt: "Konkreta områden och vyer per roll på webben och i appen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Utöver de grundläggande rättigheterna från [Roller och behörigheter](/hilfe/team-rollen/rollen-berechtigungen) hjälper en konkret genomgång av enskilda områden dig att sätta rätt förväntningar vid onboarding av nya medarbetare.",
            },
            { type: "h2", text: "Kalender och bokningar" },
            {
              type: "p",
              text: "Admin, co-admin och medarbetare ser den fullständiga beläggningsplanen med gästuppgifter och uppgifter. Städning ser bara sina tilldelade tider samt objektadress och checklista, men inga gästnamn eller priser. Ägare ser beläggningskalendern uteslutande för sina egna objekt, rent läsande.",
            },
            { type: "h2", text: "Finanser och försäljning" },
            {
              type: "ul",
              items: [
                "Intäkter, provisioner och fakturor: endast admin och co-admin.",
                "Portaler (OTA-anslutning) och plattformssynlighet: endast admin och co-admin.",
                "Medarbetare och städning: ingen åtkomst till finans- eller försäljningsområden, inte heller till detaljsidor.",
              ],
            },
            { type: "h2", text: "Team och inställningar" },
            {
              type: "p",
              text: "Hanteringen av medarbetare, roller och kontoinställningar förbehålls admin och co-admin. Ägare och operativa roller ser inte alls detta område varken i myNextDays-appen eller på webbdashboarden.",
            },
            {
              type: "note",
              variant: "info",
              text: "Denna uppdelning gäller identiskt på webbdashboarden och i myNextDays-appen, eftersom båda frontendarna hämtar samma roll från ditt konto.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Testa nya roller kort tillsammans med medarbetaren efter inbjudan, för att undvika missförstånd om synliga områden.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Återkalla åtkomst",
          excerpt: "Ta bort medarbetaråtkomst omedelbart och fullständigt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Lämnar en medarbetare din verksamhet eller ändras samarbetet, tar du bort åtkomsten direkt i kontot. Återkallandet verkar serverside och omedelbart — inte först efter att en befintlig session löper ut.",
            },
            { type: "h2", text: "Ta bort åtkomst" },
            {
              type: "steps",
              items: [
                "Öppna ”Konto” → ”Team”.",
                "Välj den aktuella medarbetaren.",
                "Klicka på ”Återkalla åtkomst”.",
                "Bekräfta åtgärden.",
              ],
            },
            { type: "h2", text: "Påverkan på pågående sessioner" },
            {
              type: "p",
              text: "Efter återkallandet kan personen inte längre logga in vare sig på webbdashboarden eller i myNextDays-appen. Redan tilldelade uppgifter eller städtider bör du tilldela en annan medarbetare i förväg, så att inget lämnas obearbetat.",
            },
            {
              type: "ul",
              items: [
                "Tilldela öppna uppgifter på nytt innan återkallandet.",
                "Åtkomsten kan återställas senare via en ny inbjudan.",
                "Återkallandet gäller bara denna verksamhet, inte personens andra konton.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Återkalla åtkomsten snabbt så snart ett samarbete avslutas — annars förblir öppna medarbetarkonton en onödig säkerhetsrisk.",
            },
          ],
        },
      ],
    },
  ],
};
