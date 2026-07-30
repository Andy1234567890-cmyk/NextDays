import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reservationer och kalender",
  description: "Håll koll på reservationer och kalender.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reservationer och kalender",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Undvika överbokningar tillförlitligt",
          excerpt: "Så säkerställer du att ett objekt aldrig dubbelbokas.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Ett objekt säljs via flera kanaler samtidigt — portaler som Booking, Airbnb & Co., den egna plattformen samt appen. En överbokning uppstår när tillgängligheten på en kanal inte spärras i tid efter att en bokning gjorts på en annan kanal.",
            },
            {
              type: "steps",
              items: [
                "Kontrollera i beläggningsplanen att varje objekt utgör exakt en rad med en bokningsbar enhet — ingen gemensam kapacitet för flera rum.",
                "Låt nya bokningar skapas uteslutande via beläggningsplanen eller de anslutna kanalerna, aldrig genom att manuellt beskriva enskilda dagar.",
                "Kontrollera efter varje bokning att de bokade nätterna omedelbart visas som bokade i kalendern.",
                "Använd stop-sell omedelbart vid tekniska problem eller underhåll, istället för att lämna dagen öppen.",
                "Kontrollera vid oklarheter bokningens tidslinje för den berörda reservationen för att följa det tidsmässiga förloppet.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ändra aldrig nätter eller spärrningar manuellt utanför beläggningsplanen — bara så säkerställs att alla kanaler ser samma tillgänglighetsläge och att ingen lucka för en dubbelbokning uppstår.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Flytta en bokning till ett annat objekt",
          excerpt: "Så flyttar du en befintlig reservation korrekt till ett annat objekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Ibland måste en gäst flytta från ett objekt till ett annat, till exempel på grund av ett tekniskt fel eller på gästens önskemål. Vid flytten frigörs de tidigare kalendernätterna automatiskt och beläggs på nytt i målobjektet.",
            },
            {
              type: "steps",
              items: [
                "Öppna den berörda bokningen i bokningens tidslinje.",
                "Välj ”Byt objekt” respektive ”Flytta” i åtgärdsmenyn.",
                "Välj målobjektet och kontrollera dess tillgänglighet för den valda perioden.",
                "Bekräfta flytten.",
                "Kontrollera därefter i beläggningsplanen att de gamla nätterna i ursprungsobjektet visas som tillgängliga igen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Frigörandet av de gamla nätterna sköts automatiskt av systemet — du behöver inte själv öppna ursprungsperioden manuellt. Informera gästen om objektbytet, särskilt om utrustning eller tillträde skiljer sig åt.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Skapa en långtidsbokning",
          excerpt: "Så skapar du korrekt en reservation över en längre period.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "För långtidsgäster — till exempel flera veckor eller månader — skapar du en reservation som vanligt, men lägger dessutom extra vikt vid minsta vistelse, betalningsregler och objektets kanalsynlighet under hela perioden.",
            },
            {
              type: "steps",
              items: [
                "Öppna beläggningsplanen för önskat objekt och markera hela perioden.",
                "Skapa bokningen med gästuppgifterna och det planerade ankomst- och avresedatumet.",
                "Ställ vid behov in en betalningsregel med handpenning och slutbetalning, istället för att ta ut hela beloppet direkt.",
                "Kontrollera att ingen minsta- eller längsta vistelseregel motsäger den långa perioden.",
                "Spara bokningen och kontrollera att hela perioden visas korrekt som bokad i kalendern.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Vid mycket långa vistelser rekommenderas en slutbetalning i flera delbelopp istället för en enda stor förfallodag — så förblir betalningsrisken hanterbar. Detaljer om det under [Automatisera slutbetalningen](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
