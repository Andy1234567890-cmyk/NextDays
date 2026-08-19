import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Meddelanden och gäster",
  description: "Inkorg, mallar och gästkommunikation.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kommunikation",
      articles: [
        {
          slug: "posteingang",
          title: "Plattformens inkorg",
          excerpt: "Alla gästmeddelanden för dina objekt samlas centralt i plattformens inkorg.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "En inkorg för alla objekt" },
            {
              type: "p",
              text: "Plattformens inkorg samlar alla meddelanden från dina gäster på ett ställe — oberoende av vilket objekt eller vilken period konversationen gäller. Du öppnar den under /nachrichten och ser där varje konversation som en egen tråd.",
            },
            { type: "h2", text: "Inkorgens uppbyggnad" },
            {
              type: "ul",
              items: [
                "Vänster kolumn: lista över alla konversationer, senaste först",
                "Mittenkolumn: den aktiva meddelandehistoriken med gästen",
                "Höger kolumn: kontext om reservationen — period, objekt, gästuppgifter",
              ],
            },
            { type: "h2", text: "Svara på ett meddelande" },
            {
              type: "steps",
              items: [
                "Öppna /nachrichten och välj önskad konversation",
                "Skriv ditt svar i textfältet eller använd ett snabbsvar",
                "Skicka meddelandet — gästen får det via samma väg som hen skrev via",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Plattformens inkorg visar uteslutande den direkta kommunikationen mellan dig och dina gäster på myNextDays — meddelanden från portalerna hanterar du fortfarande där.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Snabbsvar",
          excerpt: "Mallar för vanliga frågor sparar tid i gästkontakten.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Vad snabbsvar är" },
            {
              type: "p",
              text: "Snabbsvar är förformulerade textblock för återkommande frågor — till exempel om ankomst, wifi-lösenordet eller parkeringssituationen. Istället för att skriva varje svar på nytt infogar du den passande mallen med ett klick i [Plattformens inkorg](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Skapa ett snabbsvar" },
            {
              type: "steps",
              items: [
                "Öppna /nachrichten och klicka på ”Hantera snabbsvar”",
                "Klicka på ”Ny mall” och ge den en titel, till exempel ”Incheckningsinfo”",
                "Skriv svarstexten; platshållare som gästnamn eller ankomstdatum fylls i automatiskt vid utskick",
                "Spara mallen — den finns tillgänglig i varje konversation direkt",
              ],
            },
            { type: "h2", text: "Använda snabbsvar i vardagen" },
            {
              type: "p",
              text: "I meddelandefönstret öppnar du mallistan via blixtsymbolen, väljer det passande svaret och anpassar det vid behov individuellt innan du skickar det.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Skapa mallar för de fem till tio vanligaste frågorna — det täcker i praktiken merparten av inkommande meddelanden.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatiska meddelanden",
          excerpt: "Bekräftelser, incheckningsinfo och påminnelser kan skickas automatiskt till gäster.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "Automatisera återkommande meddelanden" },
            {
              type: "p",
              text: "Istället för att skicka bokningsbekräftelser, incheckningsinformation eller tackmeddelanden manuellt, anger du dem en gång som en regel — myNextDays skickar dem sedan automatiskt vid rätt tidpunkt före, under eller efter vistelsen.",
            },
            { type: "h2", text: "Typiska utlösare för automatiska meddelanden" },
            {
              type: "ul",
              items: [
                "Direkt efter bokningen — bekräftelse med de viktigaste uppgifterna",
                "Några dagar före ankomst — incheckningsinformation och åtkomstkod",
                "På avresedagen — tack och begäran om en recension",
              ],
            },
            { type: "h2", text: "Ställa in ett automatiskt meddelande" },
            {
              type: "steps",
              items: [
                "Öppna /nachrichten, avsnittet ”Automatiska meddelanden”",
                "Välj utlösaren, till exempel ”X dagar före ankomst”",
                "Ange texten — platshållare som gästnamn, objekt eller ankomstdatum fylls i automatiskt",
                "Aktivera regeln; den gäller för alla objekt, om inget annat begränsats",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatiska meddelanden visas som vanligt i [Plattformens inkorg](/hilfe/nachrichten/posteingang) och kan alltid granskas där i efterhand.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blockera meddelanden",
          excerpt: "Du kan spärra en person direkt från meddelandehistoriken för vidare kontakt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            { type: "h2", text: "När en blockering är lämplig" },
            {
              type: "p",
              text: "Vid kränkande meddelanden, trakasserier eller upprepat olämpligt beteende kan du blockera en person direkt från meddelandetråden. En blockerad person kan därefter inte längre skriva nya meddelanden till dig och kan inte skapa någon ny bokning hos dig.",
            },
            { type: "h2", text: "Blockera en person från tråden" },
            {
              type: "steps",
              items: [
                "Öppna den berörda konversationen i [Plattformens inkorg](/hilfe/nachrichten/posteingang)",
                "Klicka på menyn högst upp i tråden och välj ”Blockera person”",
                "Bekräfta åtgärden — blockeringen gäller omedelbart",
              ],
            },
            { type: "h2", text: "Vad blockeringen innebär — och vad den inte innebär" },
            {
              type: "ul",
              items: [
                "Nya meddelanden från den blockerade personen levereras inte längre",
                "Nya bokningsförfrågningar från personen avvisas",
                "Pågår för närvarande en reservation för denna person förblir kommunikationen undantagsvis möjlig under vistelsens gång",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En blockering kan alltid hävas i översikten ”Blockerade personer” under Konto. Kontrollera innan du blockerar om det redan finns en pågående bokning.",
            },
          ],
        },
      ],
    },
  ],
};
