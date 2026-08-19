import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalender och tillgänglighet",
  description: "Beläggningsplan, stop-sell och minsta vistelse.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalender",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Läsa beläggningsplanen",
          excerpt: "Så läser du bokningar, tillgänglighet och priser korrekt i beläggningsplanen.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Beläggningsplanen visar dig på en blick vilka nätter som är bokade, tillgängliga eller spärrade. För semesterboenden ser du en rad per objekt, för hotell en kapslad vy med en rad per rumskategori och rateplan.",
            },
            { type: "h2", text: "Vyns uppbyggnad" },
            {
              type: "steps",
              items: [
                "Öppna kalendern via menypunkten ”Beläggningsplan”.",
                "Välj överst den period du vill se.",
                "Filtrera vid behov på enskilda objekt eller rumskategorier.",
                "Klicka på en dag för att öppna detaljer om pris och tillgänglighet.",
                "Klicka på en bokad period för att öppna den tillhörande bokningen.",
              ],
            },
            { type: "h2", text: "Färger och symboler" },
            {
              type: "ul",
              items: [
                "Bokad: perioden är reserverad genom en bokning.",
                "Tillgänglig: dagen kan bokas på alla aktiva kanaler.",
                "Spärrad: dagen går inte att boka på grund av stop-sell eller manuell blockering.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Varje rad i beläggningsplanen motsvarar exakt en bokningsbar enhet — ett rum eller ett semesterboende. Det finns ingen behållarrad för flera rum samtidigt.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mer om att öppna och stänga enskilda dagar målinriktat hittar du under [Ställ in tillgänglighet](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Ställa in tillgänglighet",
          excerpt: "Öppna och stänga enskilda dagar eller perioder målinriktat.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Tillgänglighet avgör om ett objekt kan bokas en viss dag. Du kan öppna eller stänga enskilda dagar eller hela perioder direkt i beläggningsplanen.",
            },
            { type: "h2", text: "Redigera period" },
            {
              type: "steps",
              items: [
                "Öppna beläggningsplanen för önskat objekt.",
                "Markera önskad period genom att klicka och dra.",
                "Välj ”Ändra tillgänglighet” i åtgärdsmenyn.",
                "Bekräfta om perioden ska öppnas eller stängas.",
                "Spara ändringen.",
              ],
            },
            { type: "h2", text: "Påverkan på kanaler" },
            {
              type: "p",
              text: "En tillgänglighetsändring påverkar alla försäljningskanaler där objektet är synligt: portaler som Booking, Airbnb & Co., den egna plattformen samt appen. Överföringen till portalerna sker automatiskt i bakgrunden.",
            },
            {
              type: "ul",
              items: [
                "Öppna: dagen blir bokningsbar på alla aktiva kanaler.",
                "Stäng: dagen försvinner från bokningsbarheten men förblir synlig i kalendern.",
                "Redan befintliga bokningar påverkas inte av en tillgänglighetsändring.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stäng inte en period i avsikt att spärra den helt och permanent för försäljning — för det är stop-sell rätt funktion, se [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell spärrar en dag omedelbart på alla försäljningskanaler samtidigt.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell är det snabbaste sättet att ta en enskild dag helt ur försäljning. Till skillnad från en ren tillgänglighetsändring verkar stop-sell hårt och omedelbart på alla kanaler samtidigt — på portalerna, den egna plattformen och i appen.",
            },
            { type: "h2", text: "Ställa in Stop-Sell" },
            {
              type: "steps",
              items: [
                "Öppna beläggningsplanen för det berörda objektet.",
                "Välj önskad dag eller period.",
                "Klicka på ”Aktivera stop-sell” i åtgärdsmenyn.",
                "Bekräfta spärren.",
              ],
            },
            { type: "h2", text: "När stop-sell är lämpligt" },
            {
              type: "ul",
              items: [
                "Kortfristiga underhållsarbeten eller tekniska problem i objektet.",
                "Ett specialfall där du omedelbart och utan undantag inte vill ha någon ny bokning.",
                "En snabb, plattformsomfattande nödspärr, utan att behöva bearbeta varje kanal för sig.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell känner inte till något kanalspecifikt undantag: är en dag spärrad kan ingen gäst boka via någon kanal, inte heller via receptionen eller en direktförfrågan.",
            },
            {
              type: "note",
              variant: "info",
              text: "För permanent egenanvändning eller planerat underhåll passar istället [Manuell blockering](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minsta och längsta vistelse",
          excerpt: "Hur länge gäster minst eller högst får boka.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "Med minsta och längsta vistelse fastställer du hur många nätter en gäst minst eller högst kan boka för en ankomstdag. Det hjälper till att undvika korta luckbokningar eller att positionera ditt objekt målinriktat för längre vistelser.",
            },
            { type: "h2", text: "Ställa in regel" },
            {
              type: "steps",
              items: [
                "Öppna beläggningsplanen eller fliken ”Priser” i objektet.",
                "Välj den berörda perioden.",
                "Ange minsta antal nätter under ”Minsta vistelse”.",
                "Ange valfritt ett maximalt antal nätter under ”Längsta vistelse”.",
                "Spara regeln.",
              ],
            },
            { type: "h2", text: "Typiska användningsfall" },
            {
              type: "ul",
              items: [
                "Högsäsong: högre minsta vistelse, för att samla bytesdagar.",
                "Lågsäsong: lägre minsta vistelse, för att möjliggöra fler bokningar.",
                "Längsta vistelse: lämpligt när ett objekt måste vara ledigt för underhåll eller annan användning efteråt.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Regeln gäller för ankomstdagen: en gäst kan inte anlända för bara två nätter en dag med minsta vistelse på tre nätter, även om de enskilda dagarna är tillgängliga.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinera längre minsta vistelser med [Vistelserabatter](/hilfe/preise-raten/aufenthaltsrabatte) för att öka incitamentet för gäster.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Manuell blockering",
          excerpt: "Reservera perioder för egenanvändning eller underhåll målinriktat.",
          updated: "Uppdaterad: juli 2026",
          body: [
            {
              type: "p",
              text: "En manuell blockering reserverar en period i kalendern utan att det finns en verklig gästbokning — till exempel för egenanvändning, planerade underhållsarbeten eller renoveringar. Perioden visas i beläggningsplanen som en bokning, men är tydligt igenkännbar som en blockering.",
            },
            { type: "h2", text: "Skapa blockering" },
            {
              type: "steps",
              items: [
                "Öppna beläggningsplanen för det berörda objektet.",
                "Markera önskad period.",
                "Välj ”Blockera manuellt” i åtgärdsmenyn.",
                "Ange en anledning, t.ex. ”Egenanvändning” eller ”Underhåll”.",
                "Spara blockeringen.",
              ],
            },
            { type: "h2", text: "Skillnad mot stop-sell" },
            {
              type: "p",
              text: "En manuell blockering reserverar konkret en period för ett bestämt, dokumenterat syfte och kan frigöras igen senare. För en omedelbar, plattformsomfattande nödspärr utan dokumenterad period är istället stop-sell avsett.",
            },
            {
              type: "ul",
              items: [
                "Manuell blockering: planerad, med anledning, för egenanvändning eller underhåll.",
                "Frigörelse möjlig när som helst, så snart perioden inte längre behövs.",
                "Blockerade nätter räknas inte som gästbokning och visas inte i intäktsöversikten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ta bort en manuell blockering så snart anledningen upphör — annars förblir objektet i onödan spärrat på alla kanaler.",
            },
            {
              type: "note",
              variant: "info",
              text: "För en omedelbar spärr utan planerad period använder du [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
