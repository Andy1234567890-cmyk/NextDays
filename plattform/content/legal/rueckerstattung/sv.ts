import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Omboknings- och återbetalningspolicy",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Denna policy gäller när något är grundläggande fel med ett boende som bokats via myBestDays — den är därmed det åtagande som går utöver leverantörens avbokningsvillkor.",
    "Den gäller för bokningar som ingåtts och betalats via plattformen.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. När denna policy gäller",
      paragraphs: [
        "Den gäller när någon av följande händelser inträffar före eller under vistelsen:",
      ],
      list: [
        "Leverantören avbokar bokningen.",
        "Leverantören är inte nåbar vid ankomsten eller du får inte tillträde till boendet.",
        "Boendet är obeboeligt — t.ex. på grund av avsaknad av uppvärmning vid kyla, avsaknad av rinnande vatten, otillräcklig renhållning eller en hälsofara.",
        "Boendet avviker väsentligt från annonsen — annat antal sovplatser eller rum, en annan plats, en i annonsen utlovad och faktiskt saknad central utrustning.",
        "En annan gäst, som inte var aviserad, vistas i boendet.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Vad du måste göra",
      paragraphs: [
        "Anmäl problemet så tidigt som möjligt, dock senast 24 timmar efter att du upptäckt det — vid problem vid ankomsten alltså på ankomstdagen.",
        "Anmäl det först till leverantören via meddelandefunktionen och ge denne möjlighet att åtgärda det. Vid fara för din hälsa eller om leverantören inte är nåbar bortfaller denna skyldighet.",
        "Styrk problemet om möjligt med bilder, videor eller meddelanden. Utan underlag kan vi ofta inte fastställa sakförhållandet.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Vad vi gör",
      paragraphs: [
        "Bekräftas problemet har du valet mellan ett jämförbart ersättningsboende och en återbetalning.",
        "Väljer du ett ersättningsboende står vi för merpriset jämfört med din ursprungliga bokning, i den mån ersättningsboendet är jämförbart i fråga om läge, utrustning och storlek.",
        "Väljer du återbetalningen återbetalar vi vid ett problem före ankomst hela det belopp som betalats via plattformen. Uppstår problemet under vistelsen återbetalar vi andelen för de nätter som inte kan användas samt ett skäligt belopp för olägenheten för de redan tillbringade nätterna.",
        "Vårt beslut meddelar vi dig med en motivering. Du kan få det prövat via vägen under [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Vad som inte omfattas",
      paragraphs: ["Denna policy gäller inte vid:"],
      list: [
        "omständigheter som beskrivits i annonsen eller framgått av bilderna;",
        "obetydliga avvikelser som inte påverkar användningen (t.ex. en annan väggfärg eller en annan soffa);",
        "tillfälliga störningar som leverantören åtgärdar inom skälig tid;",
        "omständigheter utanför boendet som leverantören inte har inflytande över — väder, trafik, kommunens byggarbetsplatser, stängning av sevärdheter (för detta gäller [Policy vid allvarliga störningar](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen));",
        "problem som du eller dina medresenärer orsakat;",
        "bokningar som ingåtts eller betalats utanför plattformen.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Förhållandet till dina lagstadgade rättigheter",
      paragraphs: [
        "Denna policy är ett frivilligt åtagande från myBestDays. Dina lagstadgade anspråk mot leverantören — särskilt prisavdrag och skadestånd — påverkas inte och kan gå längre.",
        "I den mån vi återbetalar till dig övergår motsvarande anspråk mot leverantören på oss.",
      ],
    },
  ],
};
