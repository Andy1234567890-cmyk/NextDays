import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Huurprijzen",
  description: "Huurprijzen optimaal vaststellen.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Huurprijzen",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Prijzen voor het hoogseizoen optimaliseren",
          excerpt: "Zo verhoogt u uw prijzen gericht voor periodes met sterke vraag.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "In het hoogseizoen stijgt de vraag aanzienlijk, terwijl uw basisprijs dezelfde waarden hanteert als de rest van het jaar. Zonder seizoensaanpassing laat u omzet liggen in de sterkste periode van het jaar — de aanpassing gebeurt via het tariefplan van uw object, niet door handmatig afzonderlijke dagen te overschrijven.",
            },
            {
              type: "steps",
              items: [
                "Open het tariefplan van het betreffende object en maak een seizoensregel aan voor de gewenste periode.",
                "Stel de toeslag in als percentage of vast bedrag boven de basisprijs — het tariefplan neemt automatisch de objectvaluta over.",
                "Controleer in de kalender dat de nieuwe prijs voor de hoogseizoenperiode correct wordt weergegeven voordat u deze activeert.",
                "Controleer het minimumverblijf voor het hoogseizoen — vaak is een hogere minimale boekingsduur zinvol om de bezetting beheersbaar te houden.",
                "Volg na activering de boekingssituatie gedurende de eerste dagen op en pas de toeslag indien nodig aan.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Een seizoensregel werkt kanaaloverstijgend, dus gelijk op portalen, platform en website. Meer over het opbouwen van regels vindt u onder [Tariefplannen](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Langere verblijven met korting stimuleren",
          excerpt: "Zo beloont u gasten met een langere verblijfsduur en vermindert u wisselwerkzaamheden.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Korte verblijven betekenen meer aankomsten en vertrekken, meer schoonmaakbeurten en meer risico op leegstand tussen boekingen. Een gestaffelde verblijfskorting maakt langere boekingen aantrekkelijker voor gasten en vermindert deze inspanning merkbaar.",
            },
            {
              type: "steps",
              items: [
                "Open het tariefplan van het object en maak een verblijfskorting aan.",
                "Definieer minstens één staffel, bijvoorbeeld vanaf 7 nachten of vanaf 28 nachten, met het bijbehorende kortingspercentage.",
                "Controleer dat de staffels elkaar niet overlappen en dat de korting alleen vanaf de betreffende minimumduur geldt.",
                "Test in de kalender een voorbeeldboeking over de kortingsgrens heen om de correcte toepassing te bevestigen.",
                "Activeer de korting en volg het effect op de gemiddelde verblijfsduur en bezetting.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Verblijfskortingen zijn te combineren met seizoensregels — het tariefplan berekent beide aanpassingen samen. Meer hierover onder [Tariefplannen](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
