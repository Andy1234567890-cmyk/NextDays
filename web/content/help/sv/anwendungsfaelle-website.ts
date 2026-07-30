import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Webbplats",
  description: "Använd din webbplats optimalt.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Webbplats",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Publicera din webbplats live",
          excerpt: "Så publicerar du din egen webbplats som en fristående försäljningskanal.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Din webbplats är en egen försäljningskanal vid sidan av portaler och plattformen. Du bygger upp sidorna i redigeraren, men först vid publiceringen blir webbplatsen synlig för gäster och dina objekt visas bokningsbara där.",
            },
            {
              type: "steps",
              items: [
                "Öppna webbplatsredigeraren och kontrollera att alla önskade sidor är fyllda med innehåll.",
                "Välj per objekt i objektfliken om det ska vara synligt på webbplatsen — denna synlighet är oberoende av portaler och plattformen.",
                "Kontrollera förhandsgranskningen på dator- och mobilvy innan du går live.",
                "Klicka på ”Publicera” för att göra webbplatsen tillgänglig för gäster.",
                "Kontrollera efter publiceringen den offentliga URL:en och testa en exempelbokning via webbplatsen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ett objekts webbplatssynlighet är en egen axel — ett objekt kan vara aktivt på portaler men dolt på webbplatsen och tvärtom. Detaljer under [Ställa in en egen domän](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Ställa in en egen domän",
          excerpt: "Så kopplar du din egen domän till din myNextDays-webbplats.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "En egen domän som www.dinverksamhet.se verkar mer professionell än en standardadress och stärker ditt varumärke gentemot gäster som vill boka direkt hos dig.",
            },
            {
              type: "steps",
              items: [
                "Öppna området ”Domän” i webbplatsredigeraren och ange din önskade egna domän.",
                "Ställ in de visade DNS-posterna (vanligtvis CNAME eller A-post) hos din domänleverantör.",
                "Vänta tills domänen visas som ansluten och SSL-certifikatet som aktivt — det kan ta några timmar beroende på leverantör.",
                "Testa att öppna den egna domänen i ett privat webbläsarfönster för att utesluta cachade gamla poster.",
                "Kontrollera att gamla standardadresser fortsätter att omdirigera till den nya domänen, så att befintliga länkar inte leder fel.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ändra DNS-poster bara enligt anvisningen — felaktiga värden kan störa befintliga e-postinställningar för din domän. Kontrollera vid osäkerhet med din domänleverantör innan du skriver över befintliga poster.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Öka direktbokningar",
          excerpt: "Så styr du fler gäster till din egen webbplats istället för portaler.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "h2",
              text: "Utgångsläge",
            },
            {
              type: "p",
              text: "Bokningar via den egna webbplatsen är oftast förmånligare för din verksamhet än via portaler, eftersom ingen portalprovision tas ut här. Med några målinriktade åtgärder ökar du andelen direktbokningar via din webbplats som fristående kanal.",
            },
            {
              type: "steps",
              items: [
                "Säkerställ att alla bokningsbara objekt är synliga på webbplatsen och försedda med aktuella foton och beskrivningar.",
                "Ställ in en webbplatsexklusiv rabatt eller fördel, till exempel en liten prisnedsättning jämfört med portaler.",
                "Länka till din egen domän i bokningsbekräftelser och kommunikationen med gäster som redan bokat en gång.",
                "Kontrollera regelbundet bokningsstatistiken för att följa webbplatsens andel av alla bokningar över tid.",
                "Optimera laddningstid och mobil visning av webbplatsen, eftersom en stor del av gästerna bokar via smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "En webbplatsexklusiv fördel fungerar bara om gäster överhuvudtaget hittar webbplatsen — hänvisa aktivt till den, istället för att bara förlita dig på portaler. Om publicering, se [Publicera din webbplats live](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
