import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Eigenaars & Afrekeningen",
  description: "Eigenaarsaccounts, afrekeningen en provisies.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Eigenaars",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Eigenaar aanmaken",
          excerpt: "Zo maakt u een nieuw eigenaarsaccount aan in myNextDays.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Eigenaars zijn eigen accounts in myNextDays waarmee u objecten beheert die aan een bepaalde persoon of onderneming toebehoren. Een eigenaarsaccount krijgt een beperkt, alleen-lezen inzicht in zijn eigen objecten, zonder zelf wijzigingen aan het bedrijf te kunnen aanbrengen.",
            },
            { type: "h2", text: "Nieuw eigenaarsaccount aanmaken" },
            {
              type: "steps",
              items: [
                "Open het gedeelte “Eigenaars” in het hoofdmenu.",
                "Klik op “Nieuwe eigenaar aanmaken”.",
                "Voer naam, e-mailadres en contactgegevens in.",
                "Voeg indien nodig het factuuradres voor afrekeningen toe.",
                "Sla het account op.",
              ],
            },
            { type: "h2", text: "Toegang instellen" },
            {
              type: "p",
              text: "Na het aanmaken kunt u de eigenaar een uitnodiging voor eigen toegang sturen. De eigenaar meldt zich vervolgens aan met eigen inloggegevens en ziet uitsluitend de aan hem toegewezen objecten.",
            },
            {
              type: "ul",
              items: [
                "Een eigenaarsaccount kan meerdere objecten omvatten.",
                "Elk object behoort tot precies één eigenaar.",
                "Contactgegevens en factuuradres kunnen op elk moment achteraf worden aangepast.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hoe u een bestaand object aan een eigenaar toewijst, leest u onder [Object aan een eigenaar toewijzen](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Object aan een eigenaar toewijzen",
          excerpt: "Elk object behoort tot precies één eigenaar — zo stelt u de toewijzing in.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays behoort elk object tot precies één eigenaar. Een meervoudige toewijzing is niet mogelijk — moet een object aan een andere eigenaar toebehoren, hef dan eerst de bestaande toewijzing op voordat u een nieuwe instelt.",
            },
            { type: "h2", text: "Toewijzing uitvoeren" },
            {
              type: "steps",
              items: [
                "Open het object onder “Objecten”.",
                "Ga naar het tabblad “Eigenaar”.",
                "Selecteer de verantwoordelijke eigenaar uit de lijst.",
                "Bevestig de toewijzing.",
                "Sla de wijziging aan het object op.",
              ],
            },
            { type: "h2", text: "Wijziging van eigenaar" },
            {
              type: "p",
              text: "Verandert de eigenaar van een object, bijvoorbeeld door een verkoop, vervang dan de bestaande toewijzing door de nieuwe. Reeds gemaakte afrekeningen voor eerdere periodes blijven daarbij aan de oorspronkelijke eigenaar toegewezen.",
            },
            {
              type: "ul",
              items: [
                "Een object kan op elk moment slechts aan één eigenaar zijn toegewezen.",
                "Zonder toewijzing verschijnt het object in geen enkele eigenaarstoegang.",
                "Eerdere afrekeningen blijven behouden bij de oorspronkelijke eigenaar.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een meervoudige toewijzing van een object aan meerdere eigenaars is uitgesloten — het systeem staat geen tweede gelijktijdige toewijzing toe.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Eigenaarsafrekening (statement)",
          excerpt: "Zo maakt u een statement met inkomsten minus provisie voor een eigenaar.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De eigenaarsafrekening, ook wel statement genoemd, vat voor een gekozen periode alle inkomsten van de toegewezen objecten samen en trekt uw overeengekomen provisie af. Het resultaat is het bedrag dat u aan de eigenaar uitbetaalt.",
            },
            { type: "h2", text: "Statement aanmaken" },
            {
              type: "steps",
              items: [
                "Open het gedeelte “Eigenaars” en selecteer de gewenste eigenaar.",
                "Ga naar het tabblad “Afrekening”.",
                "Selecteer de afrekeningsperiode.",
                "Controleer de weergegeven boekingen en inkomsten per object.",
                "Laat het statement met afgetrokken provisie aanmaken.",
              ],
            },
            { type: "h2", text: "Opbouw van het statement" },
            {
              type: "p",
              text: "Een statement toont per object de bruto-inkomsten uit boekingen, de daarvan afgetrokken provisie en het daaruit voortvloeiende uitbetalingsbedrag. Bijkomende kosten zoals schoonmaak of vergoedingen kunnen, afhankelijk van de afspraak, apart worden vermeld.",
            },
            {
              type: "ul",
              items: [
                "Bruto-inkomsten: som van alle boekingen in de periode per object.",
                "Provisie: uw overeengekomen aandeel, wordt van de inkomsten afgetrokken.",
                "Uitbetalingsbedrag: inkomsten minus provisie en eventuele overige posten.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Bedragen in het statement worden altijd weergegeven in de valuta van het object — er is geen standaard valuta-terugval.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Maak statements regelmatig op dezelfde peildatum aan, zodat eigenaars een betrouwbaar ritme voor hun uitbetalingen hebben.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Eigenaarstoegang",
          excerpt: "Wat eigenaars in hun alleen-lezen toegang kunnen zien.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De eigenaarstoegang is een eigen, alleen-lezen login voor myNextDays. Eigenaars zien hierin uitsluitend de aan hen toegewezen objecten en de bijbehorende bezettingen en afrekeningen — zonder de mogelijkheid zelf instellingen te wijzigen.",
            },
            { type: "h2", text: "Wat eigenaars zien" },
            {
              type: "ul",
              items: [
                "Bezettingskalender van hun eigen objecten.",
                "Aangemaakte statements met inkomsten en afgetrokken provisie.",
                "Basisgegevens van hun objecten, zoals voorzieningen en beschrijving.",
              ],
            },
            { type: "h2", text: "Toegang activeren" },
            {
              type: "steps",
              items: [
                "Open de eigenaar onder “Eigenaars”.",
                "Klik op “Toegang uitnodigen”.",
                "De eigenaar ontvangt een e-mail om zijn eigen wachtwoord in te stellen.",
                "Na het inloggen ziet de eigenaar automatisch alleen zijn toegewezen objecten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "De eigenaarstoegang is strikt alleen-lezen: prijzen, beschikbaarheid of objectgegevens kunt alleen u als bedrijf wijzigen, niet de eigenaar zelf.",
            },
            {
              type: "note",
              variant: "info",
              text: "Meer over het toewijzen van objecten vindt u onder [Object aan een eigenaar toewijzen](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
