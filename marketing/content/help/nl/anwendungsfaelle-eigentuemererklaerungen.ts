import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Eigenaarsafrekeningen",
  description: "Eigenaarsafrekeningen opstellen.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Eigenaarsafrekeningen",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Een eigenaarsafrekening genereren",
          excerpt: "Zo maakt u voor een eigenaar een overzichtelijke afrekening van diens periode.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Beheert u objecten voor eigenaren, dan hebben zij regelmatig een navolgbaar overzicht nodig van inkomsten, ingehouden provisie en uitbetaling van hun objecten voor een bepaalde periode — de eigenaarsafrekening vat deze gegevens automatisch samen.",
            },
            {
              type: "steps",
              items: [
                "Open in het account het onderdeel Eigenaren en selecteer de betreffende eigenaar.",
                "Kies de afrekenperiode waarvoor de afrekening moet worden opgesteld.",
                "Controleer dat alle objecten van deze eigenaar correct zijn toegewezen, want alleen toegewezen objecten worden in de afrekening opgenomen.",
                "Laat de afrekening genereren en controleer de vermelde reserveringen op volledigheid.",
                "Stel de afrekening beschikbaar voor de eigenaar via de eigenaarstoegang of exporteer deze als document.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De afrekening toont elke reservering met bedrag in de betreffende objectvaluta — er is geen algemene valuta-aanduiding, omdat meerdere objecten ook verschillende valuta kunnen hebben. Meer over de toewijzing onder [Object aan een eigenaar toewijzen](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Provisie met de eigenaar afrekenen",
          excerpt: "Zo zorgt u dat uw provisie correct wordt berekend uit de inkomsten van de eigenaar.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Uw provisie voor het beheer van een object is vastgelegd in het tarief van de eigenaar en wordt bij elke afrekening automatisch afgetrokken van de bruto-inkomsten. Om de afrekening kloppend te houden, moet het provisiepercentage vóór de eerste boeking in de periode correct zijn ingesteld.",
            },
            {
              type: "steps",
              items: [
                "Open in het account het tarief van de betreffende eigenaar en controleer het vastgelegde provisiepercentage.",
                "Pas het percentage indien nodig aan voordat nieuwe reserveringen in de komende afrekenperiode binnenkomen.",
                "Genereer de eigenaarsafrekening voor de periode en controleer dat de provisie per reservering correct wordt weergegeven.",
                "Controleer de som van bruto-inkomsten, afgetrokken provisie en netto-uitbetaling op plausibiliteit.",
                "Bespreek afwijkingen vóór vrijgave van de afrekening rechtstreeks met de eigenaar, in plaats van de afrekening achteraf te wijzigen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een latere wijziging van het provisiepercentage werkt alleen door op toekomstige periodes, niet met terugwerkende kracht op reeds gegenereerde afrekeningen. Controleer het percentage daarom tijdig vóór het begin van een nieuwe afrekenperiode — zie ook [Eigenaarsafrekening (statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
