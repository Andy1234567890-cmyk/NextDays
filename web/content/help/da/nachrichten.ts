import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Beskeder & gæster",
  description: "Indbakke, skabeloner og gæstekommunikation.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kommunikation",
      articles: [
        {
          slug: "posteingang",
          title: "Platform-indbakken",
          excerpt: "Alle gæstebeskeder fra dine boliger samles centralt i Platform-indbakken.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Én indbakke for alle boliger" },
            {
              type: "p",
              text: "Platform-indbakken samler alle beskeder fra dine gæster ét sted — uanset hvilken bolig eller hvilket tidsrum samtalen drejer sig om. Du åbner den under /nachrichten og ser der hver samtale som sin egen tråd.",
            },
            { type: "h2", text: "Indbakkens opbygning" },
            {
              type: "ul",
              items: [
                "Venstre kolonne: liste over alle samtaler, nyeste først",
                "Midterste kolonne: den aktive beskedhistorik med gæsten",
                "Højre kolonne: kontekst om reservationen — tidsrum, bolig, gæstedata",
              ],
            },
            { type: "h2", text: "Besvar en besked" },
            {
              type: "steps",
              items: [
                "Åbn /nachrichten, og vælg den ønskede samtale",
                "Skriv dit svar i tekstfeltet, eller brug et hurtigsvar",
                "Send beskeden — gæsten modtager den via den samme kanal, som vedkommende skrev igennem",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Platform-indbakken viser udelukkende den direkte kommunikation mellem dig og dine gæster på myNextDays — beskeder fra portalerne besvarer du fortsat der.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Hurtigsvar",
          excerpt: "Skabeloner til hyppige spørgsmål sparer tid i gæstekontakten.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Hvad hurtigsvar er" },
            {
              type: "p",
              text: "Hurtigsvar er færdigformulerede tekstblokke til tilbagevendende spørgsmål — for eksempel om ankomst, wifi-adgangskode eller parkeringsforhold. I stedet for at skrive hvert svar forfra, indsætter du den passende skabelon med ét klik i [Platform-indbakken](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Opret et hurtigsvar" },
            {
              type: "steps",
              items: [
                "Åbn /nachrichten, og klik på »Administrer hurtigsvar«",
                "Klik på »Ny skabelon«, og giv den en titel, for eksempel »Check-in-info«",
                "Skriv svarteksten; pladsholdere som gæstenavn eller ankomstdato indsættes automatisk ved afsendelse",
                "Gem skabelonen — den er fra nu af tilgængelig i enhver samtale",
              ],
            },
            { type: "h2", text: "Brug hurtigsvar i hverdagen" },
            {
              type: "p",
              text: "I beskedvinduet åbner du skabelonlisten via lynikonet, vælger det passende svar og tilpasser det om nødvendigt individuelt, før du sender det.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Opret skabeloner til de fem til ti hyppigste spørgsmål — det dækker i praksis størstedelen af de indkomne beskeder.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatiske beskeder",
          excerpt: "Bekræftelser, check-in-info og påmindelser kan sendes automatisk til gæster.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Automatiser tilbagevendende beskeder" },
            {
              type: "p",
              text: "I stedet for at sende bookingbekræftelser, check-in-oplysninger eller takkebeskeder manuelt, opretter du dem én gang som en regel — myNextDays sender dem derefter automatisk på det rette tidspunkt før, under eller efter opholdet.",
            },
            { type: "h2", text: "Typiske udløsere for automatiske beskeder" },
            {
              type: "ul",
              items: [
                "Direkte efter bookingen — bekræftelse med de vigtigste nøgletal",
                "Nogle dage før ankomst — check-in-information og adgangskode",
                "På afrejsedagen — tak og opfordring til en anmeldelse",
              ],
            },
            { type: "h2", text: "Opsæt en automatisk besked" },
            {
              type: "steps",
              items: [
                "Åbn /nachrichten, afsnittet »Automatiske beskeder«",
                "Vælg udløseren, for eksempel »X dage før ankomst«",
                "Indtast teksten — pladsholdere som gæstenavn, bolig eller ankomstdato udfyldes automatisk",
                "Aktiver reglen; den gælder for alle boliger, medmindre andet er begrænset",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatiske beskeder vises helt normalt i [Platform-indbakken](/hilfe/nachrichten/posteingang) og kan til enhver tid ses der efterfølgende.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Bloker beskeder",
          excerpt: "Du kan blokere en person for yderligere kontakt direkte fra beskedhistorikken.",
          updated: "Opdateret: juli 2026",
          body: [
            { type: "h2", text: "Hvornår en blokering giver mening" },
            {
              type: "p",
              text: "Ved fornærmende beskeder, chikane eller gentaget upassende adfærd kan du blokere en person direkte fra beskedtråden. En blokeret person kan derefter ikke længere skrive nye beskeder til dig eller oprette en ny booking hos dig.",
            },
            { type: "h2", text: "Bloker en person fra tråden" },
            {
              type: "steps",
              items: [
                "Åbn den relevante samtale i [Platform-indbakken](/hilfe/nachrichten/posteingang)",
                "Klik på menuen øverst i tråden, og vælg »Bloker person«",
                "Bekræft handlingen — blokeringen gælder med det samme",
              ],
            },
            { type: "h2", text: "Hvad blokeringen betyder — og hvad den ikke betyder" },
            {
              type: "ul",
              items: [
                "Nye beskeder fra den blokerede person leveres ikke længere",
                "Nye bookingforespørgsler fra personen afvises",
                "Er der aktuelt en løbende reservation for denne person, forbliver kommunikationen undtagelsesvis mulig resten af opholdet",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En blokering kan til enhver tid ophæves igen i oversigten »Blokerede personer« på kontoen. Tjek, om der allerede findes en aktiv booking, før du blokerer.",
            },
          ],
        },
      ],
    },
  ],
};
