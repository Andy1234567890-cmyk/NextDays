import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Upphovsrättspolicy",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "myBestDays respekterar tredje mans rättigheter och förväntar sig detsamma av sina användare. Denna policy beskriver hur du anmäler ett upphovsrättsintrång och hur vi hanterar det.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Utgångspunkt",
      paragraphs: [
        "Den som lägger in innehåll på plattformen garanterar att inneha de nödvändiga rättigheterna. Detta gäller särskilt bilder, planritningar, texter och kartutsnitt i annonser.",
        "Att lägga in andras innehåll utan tillstånd är en överträdelse av [Användarvillkoren](https://mybestdays.dk/rechtliches/nutzungsbedingungen) och av [Riktlinjer för lämpligt innehåll](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Anmäla ett intrång",
      paragraphs: [
        "Anmäl ett upphovsrättsintrång via anmälningsfunktionen vid det berörda innehållet eller via den kontaktpunkt som anges under [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa). En anmälan bör innehålla:",
      ],
      list: [
        "en exakt angivelse av det påtalade innehållet, särskilt URL:en;",
        "en beskrivning av det skyddade verket och bevis för din rättighetsinnehavarskap eller din behörighet att agera för rättighetsinnehavaren;",
        "en motivering till varför användningen inte är tillåten;",
        "ditt namn och en kontaktadress;",
        "förklaringen att dina uppgifter enligt bästa förmåga är riktiga och fullständiga.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Hur vi handlägger anmälningar",
      paragraphs: [
        "Vi bekräftar mottagandet av din anmälan omgående och beslutar skyndsamt och omsorgsfullt.",
        "Anser vi anmälan befogad tar vi bort innehållet eller spärrar tillgången till det och informerar den person som lagt in det, med angivande av skälen och klagomålsvägen.",
        "Anser vi anmälan obefogad meddelar vi dig det med en motivering.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Invändning från den berörda personen",
      paragraphs: [
        "Har ditt innehåll tagits bort och anser du det obefogat kan du inom sex månader klaga kostnadsfritt. Redogör då för varför du är berättigad till användningen.",
        "Visar sig klagomålet befogat återställer vi innehållet.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Upprepade intrång",
      paragraphs: [
        "Konton genom vilka det upprepat läggs in intrångsgörande innehåll spärrar vi efter föregående varning. Detta motsvarar artikel 23 i förordning (EU) 2022/2065.",
        "På samma sätt spärrar vi anmälningsfunktionen för personer som upprepat lämnar uppenbart obefogade anmälningar.",
      ],
    },
  ],
};
