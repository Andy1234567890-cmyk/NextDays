import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Webbplatsbyggare",
  description: "Skapa din egen bokningswebbplats med byggaren.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Webbplatsbyggare",
      articles: [
        {
          slug: "website-erstellen",
          title: "Skapa en webbplats",
          excerpt: "Med byggaren skapar du på några minuter en egen bokningswebbplats.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Webbplatsbyggaren skapar en egen bokningswebbplats åt dig — en ytterligare försäljningskanal vid sidan av portaler och myNextDays-marknadsplatsen. Du behåller full kontroll över uppbyggnad, innehåll och varumärke.",
            },
            { type: "h2", text: "Så skapar du en webbplats" },
            {
              type: "steps",
              items: [
                "Öppna Webbplats i menyn.",
                "Klicka på Skapa webbplats.",
                "Välj en mall som utgångspunkt för din layout.",
                "Bekräfta med Skapa webbplats — du kommer direkt till redigeraren.",
              ],
            },
            { type: "h2", text: "Vad byggaren innehåller" },
            {
              type: "ul",
              items: [
                "En visuell redigerare med sidor, lager och förhandsgranskningsvy",
                "Färdiga byggstenar för objektlistor, gallerier och kontaktformulär",
                "En direkt bokningsprocess som baseras på din kalendertillgänglighet",
                "Anpassningsbara färger, typsnitt och logotyp som matchar ditt varumärke",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Börja med en mall som ligger nära din objekttyp — semesterboende eller hotell — det sparar dig tid när du anpassar byggstenarna senare.",
            },
            { type: "h2", text: "Nästa steg" },
            {
              type: "p",
              text: "Efter skapandet anpassar du sidor och layout, se [Redigera sidor och layout](/hilfe/website/seiten-layout), och visar dina objekt på webbplatsen, se [Visa objekt på webbplatsen](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Redigera sidor och layout",
          excerpt: "Anpassa sidor, lager och byggstenar i den visuella redigeraren.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Redigeraren är indelad i tre områden: till vänster sid- och lageröversikten, i mitten förhandsgranskningen av din webbplats, till höger inställningarna för den valda byggstenen.",
            },
            { type: "h2", text: "Redigera en sida" },
            {
              type: "steps",
              items: [
                "Välj önskad sida under Sidor till vänster.",
                "Klicka på en byggsten i förhandsgranskningen för att välja den.",
                "Anpassa text, bild eller avstånd för byggstenen till höger.",
                "Dra byggstenar med dra-och-släpp för att ändra ordningen.",
              ],
            },
            { type: "h2", text: "Lägga till nya sidor och byggstenar" },
            {
              type: "p",
              text: "Via knappen Lägg till sida skapar du fler undersidor, till exempel Om oss eller Kontakt. Inom en sida infogar du nya avsnitt som galleri, recensioner eller kontaktformulär via Lägg till byggsten.",
            },
            {
              type: "ul",
              items: [
                "Startsida, objektöversikt och kontakt finns fördefinierade i varje mall",
                "Fler sidor kan namnges fritt och tas med i navigeringen",
                "Byggstenarna är responsiva och anpassar sig till dator, surfplatta och smartphone",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ändringar i redigeraren är till en början bara ett utkast. Först ett klick på Publicera för över dem till din offentliga webbplats.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Ansluta domän",
          excerpt: "Koppla en egen domän till din myNextDays-webbplats.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Som standard nås din webbplats via en myNextDays-subdomän. Vill du istället använda en egen domän, till exempel dinverksamhet.se, ansluter du den i området Domän.",
            },
            { type: "h2", text: "Ange domän" },
            {
              type: "steps",
              items: [
                "Öppna inställningarna i webbplatsen och där Domän.",
                "Ange din egen domän och klicka på Anslut.",
                "Skapa de visade DNS-posterna hos din domänleverantör.",
                "Vänta på bekräftelsen — kontrollen sker automatiskt i bakgrunden.",
              ],
            },
            { type: "h2", text: "Ange DNS-poster korrekt" },
            {
              type: "p",
              text: "myNextDays visar dig exakt vilka poster som krävs hos din domänleverantör. Anslutningen aktiveras först när dessa poster är korrekt inställda och har spridits globalt — det kan ta några timmar beroende på leverantör.",
            },
            {
              type: "ul",
              items: [
                "Ange CNAME- eller A-post enligt den visade anvisningen",
                "Ta bort befintliga, motstridiga poster för samma domän i förväg",
                "Certifikat för https utfärdas automatiskt efter lyckad anslutning",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan korrekt inställda DNS-poster förblir din webbplats onåbar under den egna domänen — kontrollera stavningen noggrant mot din leverantörs uppgifter.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Visa objekt på webbplatsen",
          excerpt: "Vilka objekt som är synliga och bokningsbara via webbplatsen styr du separat per objekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "För att ett objekt ska visas på din webbplats måste webbplatssynligheten för objektet vara påslagen. Detta reglage är oberoende av synligheten på myNextDays-marknadsplatsen eller på portaler.",
            },
            { type: "h2", text: "Aktivera objekt för webbplatsen" },
            {
              type: "steps",
              items: [
                "Öppna objektet under Objekt.",
                "Byt till fliken Synlighet.",
                "Aktivera reglaget Webbplats.",
                "Byt till webbplatsen och kontrollera byggstenen Objektöversikt i förhandsgranskningen.",
              ],
            },
            { type: "h2", text: "Anpassa ordning och visning" },
            {
              type: "p",
              text: "I byggstenen Objektöversikt fastställer du om objekt sorteras automatiskt efter tillgänglighet eller om du anger en fast ordning. Varje objekt visar titelfoto, grundpris i sin angivna valuta och de viktigaste utrustningsegenskaperna.",
            },
            {
              type: "ul",
              items: [
                "Automatisk sortering efter tillgänglighet eller manuell ordning",
                "Filter efter objekttyp eller utrustning kan aktiveras valfritt",
                "Bokningsstegen sker direkt på webbplatsen, utan omväg via portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ett objekt utan aktiverad webbplatssynlighet döljs från objektöversikten, även om det är synligt på marknadsplatsen eller hos portaler.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Publicera webbplats",
          excerpt: "Utkast blir offentligt synliga först med ett klick på Publicera.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Så länge du arbetar i redigeraren är det bara du som ser det aktuella utkastet. Först ett klick på Publicera gör ändringarna synliga för alla besökare under din domän.",
            },
            { type: "h2", text: "Så publicerar du" },
            {
              type: "steps",
              items: [
                "Öppna förhandsgranskningen i redigeraren och kontrollera alla sidor.",
                "Klicka på Publicera uppe till höger.",
                "Bekräfta dialogrutan — webbplatsen är omedelbart live efteråt.",
                "Öppna din domän i en ny flik för att kontrollera resultatet.",
              ],
            },
            { type: "h2", text: "Utkast och återställning" },
            {
              type: "p",
              text: "Så länge du ännu inte har publicerat kan du när som helst återgå till senast publicerade version, utan att slutgiltigt förlora utkastet — använd Förkasta utkast i webbplatsinställningarna för det.",
            },
            {
              type: "ul",
              items: [
                "Publicerade ändringar syns omedelbart under din domän",
                "Ett opublicerat utkast förblir internt tills du bekräftar det",
                "Varje publicering registreras med datum i historiken",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollera den mobila vyn i förhandsgranskningen innan du publicerar — de flesta gäster besöker bokningswebbplatser via smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
