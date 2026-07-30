import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalender & beschikbaarheid",
  description: "Belegplan, stopverkoop en minimumverblijf.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalender",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Het belegplan lezen",
          excerpt: "Zo leest u boekingen, beschikbaarheid en prijzen correct af in het belegplan.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Het belegplan toont u in één oogopslag welke nachten geboekt, beschikbaar of geblokkeerd zijn. Bij vakantieobjecten ziet u één rij per object, bij hotels een verweven weergave met één rij per kamercategorie en tariefplan.",
            },
            { type: "h2", text: "Opbouw van de weergave" },
            {
              type: "steps",
              items: [
                "Open de kalender via het menu-onderdeel “Belegplan”.",
                "Kies bovenaan de periode die u wilt bekijken.",
                "Filter indien nodig op afzonderlijke objecten of kamercategorieën.",
                "Klik op een dag om details over prijs en beschikbaarheid te openen.",
                "Klik op een bezette periode om de bijbehorende boeking te openen.",
              ],
            },
            { type: "h2", text: "Kleuren en symbolen" },
            {
              type: "ul",
              items: [
                "Bezet: de periode is gereserveerd door een boeking.",
                "Beschikbaar: de dag kan op alle actieve kanalen worden geboekt.",
                "Geblokkeerd: de dag is door stopverkoop of een handmatige blokkering niet boekbaar.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Elke rij in het belegplan staat voor precies één boekbare eenheid — een kamer of een vakantieobject. Er is geen containerrij voor meerdere kamers tegelijk.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Meer over het gericht openen en sluiten van afzonderlijke dagen vindt u onder [Beschikbaarheid instellen](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Beschikbaarheid instellen",
          excerpt: "Afzonderlijke dagen of periodes gericht openen en sluiten.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Beschikbaarheid bepaalt of een object op een bepaalde dag kan worden geboekt. U kunt afzonderlijke dagen of hele periodes openen of sluiten, rechtstreeks in het belegplan.",
            },
            { type: "h2", text: "Periode bewerken" },
            {
              type: "steps",
              items: [
                "Open het belegplan van het gewenste object.",
                "Markeer de gewenste periode door te klikken en te slepen.",
                "Kies in het actiemenu “Beschikbaarheid wijzigen”.",
                "Bevestig of de periode moet worden geopend of gesloten.",
                "Sla de wijziging op.",
              ],
            },
            { type: "h2", text: "Gevolg voor kanalen" },
            {
              type: "p",
              text: "Een beschikbaarheidswijziging werkt door op alle verkoopkanalen waarop het object zichtbaar is: portalen zoals Booking, Airbnb & Co., het eigen platform en de app. De doorgifte naar de portalen gebeurt automatisch op de achtergrond.",
            },
            {
              type: "ul",
              items: [
                "Openen: de dag wordt boekbaar op alle actieve kanalen.",
                "Sluiten: de dag verdwijnt uit de boekbaarheid, maar blijft zichtbaar in de kalender.",
                "Reeds bestaande boekingen worden niet beïnvloed door een beschikbaarheidswijziging.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Sluit een periode niet met de bedoeling deze volledig en permanent voor verkoop te blokkeren — daarvoor is stopverkoop de juiste functie, zie [Stopverkoop](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stopverkoop",
          excerpt: "Stopverkoop blokkeert een dag onmiddellijk op alle verkoopkanalen tegelijk.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Stopverkoop is de snelste manier om een afzonderlijke dag volledig uit de verkoop te halen. Anders dan een gewone beschikbaarheidswijziging werkt stopverkoop hard en onmiddellijk op alle kanalen tegelijk — op de portalen, het eigen platform en in de app.",
            },
            { type: "h2", text: "Stopverkoop instellen" },
            {
              type: "steps",
              items: [
                "Open het belegplan van het betreffende object.",
                "Kies de gewenste dag of periode.",
                "Klik in het actiemenu op “Stopverkoop activeren”.",
                "Bevestig de blokkering.",
              ],
            },
            { type: "h2", text: "Wanneer stopverkoop zinvol is" },
            {
              type: "ul",
              items: [
                "Kortdurende onderhoudswerkzaamheden of technische problemen in het object.",
                "Een bijzonder geval waarbij u onmiddellijk en zonder uitzondering geen nieuwe boeking wilt.",
                "Een snelle, platformbrede noodblokkering, zonder elk kanaal afzonderlijk te bewerken.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stopverkoop kent geen kanaalspecifieke uitzondering: is een dag geblokkeerd, dan kan geen gast via geen enkel kanaal boeken, ook niet via de receptie of een directe aanvraag.",
            },
            {
              type: "note",
              variant: "info",
              text: "Voor permanent eigen gebruik of geplande onderhoud is in plaats daarvan de [Handmatige blokkering](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung) geschikt.",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimum- & maximumverblijf",
          excerpt: "Hoe lang gasten minstens of hoogstens mogen boeken.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Met minimum- en maximumverblijf bepaalt u hoeveel nachten een gast voor een aankomstdag minstens of hoogstens kan boeken. Dit helpt om korte gatboekingen te voorkomen of uw object gericht te positioneren voor langere verblijven.",
            },
            { type: "h2", text: "Regel instellen" },
            {
              type: "steps",
              items: [
                "Open in het object het belegplan of het tabblad “Prijzen”.",
                "Kies de betreffende periode.",
                "Vul onder “Minimumverblijf” het minimale aantal nachten in.",
                "Vul optioneel onder “Maximumverblijf” een maximaal aantal nachten in.",
                "Sla de regel op.",
              ],
            },
            { type: "h2", text: "Typische toepassingen" },
            {
              type: "ul",
              items: [
                "Hoogseizoen: hoger minimumverblijf, om wisseldagen te bundelen.",
                "Laagseizoen: lager minimumverblijf, om meer boekingen mogelijk te maken.",
                "Maximumverblijf: zinvol wanneer een object daarna vrij moet zijn voor onderhoud of ander gebruik.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De regel geldt voor de aankomstdag: een gast kan op een dag met een minimumverblijf van drie nachten niet voor slechts twee nachten aankomen, ook al zijn de afzonderlijke dagen beschikbaar.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combineer langere minimumverblijven met [Verblijfskortingen](/hilfe/preise-raten/aufenthaltsrabatte) om de prikkel voor gasten te vergroten.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Handmatige blokkering",
          excerpt: "Periodes gericht reserveren voor eigen gebruik of onderhoud.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Een handmatige blokkering reserveert een periode in de kalender zonder dat er een echte gastboeking aan ten grondslag ligt — bijvoorbeeld voor eigen gebruik, geplande onderhoudswerkzaamheden of renovaties. De periode wordt in het belegplan weergegeven als een boeking, maar is duidelijk herkenbaar als blokkering.",
            },
            { type: "h2", text: "Blokkering aanmaken" },
            {
              type: "steps",
              items: [
                "Open het belegplan van het betreffende object.",
                "Markeer de gewenste periode.",
                "Kies in het actiemenu “Handmatig blokkeren”.",
                "Geef een reden op, bijvoorbeeld “Eigen gebruik” of “Onderhoud”.",
                "Sla de blokkering op.",
              ],
            },
            { type: "h2", text: "Verschil met stopverkoop" },
            {
              type: "p",
              text: "Een handmatige blokkering reserveert concreet een periode voor een bepaald, gedocumenteerd doel en kan later weer worden vrijgegeven. Voor een onmiddellijke, platformbrede noodblokkering zonder gedocumenteerde periode is daarentegen stopverkoop bedoeld.",
            },
            {
              type: "ul",
              items: [
                "Handmatige blokkering: gepland, met reden, voor eigen gebruik of onderhoud.",
                "Vrijgave op elk moment mogelijk zodra de periode niet meer nodig is.",
                "Geblokkeerde nachten tellen niet als gastboeking en verschijnen niet in het omzetoverzicht.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Verwijder een handmatige blokkering zodra de reden vervalt — anders blijft het object onnodig geblokkeerd op alle kanalen.",
            },
            {
              type: "note",
              variant: "info",
              text: "Voor een onmiddellijke blokkering zonder geplande periode gebruikt u [Stopverkoop](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
