import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Riktlinjer för myndighets- och brottsbekämpningsförfrågningar",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Dessa riktlinjer riktar sig till myndigheter, domstolar och brottsbekämpande organ som begär uppgifter från myBestDays eller riktar ett föreläggande mot innehåll. De är offentliga här så att även användare kan läsa under vilka förutsättningar vi lämnar ut uppgifter.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Utgångspunkt",
      paragraphs: [
        "Vi lämnar ut användaruppgifter endast när det finns en giltig rättslig grund och förfrågan uppfyller de formella kraven. En formlös begäran om uppgifter räcker inte.",
        "Vi prövar varje förfrågan med avseende på behörighet, rättslig grund, bestämdhet och proportionalitet och lämnar endast ut de uppgifter som förfrågan anger.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Krav på en förfrågan",
      paragraphs: ["En förfrågan bör innehålla:"],
      list: [
        "det begärande organet, diarienumret och kontaktuppgifter till den handläggande personen på officiellt brevpapper;",
        "den rättsliga grunden enligt nationell rätt eller unionsrätt;",
        "en exakt angivelse av den berörda personen eller det berörda kontot — e-postadress, bokningsnummer eller annons-URL;",
        "de exakt angivna uppgifterna och perioden;",
        "i förekommande fall ett domstolsbeslut, i den mån tillämplig rätt kräver det;",
        "en upplysning om underrättelse av den berörda personen skulle äventyra utredningen, med angivande av den rättsliga grunden.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Förelägganden enligt förordning (EU) 2022/2065",
      paragraphs: [
        "Förelägganden om att vidta åtgärder mot rättsstridigt innehåll (artikel 9) och förelägganden om att lämna information (artikel 10) måste innehålla de där angivna uppgifterna, särskilt den rättsliga grunden, den exakta elektroniska platsen, motiveringen, rättsmedlen och språket.",
        "Vi bekräftar mottagandet och meddelar den utfärdande myndigheten vilka åtgärder vi vidtagit och när.",
        "Om ett föreläggande informerar vi den berörda personen senast vid tidpunkten för verkställigheten, om inte myndigheten med angivande av den rättsliga grunden förordnar om uppskov.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Nödsituationer",
      paragraphs: [
        "Föreligger omedelbar fara för liv eller kroppslig integritet lämnar vi ut de uppgifter som krävs för att avvärja den även utan föregående formellt föreläggande. Märk en sådan förfrågan uttryckligen som nödsituation och beskriv faran.",
        "Finns det hållpunkter för ett brott som innebär fara för en persons liv eller säkerhet underrättar vi på eget initiativ behöriga myndigheter (artikel 18 i förordning (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Vilka uppgifter vi har",
      paragraphs: [
        "Vilka kategorier av uppgifter vi behandlar och hur länge vi lagrar dem framgår av [Integritetspolicy](https://mybestdays.dk/rechtliches/datenschutz). Utöver de där angivna tiderna lagrar vi inga uppgifter.",
        "Någon lagring utöver behovet sker inte. En uppmaning att tillfälligt säkra uppgifter för ett pågående förfarande verkställer vi inom rättsligt tillåtna ramar.",
        "Fullständiga betalningsuppgifter finns inte hos oss; de ska begäras från betaltjänstleverantören.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Underrättelse av den berörda personen",
      paragraphs: [
        "Vi underrättar berörda användare om en förfrågan som rör deras uppgifter, om inte en rättsregel eller ett motiverat myndighetsföreläggande förbjuder det eller det föreligger omedelbar fara för liv eller kroppslig integritet.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Vart förfrågningar ska riktas",
      paragraphs: [
        "Förfrågningar riktar du till den centrala kontaktpunkten för myndigheter som anges under [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa). Vi handlägger dem på tyska, danska och engelska.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparens",
      paragraphs: [
        "Antal och art av förelägganden från myndigheter anger vi i vår årliga transparensrapport; se [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
