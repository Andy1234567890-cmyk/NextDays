import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Användarvillkor för gäster",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Dessa användarvillkor reglerar användningen av bokningsportalen myBestDays (nedan „plattformen“) för resenärer och bokare (nedan „gäst“ eller „du“).",
    `Plattformen drivs av ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark, CVR-nr. ${ANBIETER.cvr} (nedan „myBestDays“ eller „vi“). myBestDays är ett varumärke som tillhör detta bolag och inte en egen juridisk person. De fullständiga leverantörsuppgifterna finns i [Juridisk information](https://mybestdays.dk/rechtliches/impressum).`,
    "Genom att använda plattformen godkänner du dessa villkor. Läs dem noggrant.",
  ],
  summary: {
    heading: "Sammanfattning av dessa villkor",
    paragraphs: [
      "myBestDays är en marknadsplats. Vi tillhandahåller plattformen där leverantörer erbjuder sina boenden — själva boendet tillhandahåller vi inte. Boendeavtalet ingås mellan dig och leverantören, inte med oss.",
      "Det du ser i en annons kommer från leverantören: beskrivning, bilder, utrustning, pris, avbokningsvillkor och ordningsregler. Vi granskar annonser, men vi kan inte gå i god för varje uppgift från en leverantör.",
      "Det pris du ser när du slutför bokningen är totalpriset för de bokade tjänsterna. Belopp som betalas först på plats (t.ex. turistskatt eller deposition) anger vi separat i förväg.",
      "Går något fel, kontakta oss först. Avsnitt A15 beskriver hur du lämnar in ett klagomål och vilka vägar som därefter står dig till buds.",
      "Denna sammanfattning förklarar villkoren men ersätter dem inte. Den fullständiga texten är avgörande.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Alla bokningar via myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definitioner",
          paragraphs: [
            "De begrepp som används i dessa villkor förklaras i ordlistan sist i detta dokument. De viktigaste är:",
          ],
          list: [
            "„Plattformen“ — webbplatsen, mobilapplikationerna och alla övriga ingångar genom vilka myBestDays visar boenden och förmedlar bokningar.",
            "„Leverantör“ — den fysiska eller juridiska person som erbjuder boende via plattformen (värd, uthyrare, byrå, hotell- eller boendeverksamhet).",
            "„Boende“ — den logitjänst som leverantören erbjuder, alltså ett fritidsobjekt eller en enhet av en rums- eller objektstyp.",
            "„Bokning“ — den reservation av ett boende för en viss period som ingås via plattformen.",
            "„Totalpris“ — det belopp som visas när bokningen slutförs, inklusive alla skatter, avgifter och tillägg som avräknas via plattformen.",
            "„Kostnader på plats“ — belopp som inte avräknas via plattformen utan förfaller hos leverantören (t.ex. turistskatt, deposition, slutstädning enligt leverantörens val).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Om dessa villkor",
          paragraphs: [
            "Dessa villkor gäller för all användning av plattformen, oavsett om du skapar ett konto och oavsett om en bokning kommer till stånd.",
            "Avsnitt A gäller för alla bokningar. Avsnitt B innehåller de kompletterande reglerna för boenden. Om de strider mot varandra har avsnitt B företräde.",
            "För själva logitjänsten gäller därutöver den aktuella leverantörens villkor (särskilt ordningsregler och avbokningsvillkor) som anges i annonsen. Dessa leverantörsvillkor gäller vid sidan av våra; de kan inte åsidosätta våra villkor såvitt avser ditt förhållande till oss.",
            "Dessa villkor finns på Europeiska unionens alla 24 officiella språk. Vid avvikelser mellan språkversionerna är den tyska versionen avgörande, om inte tvingande rätt i ditt hemvistland föreskriver annat.",
            "Tvingande konsumenträttigheter enligt lagen i ditt hemvistland påverkas inte av dessa villkor.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Om myBestDays",
          paragraphs: [
            "myBestDays är en digital marknadsplats för fritidsboenden och boendeverksamheter. Vi driver plattformen där leverantörer presenterar sina boenden och gäster kan boka dem.",
            "Vi är förmedlare, inte logivärd. Vi äger, driver, förvaltar eller kontrollerar inget av de boenden som erbjuds på plattformen och vi är inte part i boendeavtalet.",
            "myBestDays är en förmedlingstjänst i den mening som avses i förordning (EU) 2022/2065 om digitala tjänster. Våra uppgifter och förfaranden enligt den förordningen finns under [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays är inte researrangör. Vi sätter inte samman paketresor i den mening som avses i direktiv (EU) 2015/2302; om sammanlänkade researrangemang se A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Vår plattform",
          paragraphs: [
            "Innehållet i en annons — beskrivning, bilder, utrustning, beläggningsgränser, priser, tillgänglighet, avbokningsvillkor och ordningsregler — kommer från den aktuella leverantören. Leverantören ansvarar för att uppgifterna är riktiga och fullständiga.",
            "Vi granskar annonser före publicering och löpande med avseende på uppenbara överträdelser av våra [Riktlinjer för lämpligt innehåll](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Någon skyldighet till allmän övervakning av allt innehåll finns inte och vore enligt artikel 8 i förordning (EU) 2022/2065 inte heller tillåten.",
            "Hur vi ordnar sökresultat och vilka faktorer som bestämmer ordningen förklarar vi i [Priser, rangordning och rekommendationer](https://mybestdays.dk/rechtliches/preisangaben).",
            "Vi eftersträvar en genomgående tillgänglig plattform men är inte skyldiga att erbjuda oavbruten tillgänglighet. Underhåll, störningar och anpassningar kan förekomma.",
            "Översättningar av leverantörsinnehåll kan vara maskinellt framställda. Avgörande är den ursprungsversion som leverantören har lagt in.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Våra värderingar",
          paragraphs: [
            "Vi förväntar oss att gäster och leverantörer bemöter varandra med respekt. Diskriminering på grund av ursprung, hudfärg, religion, övertygelse, kön, könsidentitet, sexuell läggning, funktionsnedsättning, ålder eller liknande omständigheter tolereras inte på plattformen — se [Antidiskrimineringspolicy](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "För uppträdandet under vistelsen gäller [Grundregler för gäster](https://mybestdays.dk/rechtliches/grundregeln-gaeste), för leverantörer [Uppförandekod för leverantörer](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Ditt konto och din användning av plattformen",
          paragraphs: [
            "För en bokning kan du skapa ett konto. Du ansvarar för att dina inloggningsuppgifter hålls konfidentiella och underrättar oss omgående om du misstänker obehörig användning.",
            "Du får endast använda plattformen om du är rättskapabel och kan ingå avtal med rättslig verkan.",
            "Dina uppgifter vid registrering och bokning måste vara riktiga och fullständiga — särskilt namn, kontaktuppgifter och antal resenärer. Leverantören behöver dessa uppgifter för att kunna tillhandahålla boendet och uppfylla sina registreringsskyldigheter.",
            "Otillåtet är särskilt:",
          ],
          list: [
            "skenbokningar, bedrägliga betalningar eller användning av andras betalningsmedel utan behörighet;",
            "automatiserad avläsning av plattformen (scraping, sökrobotar) utöver vad vår robots.txt tillåter;",
            "åtgärder som stör eller överbelastar plattformen eller den underliggande infrastrukturen eller kringgår dess säkerhetsåtgärder;",
            "att lägga in rättsstridigt, kränkande eller vilseledande innehåll i omdömen, meddelanden eller profiluppgifter;",
            "att försöka genomföra bokningen utanför plattformen efter det att kontakten uppstått via den — se [Avgifter utanför plattformen](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Priser",
          paragraphs: [
            "Alla priser visas som totalpris inklusive skatter och alla avgifter som avräknas via plattformen, så snart reseuppgifterna (period och antal resenärer) är fastställda. Om en beståndsdel förfaller först på plats anger vi den separat före slutförandet av bokningen.",
            "Priser visas i annonsens valuta. Visas ett belopp därutöver i en annan valuta är det en icke bindande omräkning för orientering; avräkning sker i annonsens valuta, om inte annat anges vid betalningen.",
            "Priser kan ändras fram till att bokningen slutförs, t.ex. för att leverantören justerar dem eller tillgängligheten ändras. Avgörande är det pris som visas för dig omedelbart före den bindande bokningen och som anges i bokningsbekräftelsen.",
            "Uppenbara prisfel (t.ex. ett belopp som är fel med tiopotenser) binder varken oss eller leverantören. Upptäcker vi ett sådant fel informerar vi dig omgående; du kan då avboka kostnadsfritt.",
            "Hur serviceavgifter är sammansatta framgår av [Serviceavgifter](https://mybestdays.dk/rechtliches/servicegebuehren). Om skatter och avgifter se [Skattepolicy](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Betalning",
          paragraphs: [
            "Betalningar via plattformen hanteras av betaltjänstleverantören Stripe. Betalningsuppgifter (t.ex. kortuppgifter) samlas in och behandlas direkt av Stripe; myBestDays lagrar inga fullständiga kortuppgifter.",
            "När vilket belopp förfaller — handpenning, slutbetalning eller betalning på plats — beror på annonsen och visas före slutförandet av bokningen. Närmare regleras i [Betalningsvillkor](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Om annonsen anger en deposition kan denna förhandsgodkännas eller dras och vid skada helt eller delvis behållas; avgörande är uppgifterna i annonsen.",
            "Misslyckas en betalning eller återförs den kan bokningen avbokas. Leverantören kan alltjämt kräva de belopp som uppkommit enligt dennes avbokningsvillkor.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Policyer",
          paragraphs: [
            "Utöver dessa villkor gäller följande policyer, som utgör en del av avtalet mellan dig och oss:",
          ],
          list: [
            "[Riktlinjer för lämpligt innehåll](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Omdömespolicy](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Antidiskrimineringspolicy](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Grundregler för gäster](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Avbokningsvillkor](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Omboknings- och återbetalningspolicy](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Policy vid allvarliga störningar](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Upphovsrättspolicy](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Dataskydd och kakor",
          paragraphs: [
            "Hur vi behandlar personuppgifter framgår av [Integritetspolicy](https://mybestdays.dk/rechtliches/datenschutz). Vilka kakor och liknande tekniker vi använder framgår av [Kakpolicy](https://mybestdays.dk/rechtliches/cookies).",
            "Vid en bokning lämnar vi till leverantören de uppgifter som denne behöver för att utföra logitjänsten. Leverantören är självständigt personuppgiftsansvarig för detta; för denne gäller [Dataskyddsstandarder för värdar](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Tillgänglighet",
          paragraphs: [
            "Vår status för plattformens tillgänglighet och vägen att anmäla hinder beskrivs i [Tillgänglighetsredogörelse](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Uppgifter om ett boendes tillgänglighet kommer från leverantören. Är du beroende av vissa egenskaper, stäm av dem med leverantören via meddelandefunktionen före bokningen.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Omdömen och användargenererat innehåll",
          paragraphs: [
            "Efter vistelsen kan du lämna ett omdöme. Omdömen får endast lämnas av den som bokat via plattformen och påbörjat vistelsen eller kunnat påbörja den — därigenom säkerställer vi att publicerade omdömen kommer från faktiska gäster.",
            "Vi betalar inte för omdömen, ändrar inte deras innehåll och undertrycker inte ett omdöme enbart för att det är negativt. Närmare och de grunder på vilka vi tar bort ett omdöme framgår av [Omdömespolicy](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "För innehåll som du lägger in — omdömen, bilder, meddelanden, profiluppgifter — förblir du ansvarig. Du upplåter till oss en icke-exklusiv, geografiskt och tidsmässigt obegränsad, vederlagsfri rätt att mångfaldiga, bearbeta (t.ex. beskära, översätta) och göra detta innehåll tillgängligt för allmänheten inom ramen för driften och marknadsföringen av plattformen. Du kan radera ditt innehåll; redan gjorda användningar i redan publicerade sammanställningar påverkas inte.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Meddelanden och kommunikation med leverantören",
          paragraphs: [
            "Meddelanden mellan dig och leverantören går via plattformen. Vi tillhandahåller meddelandefunktionen men är varken avsändare eller mottagare av innehållet.",
            "Vi får automatiserat kontrollera meddelanden med avseende på överträdelser av dessa villkor (t.ex. kontaktuppgifter för att kringgå plattformen, bedrägerimönster, rättsstridigt innehåll) och hålla inne eller ta bort berörda meddelanden. Om ett borttagande informerar vi dig med en motivering enligt A17.",
            "Vi skickar dig meddelanden om din bokning (bekräftelse, ändringar, ankomstinformation) till den angivna e-postadressen. Dessa meddelanden är avtalskommunikation och kan inte avbeställas så länge bokningen består. Marknadsföringsmeddelanden får du endast i den mån du har samtyckt eller rätten tillåter det utan samtycke; du kan när som helst invända.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Immateriella rättigheter",
          paragraphs: [
            "Plattformen, dess utformning, programvara, databaser, texter och varumärken är skyddade. Du får en icke-exklusiv, icke överlåtbar rätt att använda plattformen för att söka efter och boka boenden — inte mer.",
            "Användningen av våra varumärken och logotyper regleras av [Riktlinjer för varumärken](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Anser du att innehåll på plattformen kränker din upphovsrätt, följ [Upphovsrättspolicy](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Vad du gör om något går fel",
          paragraphs: [
            "Rör problemet själva boendet, vänd dig först till leverantören — via meddelandefunktionen eller på plats. Många problem löses snabbast så.",
            "Kommer du inte vidare med leverantören, eller rör problemet plattformen, betalningen eller bokningshanteringen, vänd dig till oss. Hur du når oss och hur vi behandlar klagomål framgår av [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).",
            "Ha då till hands: ditt bokningsnummer, bokningens e-postadress, en kort beskrivning av problemet med ditt önskemål om hur vi ska hjälpa, och tillhörande underlag (bilder, meddelanden, kvitton).",
            "Är boendet inte tillgängligt vid ankomsten eller avviker det väsentligt från annonsen gäller [Omboknings- och återbetalningspolicy](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Europeiska kommissionens plattform för tvistlösning online (ODR-plattformen) har upphävts genom förordning (EU) 2024/3228 och har upphört med verksamheten; den står inte längre till buds som väg. Vilka organ som träder i dess ställe framgår av [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).",
            "Har vi vidtagit en åtgärd mot ditt innehåll eller ditt konto kan du utöver vårt interna klagomålsförfarande vända dig till ett organ för tvistlösning utanför domstol som certifierats enligt artikel 21 i förordning (EU) 2022/2065. Dess beslut är inte bindande för oss.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Åtgärder mot olämpligt uppträdande",
          paragraphs: [
            "Bryter du mot dessa villkor eller någon av de policyer som anges i A9 kan vi — avvägt efter överträdelsens allvar, frekvens och verkan — ta bort innehåll eller begränsa dess synlighet, spärra funktioner, avboka bokningar eller spärra ditt konto tillfälligt eller permanent.",
            "Före en åtgärd prövar vi det enskilda fallet. Vid uppenbart rättsstridigt innehåll, vid fara för personer eller vid bedrägeri kan vi agera omedelbart.",
            "Varje åtgärd motiverar vi för dig och hänvisar till klagomålsvägen — se A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Anmälan av rättsstridigt innehåll och motivering av åtgärder",
          paragraphs: [
            "Var och en kan anmäla innehåll till oss som denne anser vara rättsstridigt. Anmälningsförfarandet enligt artikel 16 i förordning (EU) 2022/2065, våra kontaktpunkter och hanteringen av anmälningar beskrivs under [Förordningen om digitala tjänster](https://mybestdays.dk/rechtliches/dsa).",
            "Vidtar vi en åtgärd mot innehåll som du lagt in eller mot ditt konto får du en motivering med angivande av grunden, den faktiska grundvalen, rättsgrunden eller den avtalsbestämmelse som överträtts samt klagomålsmöjligheterna.",
            "Mot varje åtgärd kan du inom sex månader klaga kostnadsfritt. Klagomål behandlas av människor, inte enbart automatiserat.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Ansvarsbegränsning",
          paragraphs: [
            "Vi ansvarar obegränsat för uppsåt och grov vårdslöshet, för skador till följd av kränkning av liv, kropp eller hälsa samt inom ramen för en av oss lämnad garanti. Anspråk enligt produktansvarsrätten påverkas inte.",
            "I övrigt är vårt ansvar begränsat till den förutsebara skada som typiskt uppstår vid åsidosättande av de förpliktelser vars uppfyllande du får förlita dig på — och endast i den mån tillämplig rätt tillåter en sådan begränsning.",
            "Vi ansvarar inte för utförandet av själva logitjänsten och inte för leverantörers eller andra gästers uppträdande. Avtalspart för logitjänsten är leverantören.",
            "Vi ansvarar inte för riktigheten i de uppgifter som leverantörer lägger in, i den mån vi inte kände till dem och inte heller borde ha känt till dem. Får vi kännedom om en rättsstridig uppgift agerar vi omgående.",
            "Ett längre gående ansvar är uteslutet. Tvingande lagstadgade anspråk, särskilt konsumenträttigheter, påverkas inte.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Tillämplig lag och behörig domstol",
          paragraphs: [
            "Dansk rätt tillämpas — operatören är etablerad i Danmark — med undantag för FN:s köplag. Tvingande konsumentskyddsbestämmelser i den stat där du har din vanliga vistelseort påverkas inte enligt artikel 6 i förordning (EG) nr 593/2008 (Rom I).",
            "Som konsument kan du väcka talan mot oss vid domstolen på din hemvistort eller på vårt säte i Danmark; vi kan endast väcka talan mot dig vid domstolen på din hemvistort (artiklarna 17–19 i förordning (EU) nr 1215/2012).",
            "För boendeavtalet gäller som regel rätten i den stat där boendet är beläget; för talan om hyra av fast egendom är den statens domstolar exklusivt behöriga.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Sammanlänkade researrangemang",
          paragraphs: [
            "myBestDays förmedlar uteslutande logitjänster. Vi erbjuder varken flyg, hyrbil, transporttjänster, utflykter eller attraktioner och sätter inte samman paketresor i den mening som avses i direktiv (EU) 2015/2302.",
            "Skulle vi framöver förmedla ytterligare resetjänster informerar vi dig före bokningen med det lagstadgade standardformuläret om huruvida en paketresa eller ett sammanlänkat researrangemang uppstår och vilka rättigheter du har av detta.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Löptid, spärr och uppsägning",
          paragraphs: [
            "Avtalet om användning av plattformen löper tills vidare. Du kan när som helst radera ditt konto utan att ange skäl; befintliga bokningar påverkas inte och hanteras enligt den aktuella leverantörens villkor.",
            "Vi kan säga upp användaravtalet med 14 dagars varsel. Vid en allvarlig överträdelse av dessa villkor kan vi säga upp med omedelbar verkan och spärra kontot.",
            "Efter upphörandet raderar vi dina uppgifter, i den mån ingen lagstadgad lagringsskyldighet eller berättigat intresse av lagring hindrar detta; närmare regleras i [Integritetspolicy](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Ändringsklausul",
          paragraphs: [
            "Vi kan ändra dessa villkor när det finns sakliga skäl för det — t.ex. ändrat rättsläge, praxis från högsta instans, nya eller borttagna funktioner på plattformen eller för att fylla luckor i regleringen.",
            "Ändringar aviserar vi minst 30 dagar före ikraftträdandet i textform. Invänder du inte före ikraftträdandet anses de ändrade villkoren godkända; på denna verkan uppmärksammar vi särskilt i aviseringen. Invänder du kan vi säga upp användaravtalet per dagen för ikraftträdandet.",
            "För redan ingångna bokningar gäller villkoren i den lydelse som gällde vid bokningstillfället.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Boenden",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Detta avsnitts omfattning",
          paragraphs: [
            "Detta avsnitt gäller för bokning av boenden via plattformen — fritidsobjekt liksom rum och enheter hos boendeverksamheter.",
            "Det kompletterar avsnitt A. Vid motstridighet har detta avsnitt B företräde.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Avtalsförhållande",
          paragraphs: [
            "Boendeavtalet ingås uteslutande mellan dig och leverantören. myBestDays är inte avtalspart.",
            "Visningen av ett boende på plattformen är en uppmaning till dig att lämna ett bokningsanbud. Genom att klicka på den betalningspliktiga bokningsknappen lämnar du ett bindande anbud.",
            "Avtalet kommer till stånd när bokningen bekräftas. Bokningsbekräftelsen skickar vi till den e-postadress du angett; den anger leverantören, den bokade tjänsten, perioden, totalpriset och avbokningsvillkoren.",
            "Vid boenden med förfrågningsbokning kommer avtalet till stånd först genom leverantörens godkännande. Fram till dess kan ditt betalningsmedel förhandsgodkännas men inte belastas.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Vad vi gör",
          paragraphs: [
            "Vi tillhandahåller plattformen, visar leverantörernas annonser, tar emot din bokning, vidarebefordrar den till leverantören och skickar dig bokningsbekräftelsen.",
            "Vi hanterar betalningen i den mån annonsen anger betalning via plattformen, och tillhandahåller meddelandefunktionen mellan dig och leverantören.",
            "Vi tillhandahåller inte boendet, driver det inte och lämnar ingen garanti för dess beskaffenhet. Vi är inte din researrangör.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Vad du måste göra",
          paragraphs: [
            "Gå före bokningen igenom annonsen fullständigt: utrustning, beläggningsgräns, ankomst- och avresetider, ordningsregler, avbokningsvillkor och de kostnader som förfaller först på plats.",
            "Håll den i annonsen angivna maximala beläggningen. Anländer fler personer än bokat kan leverantören neka inträde eller kräva ett tillägg.",
            "Iaktta leverantörens ordningsregler och [Grundregler för gäster](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Du behandlar boendet varsamt och ansvarar för skador som du eller dina medresenärer orsakar.",
            "Behöver leverantören eller en myndighet uppgifter för registrering (t.ex. registreringsblankett, id-uppgifter, turistskatteförklaring) tillhandahåller du dessa i god tid.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Priser och betalning",
          paragraphs: [
            "Totalpriset omfattar övernattningspriset för den bokade perioden och de i annonsen angivna tillägg och avgifter som avräknas via plattformen.",
            "På plats kan ytterligare belopp förfalla — särskilt turistskatt eller lokala avgifter, en deposition samt tilläggstjänster som du bokar först på plats. Dessa anger vi före slutförandet av bokningen som kostnader på plats, i den mån leverantören angett dem.",
            "Anger annonsen en handpenning förfaller restbeloppet vid den tidpunkt som anges i annonsen. Uteblir slutbetalningen kan leverantören enligt sina avbokningsvillkor frånträda avtalet.",
            "Betalningar till leverantören utanför plattformen tar vi inte emot och kan inte spåra; de omfattas inte av vår betalningshantering — se [Avgifter utanför plattformen](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Ändringar, avbokningar och återbetalningar",
          paragraphs: [
            "Om och på vilka villkor en bokning kan avbokas eller ändras kostnadsfritt beror på leverantörens avbokningsvillkor som anges i annonsen. De villkor vi ställer till leverantörers förfogande beskrivs under [Avbokningsvillkor](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Vid logitjänster som bokas för en viss period finns som regel ingen lagstadgad ångerrätt enligt artikel 16 l i direktiv 2011/83/EU respektive motsvarande nationella bestämmelser. Tvingande lagstadgade rättigheter påverkas inte.",
            "Avbokar leverantören återbetalar vi det via plattformen betalda beloppet i sin helhet. Därutöver gäller [Omboknings- och återbetalningspolicy](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Hindrar en händelse utanför båda parters kontroll resan eller vistelsen gäller [Policy vid allvarliga störningar](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Återbetalningar sker till det betalningsmedel som använts, om inte annat avtalats.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Vad du därutöver behöver veta",
          paragraphs: [
            "Leverantörer kan vara privata värdar eller näringsidkare. Om en leverantör uppträder som näringsidkare anger vi i annonsen. Rör det sig inte om en näringsidkare gäller unionens konsumentskyddsbestämmelser inte för boendeavtalet — på detta uppmärksammar vi dig i annonsen.",
            "Uppgifter om läge, omgivning, avstånd och tredje parts betyg är till för orientering. Bindande är uppgifterna om själva den bokade tjänsten.",
            "I områden med registreringsplikt för korttidsuthyrning anger vi det av leverantören uppgivna registreringsnumret i annonsen; se [Korttidsuthyrning](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Vid flera identiska enheter av en objekts- eller rumstyp bokar du en enhet av denna typ. Vilken konkret enhet du får bestämmer leverantören.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Ordlista",
      paragraphs: [
        "Följande begrepp har i dessa villkor den här angivna betydelsen.",
      ],
      definitions: [
        {
          term: "Leverantör",
          description:
            "Den fysiska eller juridiska person som erbjuder boende via plattformen och blir avtalspart i boendeavtalet.",
        },
        {
          term: "Förfrågningsbokning",
          description:
            "En bokning som kommer till stånd först efter leverantörens uttryckliga godkännande, till skillnad från en direktbokning.",
        },
        {
          term: "Bokningsbekräftelse",
          description:
            "Det meddelande genom vilket vi bekräftar att boendeavtalet har ingåtts; det innehåller leverantör, tjänst, period, totalpris och avbokningsvillkor.",
        },
        {
          term: "Enhet",
          description:
            "Det konkreta bokningsbara objektet under en objekts- eller rumstyp. Enheten säljs, typen beskrivs och prissätts.",
        },
        {
          term: "Totalpris",
          description:
            "Det belopp som visas när bokningen slutförs, inklusive alla skatter och alla avgifter som avräknas via plattformen.",
        },
        {
          term: "Maximal beläggning",
          description:
            "Det i annonsen angivna högsta tillåtna antalet personer som får övernatta i boendet.",
        },
        {
          term: "Deposition",
          description:
            "Ett belopp som leverantören kräver som säkerhet för skador och som förhandsgodkänns eller dras och efter vistelsen frisläpps eller avräknas.",
        },
        {
          term: "Turistskatt",
          description:
            "En lokal avgift för övernattningar som beroende på kommun tas ut på plats eller via leverantören; den är ingen tjänst från myBestDays.",
        },
        {
          term: "Plattformen",
          description:
            "Webbplatsen, mobilapplikationerna och alla övriga ingångar genom vilka myBestDays visar boenden och förmedlar bokningar.",
        },
        {
          term: "Serviceavgift",
          description:
            "Ersättningen för myBestDays förmedlingstjänst. Vem som bär den och hur den anges framgår av Serviceavgifter.",
        },
        {
          term: "Avbokningsvillkor",
          description:
            "De av leverantören valda reglerna för till när och till vilken kostnad en bokning kan avbokas eller ändras.",
        },
        {
          term: "Boende",
          description:
            "Den logitjänst som leverantören erbjuder — ett fritidsobjekt eller en enhet av en rums- eller objektstyp.",
        },
        {
          term: "Kostnader på plats",
          description:
            "Belopp som inte avräknas via plattformen utan förfaller hos leverantören, t.ex. turistskatt, deposition eller tilläggstjänster bokade på plats.",
        },
      ],
    },
  ],
};
