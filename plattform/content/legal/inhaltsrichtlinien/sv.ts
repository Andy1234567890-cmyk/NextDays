import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Riktlinjer för lämpligt innehåll",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Dessa riktlinjer gäller för allt innehåll som användare lägger in på myBestDays: annonser, bilder, omdömen, meddelanden, profiluppgifter och svar på omdömen.",
    "De utgör en del av [Användarvillkoren](https://mybestdays.dk/rechtliches/nutzungsbedingungen). En överträdelse kan leda till att innehållet tas bort och till åtgärder mot kontot.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Vad som inte är tillåtet",
      paragraphs: ["På myBestDays är särskilt följande innehåll otillåtet:"],
      list: [
        "rättsstridigt innehåll av alla slag, särskilt uppmaningar till brott, terrorrelaterat innehåll och material med sexuella övergrepp mot barn;",
        "innehåll som uppviglar till hat eller våld mot personer eller grupper på grund av ursprung, hudfärg, religion, övertygelse, kön, könsidentitet, sexuell läggning, funktionsnedsättning eller ålder;",
        "förolämpningar, hot, trakasserier och riktat uthängande av enskilda personer;",
        "tredje mans personuppgifter utan dennes samtycke, särskilt namn, adresser, telefonnummer, id- eller betalningsuppgifter;",
        "vilseledande uppgifter om ett boende, dess läge, utrustning, storlek eller tillgänglighet;",
        "andras bilder, texter eller varumärken utan nödvändiga rättigheter;",
        "reklam, skräppost och innehåll som leder till andra bokningsvägar utanför plattformen;",
        "skadlig programvara, nätfiskeförsök och länkar till sådant innehåll;",
        "erbjudanden om något annat än en logitjänst.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Bilder",
      paragraphs: [
        "Bilder måste visa det faktiskt erbjudna boendet och vara tagna i ett skick som motsvarar det nuvarande.",
        "Bilder får inte visa igenkännbara personer utan deras samtycke. Bearbetning är tillåten i den mån den inte förvanskar intrycket av boendet — en ljusare bild ja, en bortretuscherad grannbyggnad nej.",
        "Kamerabaserad övervakning i boendet ska anges i annonsen. I inomhusutrymmen där gäster har en berättigad förväntan om privatliv — sovrum, badrum — är kameror otillåtna, även avstängda.",
      ],
    },
    {
      id: "melden",
      heading: "3. Anmäla innehåll",
      paragraphs: [
        "Anser du att ett innehåll är rättsstridigt eller strider mot dessa riktlinjer kan du anmäla det via anmälningsfunktionen vid varje annons, varje omdöme och varje meddelande.",
        "Anmälningsförfarandet enligt artikel 16 i förordning (EU) 2022/2065 och handläggningen av anmälningar beskrivs under [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Hur vi upprätthåller reglerna",
      paragraphs: [
        "Vi prövar varje anmält innehåll och väljer den mildaste lämpliga åtgärden: en upplysning, borttagande av den berörda delen, borttagande av hela innehållet, begränsning av synligheten, spärr av en funktion eller spärr av kontot.",
        "Upprepade eller allvarliga överträdelser väger tyngre. Vid uppenbart rättsstridigt innehåll eller fara för personer agerar vi omedelbart.",
        "Varje åtgärd motiverar vi gentemot den berörda personen och hänvisar till klagomålsvägen. Klagomålet handläggs av människor.",
      ],
    },
  ],
};
