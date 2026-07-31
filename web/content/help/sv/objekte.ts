import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objekt och utrustning",
  description: "Skapa och underhåll rum och semesterboenden.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Hantera objekt",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Objekt = en bokningsbar enhet",
          excerpt: "Varför varje objekt i myNextDays är exakt en bokningsbar enhet.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "I myNextDays är ett objekt alltid exakt en bokningsbar enhet — ett enskilt rum på ett hotell eller ett komplett semesterboende. Denna princip gäller oavsett om du driver ett semesterhus, en semesterlägenhet eller ett hotell, och är grunden för tillgänglighet, priser och bokningar.",
            },
            { type: "h2", text: "Ingen byggnad med rum under sig" },
            {
              type: "p",
              text: "Ett vanligt missförstånd är att avbilda en hotellbyggnad som ett objekt med flera rum under sig. Det är inte tänkt så i myNextDays. Driver du till exempel ett hotell med åtta dubbelrum och fyra enkelrum lägger du till tolv enskilda objekt — inte ett objekt med ett antal rum.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ett fält som ”antal rum” på objektnivå finns medvetet inte. Varje rum behöver ett eget objekt med egen kalender och egna priser.",
            },
            { type: "h2", text: "Semesterboenden" },
            {
              type: "p",
              text: "För ett semesterhus eller en semesterlägenhet motsvarar hela objektet den bokningsbara enheten. Här finns ingen ytterligare uppdelning — ett semesterboende är alltid ett fristående objekt med egen kalender.",
            },
            { type: "h2", text: "Varför det är viktigt" },
            {
              type: "ul",
              items: [
                "Varje objekt har en egen tillgänglighetskalender — dubbelbokningar förhindras objektexakt.",
                "Priser, utrustning och foton gäller per objekt, inte per byggnad.",
                "Ett objekt tillhör alltid exakt en ägare — ingen flerdubbel tilldelning.",
                "Kanalsynlighet (webbplats, plattformens marknadsplats, portaler) styrs per objekt.",
              ],
            },
            {
              type: "p",
              text: "Hur du väljer rätt objekttyp för ditt rum eller semesterboende läser du under [Fastställ objekttyp](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Fastställ objekttyp",
          excerpt: "Tilldela kategori, fastighetstyp och erbjudandetyp korrekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Objekttypen avgör hur ditt objekt kategoriseras och filtreras på portaler och plattformens marknadsplats. Den består av tre valfält som bygger på varandra och som du går igenom när du lägger till eller redigerar ett objekt.",
            },
            { type: "h2", text: "De tre valnivåerna" },
            {
              type: "steps",
              items: [
                "Välj först kategorin — till exempel semesterboende eller hotell.",
                "Välj sedan fastighetstypen baserat på det — till exempel semesterlägenhet, semesterhus, dubbelrum eller enkelrum.",
                "Välj erbjudandetypen — till exempel hela objektet eller ett privat rum.",
                "Fyll i de ytterligare fält som visas beroende på ditt val, till exempel sängtyp eller våning.",
              ],
            },
            { type: "h2", text: "Varför ordningen är viktig" },
            {
              type: "p",
              text: "De tre rullgardinsmenyerna beror på varandra: valet av kategori begränsar de tillgängliga fastighetstyperna, och valet av fastighetstyp begränsar i sin tur erbjudandetyperna. På så sätt uppstår bara meningsfulla kombinationer, som de som också används på stora portaler.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ändrar du kategorin i efterhand kontrollerar myNextDays om fastighetstyp och erbjudandetyp fortfarande passar, och uppmanar dig vid behov att välja på nytt.",
            },
            { type: "h2", text: "Redigera objekttyp" },
            {
              type: "p",
              text: "Öppna önskat objekt under Objekt i menyn och byt till fliken Grunddata. Där hittar du de tre rullgardinsmenyerna under Objekttyp. Sparar du ändringen skickas den nya kategoriseringen vidare till alla aktiva kanaler.",
            },
            {
              type: "ul",
              items: [
                "Kategori: övergripande kategorisering (t.ex. semesterboende, hotell)",
                "Fastighetstyp: konkret objekttyp (t.ex. semesterlägenhet, dubbelrum)",
                "Erbjudandetyp: exakt vad som bokas (t.ex. hela objektet, privat rum)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Underhåll utrustning",
          excerpt: "Välj utrustningsegenskaper och håll dem uppdaterade.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Utrustningen i ett objekt påverkar avgörande hur väl det hittas och filtreras på portaler. Gäster filtrerar specifikt efter egenskaper som wifi, kök eller parkering — saknade uppgifter kan utesluta ett objekt från sökresultat.",
            },
            { type: "h2", text: "Välj utrustning" },
            {
              type: "steps",
              items: [
                "Öppna objektet och byt till fliken Utrustning.",
                "Välj alla tillämpliga egenskaper från den fördefinierade listan.",
                "Fyll vid behov i detaljer som antal parkeringsplatser eller typ av kök.",
                "Spara ändringarna — de skickas automatiskt vidare till alla aktiva portaler.",
              ],
            },
            { type: "h2", text: "Var egenskaperna kommer ifrån" },
            {
              type: "p",
              text: "Utrustningslistan följer de stora portalernas egenskapskatalog, så att dina uppgifter kan tilldelas korrekt där. Egna, fritt uppfunna egenskaper är inte avsedda, eftersom de inte skulle kunna föras över korrekt till portaler.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kontrollera utrustningen efter varje ombyggnad — till exempel en ny luftkonditionering eller ett extra badrum — så att uppgifterna förblir aktuella på alla kanaler.",
            },
            { type: "h2", text: "Vanliga egenskapsgrupper" },
            {
              type: "ul",
              items: [
                "Grundutrustning: wifi, värme, luftkonditionering",
                "Kök och förplägnad: fullt utrustat kök, diskmaskin, kaffemaskin",
                "Badrum och tvätt: eget badrum, tvättmaskin, handdukar",
                "Utomhusområde: balkong, terrass, trädgård, parkering",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Foton och beskrivning",
          excerpt: "Slagkraftiga bilder och texter för fler bokningar.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Foton och beskrivning är för gäster det viktigaste beslutsunderlaget. Ett objekt kan bara publiceras när minst ett titelfoto och en beskrivning har angetts.",
            },
            { type: "h2", text: "Ladda upp foton" },
            {
              type: "steps",
              items: [
                "Öppna objektet och byt till fliken Foton.",
                "Dra bildfiler till uppladdningsområdet eller välj dem via filväljaren.",
                "Ange ett titelfoto — det visas i sökresultat och kort.",
                "Ordna de övriga fotona i en meningsfull ordning genom att dra dem.",
              ],
            },
            { type: "h2", text: "Skriv beskrivning" },
            {
              type: "p",
              text: "Byt till fliken Beskrivning och ange en titel samt en löptext. Beskriv objektets läge, särdrag och målgrupp konkret — allmänna fraser verkar mindre övertygande på portaler än handfasta detaljer.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Foton från andra objekt eller från internet får inte användas — portaler kontrollerar detta och kan spärra objekt vid överträdelser.",
            },
            { type: "h2", text: "Rekommendationer för bra foton" },
            {
              type: "ul",
              items: [
                "Minst fem foton, helst ett för varje rum",
                "Liggande format, bra belysning, inga vattenstämplar",
                "Titelfotot visar objektet så inbjudande och tydligt som möjligt",
                "Uppdatera regelbundet, särskilt efter renoveringar",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Beläggning och kapacitet",
          excerpt: "Ange maximalt antal gäster och sängfördelning korrekt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Beläggningen fastställer hur många gäster ett objekt kan ta emot, och kontrolleras vid varje sökning och bokning. Felaktiga uppgifter leder antingen till avvisade förfrågningar eller till överbeläggning — båda bör undvikas.",
            },
            { type: "h2", text: "Ange beläggning" },
            {
              type: "steps",
              items: [
                "Öppna objektet och byt till fliken Beläggning.",
                "Ange det maximala antalet vuxna.",
                "Ange det maximala antalet barn, om det tillåts.",
                "Ange sängfördelningen per rum, till exempel en dubbelsäng och två enkelsängar.",
              ],
            },
            { type: "h2", text: "Gränser för beläggning" },
            {
              type: "p",
              text: "Vid en bokningsförfrågan kontrollerar myNextDays automatiskt om det efterfrågade antalet gäster ligger inom den angivna beläggningen. Förfrågningar som överskrider den maximala kapaciteten avvisas, respektive visas inte ens som bokningsbara.",
            },
            {
              type: "note",
              variant: "info",
              text: "En extrasäng eller spjälsäng ökar den faktiska kapaciteten bara om du uttryckligen registrerar den i sängfördelningen — annars förblir det maximala antalet gäster oförändrat.",
            },
            { type: "h2", text: "Vanliga felkällor" },
            {
              type: "ul",
              items: [
                "Maximalt antal gäster satt för högt trots att bara få sängar finns",
                "Antal barn glömts bort trots att objektet vänder sig till familjer",
                "Sängfördelningen inte uppdaterad efter en renovering",
              ],
            },
            {
              type: "p",
              text: "Stämmer inte beläggning och utrustning överens, kontrollera dessutom fliken [Utrustning](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Objektstatus och synlighet",
          excerpt: "Skillnaden mellan aktiv/inaktiv och de tre kanalaxlarna.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays skiljer på två olika saker som ofta förväxlas: objektstatusen (aktiv eller inaktiv) och synligheten på enskilda försäljningskanaler. Du styr båda separat från varandra.",
            },
            { type: "h2", text: "Objektstatus" },
            {
              type: "p",
              text: "Statusen active innebär att ett objekt i grunden går att sälja. Statusen inactive tar ett objekt helt ur drift — till exempel vid en långsiktig renovering. Ett inaktivt objekt går inte att boka på någon kanal, oberoende av kanalreglagen.",
            },
            { type: "h2", text: "De tre kanalaxlarna" },
            {
              type: "p",
              text: "Är ett objekt aktivt avgör tre oberoende reglage exakt var det är synligt:",
            },
            {
              type: "ul",
              items: [
                "Webbplats — synlighet på din egen myNextDays-webbplats",
                "Plattformens marknadsplats — synlighet på den globala myBestDays-marknadsplatsen",
                "Portaler — synlighet på Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dessa tre axlar är helt oberoende av objektstatusen och av varandra. Ett aktivt objekt kan t.ex. bara vara synligt på webbplatsen, men inte på portaler.",
            },
            { type: "h2", text: "Ändra status" },
            {
              type: "steps",
              items: [
                "Öppna objektet och byt till fliken Översikt.",
                "Sätt statusen till aktiv eller inaktiv.",
                "Justera vid behov även de tre kanalreglagen i fliken Synlighet.",
                "Spara ändringen — den gäller omedelbart på alla berörda kanaler.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "För en kortsiktig spärrning av enskilda dagar använder du istället Stop-Sell i kalendern — det spärrar specifika dagar på alla kanaler, utan att inaktivera hela objektet.",
            },
          ],
        },
      ],
    },
  ],
};
