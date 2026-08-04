import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Priser och rateplaner",
  description: "Rateplaner, säsongspriser och dynamiska priser.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Prissättning",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Grundpris och valuta",
          excerpt: "Så fastställer du grundpriset och tilldelar ditt objekt rätt valuta.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Varje objekt i myNextDays är exakt en bokningsbar enhet — ett enskilt rum eller ett semesterboende. För denna enhet anger du ett grundpris samt en central valuta som gäller för hela objektet.",
            },
            { type: "h2", text: "Fastställ valuta centralt" },
            {
              type: "p",
              text: "Objektets valuta anges en gång per objekt och gäller automatiskt för alla rateplaner du skapar för det objektet. Det finns ingen separat valuta-fallback — saknas valutan kan du inte spara priser.",
            },
            {
              type: "steps",
              items: [
                "Öppna ditt objekt under ”Objekt”.",
                "Byt till fliken ”Priser”.",
                "Välj rätt valuta under ”Objektets valuta”.",
                "Ange grundpriset för standardbeläggningen.",
                "Spara ändringarna.",
              ],
            },
            { type: "h2", text: "Vad som händer vid en valutaändring" },
            {
              type: "p",
              text: "Ändrar du objektets valuta i efterhand påverkar det alla befintliga rateplaner för objektet, eftersom de alltid förs i objektets valuta. Kontrollera dina priser efteråt, innan du överför dem till portalerna på nytt.",
            },
            {
              type: "ul",
              items: [
                "Ett objekt har exakt en valuta — inte flera per rateplan.",
                "Grundpriset är utgångsvärdet för härledda priser.",
                "Belopp visas alltid i den angivna objektvalutan.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Utan angiven valuta går det inte att spara något pris eller överföra någon rate till portaler. Kontrollera detta först om en prisändring misslyckas.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mer om härledda priser hittar du under [Härledda rateplaner](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Skapa rateplaner",
          excerpt: "Rateplaner samlar pris, avbokningsvillkor och förplägnad för ett objekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "En rateplan definierar på vilka villkor ett objekt kan bokas: pris, avbokningsregler, förplägnad och minsta vistelse. Ett objekt kan erbjuda flera rateplaner samtidigt, till exempel en flexibel och en icke avbokningsbar plan.",
            },
            { type: "h2", text: "Skapa ny rateplan" },
            {
              type: "steps",
              items: [
                "Öppna objektet och byt till fliken ”Priser”.",
                "Klicka på ”Skapa ny rateplan”.",
                "Ge planen ett tydligt namn, t.ex. ”Flexibel” eller ”Ej avbokningsbar”.",
                "Fastställ om planen är en basrate eller en härledd rate.",
                "Ange avbokningsvillkor och förplägnad.",
                "Spara och aktivera rateplanen.",
              ],
            },
            { type: "h2", text: "Basrate kontra övriga rateplaner" },
            {
              type: "p",
              text: "Skapa först din basrate (ofta kallad ”BAR”, Best Available Rate). Alla övriga rateplaner kan antingen underhållas fristående eller härledas från denna basrate.",
            },
            {
              type: "ul",
              items: [
                "Basrate: manuellt underhållet grundpris per natt.",
                "Övriga rateplaner: fristående eller som tillägg/avdrag på basraten.",
                "Varje rateplan kan överföras till portaler individuellt.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Håll antalet rateplaner per objekt överskådligt — för många varianter försvårar för gäster att jämföra och ökar underhållsarbetet.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detaljer om tillägg och avdrag hittar du under [Härledda rateplaner](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Härledda rateplaner",
          excerpt: "Härledda rateplaner beräknas automatiskt utifrån en basrate.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "En härledd rate är en rateplan vars pris inte underhålls manuellt, utan beräknas automatiskt utifrån en basrate — som ett fast tillägg, avdrag eller en procentsats. Det sparar underhållsarbete, eftersom en prisändring på basraten automatiskt uppdaterar alla härledda planer.",
            },
            { type: "h2", text: "Typiskt exempel" },
            {
              type: "p",
              text: "Ett vanligt mönster är en plan med frukost som härleds från basraten utan förplägnad: frukostpriset definieras som ett tillägg per natt och person på basraten. Ändrar du basraten anpassas frukostpriset automatiskt.",
            },
            { type: "h2", text: "Ställ in härledd rate" },
            {
              type: "steps",
              items: [
                "Öppna önskad rateplan i fliken ”Priser”.",
                "Välj ”Härledd från …” som priskälla och tillhörande basrate.",
                "Bestäm om skillnaden ska gälla som ett fast belopp eller en procentsats.",
                "Fastställ om det rör sig om ett tillägg eller ett avdrag.",
                "Spara kopplingen.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tillägg: t.ex. förplägnad, senare avbokningsbarhet.",
                "Avdrag: t.ex. icke avbokningsbar plan med prisfördel.",
                "Basraten förblir den enda manuellt underhållna källan.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "En härledd rate kan inte samtidigt skrivas över manuellt. Ta först bort härledningen om du vill sätta ett enskilt pris avvikande.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Säsongs- och helgpriser",
          excerpt: "Anpassa priser för säsongsperioder och helger målinriktat.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Efterfrågan varierar över året och inom veckan. Med säsongs- och helgpriser anpassar du grundpriset för vissa perioder eller veckodagar, utan att behöva gå in i kalendern för varje dag för sig.",
            },
            { type: "h2", text: "Skapa säsongsperiod" },
            {
              type: "steps",
              items: [
                "Öppna fliken ”Priser” i objektet och området ”Säsongspriser”.",
                "Skapa en ny period med start- och slutdatum.",
                "Ange priset eller den procentuella avvikelsen från grundpriset för denna period.",
                "Spara säsongsperioden.",
              ],
            },
            { type: "h2", text: "Helgpriser" },
            {
              type: "p",
              text: "Dessutom kan du förse enskilda veckodagar, till exempel fredag och lördag, med ett eget tillägg. Detta tillägg gäller utöver det aktuella säsongs- eller grundpriset.",
            },
            {
              type: "ul",
              items: [
                "Säsongspriser gäller för sammanhängande perioder.",
                "Helgpriser gäller per veckodag, oberoende av säsong.",
                "Båda reglerna kan kombineras.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Överlappar flera säsongsperioder gäller den senast skapade respektive mest specifika regeln. Kontrollera kalendern efter att du har sparat.",
            },
            {
              type: "note",
              variant: "tip",
              text: "För automatiska, efterfrågebaserade anpassningar passar dessutom [Dynamiska priser](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynamiska priser",
          excerpt: "Anpassa priser automatiskt efter efterfrågan, framförhållning och beläggning.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dynamiska priser är en betald tilläggsmodul. Du beställer den under ”Tillägg”, där även priset står. Utan modulen räknar automatiken inte ut några priser.",
            },
            {
              type: "p",
              text: "Dynamiska priser anpassar grundpriset automatiskt utifrån faktorer som bokningsframförhållning, aktuell beläggning och efterfrågan — på liknande sätt som stora portaler gör med sina egna prisrekommendationer. På så sätt reagerar du på marknadsförändringar utan att justera manuellt varje dag.",
            },
            { type: "h2", text: "Aktivera dynamiska priser" },
            {
              type: "steps",
              items: [
                "Öppna fliken ”Priser” i objektet och området ”Dynamiska priser”.",
                "Aktivera funktionen för objektets basrate.",
                "Fastställ en prisnedre gräns och en prisövre gräns.",
                "Bestäm hur mycket beläggningen får påverka priset.",
                "Spara inställningarna.",
              ],
            },
            { type: "h2", text: "Gränser och säkerhet" },
            {
              type: "p",
              text: "Prisnedre gräns och prisövre gräns förhindrar att den automatiska algoritmen sätter priser som inte är hållbara för din verksamhet. Härledda rateplaner följer automatiskt den dynamiskt beräknade basraten.",
            },
            {
              type: "ul",
              items: [
                "Prisnedre gräns skyddar mot för låga priser vid svag efterfrågan.",
                "Prisövre gräns skyddar mot uppdrivna priser vid hög efterfrågan.",
                "Härledda rateplaner tar automatiskt över den nya basraten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynamiska priser gäller bara basraten. Manuellt fast inställda rateplaner utan härledning ändras inte automatiskt med.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Vistelserabatter",
          excerpt: "Ställ in rabatter för längre vistelser och tidiga bokningar.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Vistelserabatter belönar gäster för längre bokningar eller tidig bokning. De tillämpas som en procentsats på vistelsens totalpris och kan konfigureras oberoende per objekt.",
            },
            { type: "h2", text: "Rabattyper" },
            {
              type: "ul",
              items: [
                "Långtidsrabatt: från ett visst antal nätter, t.ex. från 7 eller 28 nätter.",
                "Tidigbokarrabatt: vid bokning tillräckligt långt i förväg.",
                "Sistaminutenrabatt: vid kortfristig bokning nära ankomstdatumet.",
              ],
            },
            { type: "h2", text: "Ställ in rabatt" },
            {
              type: "steps",
              items: [
                "Öppna fliken ”Priser” i objektet och området ”Rabatter”.",
                "Välj önskad rabattyp.",
                "Fastställ tröskeln, t.ex. minsta antal nätter eller framförhållning.",
                "Ange rabatten i procent.",
                "Spara regeln.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Rabatter gäller på totalpriset för respektive rateplan och visas för gästen redan i prisöversikten.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinera långtidsrabatter med [Minsta och längsta vistelse](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) för att målinriktat främja längre bokningar.",
            },
          ],
        },
      ],
    },
  ],
};
