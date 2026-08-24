import type { LegalDoc } from "../types";

// Schwedische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 enthält die von Stripe für Custom-Plattformen
// vorgeschriebene Klausel (Stripe Connected Account Agreement) — Wortlaut an
// Stripes offiziellen Empfehlungstext angelehnt, URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Allmänna villkor för byråer och uthyrare",
  stand: "Senast uppdaterad: 13 augusti 2026",
  intro: [
    "Dessa allmänna villkor (nedan ”villkoren”) reglerar byråers, uthyrares, fastighetsförvaltares och andra kommersiella användares (nedan ”användaren”) användning av programvaruplattformen myNextDays (nedan ”plattformen”).",
    "Plattformen tillhandahålls av myNextDays ApS, ett privat aktiebolag (anpartsselskab) enligt dansk rätt, Hirtshalsvej 21, 9881 Bindslev, Danmark, registrerat i det danska centrala företagsregistret (CVR) under CVR-nr 46615182 (nedan ”myNextDays” eller ”vi”).",
    "Plattformen riktar sig uteslutande till näringsidkare i den mening som avses i § 14 i den tyska civillagen (BGB) respektive motsvarande bestämmelser i det aktuella EU-medlemslandet. Den riktar sig inte till konsumenter.",
  ],
  sections: [
    {
      heading: "§ 1 Tillämpningsområde",
      paragraphs: [
        "Dessa villkor gäller för samtliga avtal om användning av plattformen mellan myNextDays och användaren samt för alla tjänster och moduler som tillhandahålls via plattformen.",
        "Avvikande, motstridiga eller kompletterande villkor från användaren blir endast en del av avtalet om myNextDays uttryckligen har godkänt dem i textform.",
      ],
    },
    {
      heading: "§ 2 Avtalsföremål och tjänster",
      paragraphs: [
        "myNextDays tillhandahåller användaren en molnbaserad programvara för förvaltning av semesterboenden och logiverksamheter. Funktionsomfattningen framgår av den vid var tid gällande tjänstebeskrivningen och omfattar särskilt:",
      ],
      list: [
        "förvaltning av boenden, beläggningskalendrar och reservationer (property management-system),",
        "anslutning till tredje parts bokningskanaler (t.ex. Booking.com, Airbnb) via en channel manager,",
        "publicering av erbjudanden via plattformens egen bokningskanal myNextDays,",
        "skapande av egna webbplatser via den integrerade page buildern,",
        "bokförings-, avräknings- och rapportfunktioner, inklusive ägaravräkningar,",
        "kommunikation med gäster samt mottagande av betalningar via den integrerade betalningshanteringen (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registrering, konto och användarens uppgifter",
      paragraphs: [
        "Användning av plattformen förutsätter registrering av ett konto. Användaren är skyldig att vid registreringen och under hela avtalstiden lämna riktiga, aktuella och fullständiga uppgifter om sig själv och sitt företag samt att utan dröjsmål uppdatera dem vid ändringar.",
        "Inloggningsuppgifter ska hållas hemliga och skyddas mot åtkomst från tredje part. Användaren ska utan dröjsmål informera myNextDays om det finns tecken på att kontot missbrukas.",
        "Ett konto kan inte överlåtas. Användaren säkerställer att alla personer som använder kontot för användarens räkning följer dessa villkor.",
      ],
    },
    {
      heading: "§ 4 myNextDays roll vid bokningar",
      paragraphs: [
        "Inkvarteringsavtal om de boenden som erbjuds på plattformen, via anslutna tredjepartskanaler eller via användarens egen webbplats ingås uteslutande mellan användaren (respektive den ägare som användaren företräder) och den aktuella gästen. myNextDays blir inte part i inkvarteringsavtalet.",
        "Användaren är ensam ansvarig för att erbjudandenas innehåll (beskrivningar, foton, priser, tillgänglighet, skatter och avgifter) är riktigt och lagenligt.",
      ],
    },
    {
      heading: "§ 5 Betalningshantering genom Stripe",
      paragraphs: [
        "Betalningshanteringstjänsterna för byråer och uthyrare på myNextDays tillhandahålls av Stripe och omfattas av [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), som innefattar Stripes användarvillkor (tillsammans ”Stripe-avtalet”). Genom att godkänna dessa villkor eller fortsätta att vara verksam som byrå eller uthyrare på myNextDays förklarar sig användaren bunden av Stripe-avtalet, som från tid till annan kan ändras av Stripe.",
        "En förutsättning för att myNextDays ska kunna möjliggöra betalningshanteringstjänster via Stripe är att användaren förser myNextDays med riktiga och fullständiga uppgifter om sig själv och sitt företag. Användaren bemyndigar myNextDays att till Stripe vidarebefordra dessa uppgifter samt transaktionsdata som hänger samman med användningen av de betalningshanteringstjänster som Stripe tillhandahåller.",
        "För rättsförhållandet till Stripe gäller den länkade engelskspråkiga avtalstexten i dess vid var tid gällande lydelse. Avtalspart för användare inom Europeiska ekonomiska samarbetsområdet är det Stripe-bolag som anges i Stripe-avtalet (för närvarande Stripe Payments Europe, Limited, Irland). Stripe behandlar personuppgifter i enlighet med [Stripes integritetspolicy](https://stripe.com/privacy).",
        "För att uppfylla lagstadgade identifierings- och kontrollskyldigheter (bl.a. bekämpning av penningtvätt, ”känn din kund”) kan myNextDays och Stripe när som helst begära ytterligare uppgifter och underlag, i synnerhet identitetshandlingar, uppgifter om verkliga huvudmän och bankuppgifter. Om begärda uppgifter eller underlag inte lämnas inom den angivna fristen kan mottagandet av betalningar eller utbetalningar helt eller delvis avbrytas till dess att uppgifterna är fullständiga.",
      ],
    },
    {
      heading: "§ 6 Utbetalningar, återdebiteringar och negativa saldon",
      paragraphs: [
        "Betalningsvägen beror på bokningskanalen. Vid bokningar via användarens egen bokningslösning och vid bokningar via anslutna distributionsportaler tas gästernas betalningar emot direkt på användarens betalkonto; i dessa fall är användaren gentemot gästen betalningsmottagare och avtalspart för inkvarteringstjänsten (§ 4), och myNextDays blir aldrig innehavare av dessa medel. myNextDays tar inte ut någon procentuell bokningsavgift på sådana bokningar; provisionen för bokningar via anslutna distributionsportaler anges separat och faktureras i efterhand.",
        "Vid bokningar som sker via myNextDays bokningsportal hanteras betalningen genom myNextDays. myNextDays behåller härvid den förmedlingsprovision som anges i den vid var tid gällande prislistan, inklusive kostnaden för betalningshantering, och vidarebefordrar återstående belopp till användaren enligt nedanstående stycken. Ersättningen för användning av programvaran (§ 7) påverkas inte.",
        "Utbetalningar görs till det bankkonto som användaren har angett. myNextDays kan av riskskäl anpassa utbetalningsfrekvensen, i synnerhet vid nya konton, avvikande transaktionsmönster eller pågående granskningar.",
        "Återbetalningar till gäster bärs ekonomiskt av användaren. Återdebiteringar och därav följande avgifter bärs av användaren vid bokningar via användarens egen bokningslösning och via anslutna distributionsportaler, eftersom användaren i dessa fall är betalningsmottagare; vid bokningar via myNextDays bokningsportal bär myNextDays återdebiteringsrisken, om inte återdebiteringen beror på ett avtalsbrott från användarens sida (särskilt utebliven eller väsentligt avvikande inkvarteringstjänst). myNextDays har rätt att kvitta belopp som ska bäras av användaren mot framtida utbetalningar.",
        "Om ett negativt saldo uppstår på användarens betalkonto ska användaren utan dröjsmål utjämna det. Användaren bemyndigar myNextDays och Stripe att debitera negativa saldon från det angivna bankkontot, i den mån detta är rättsligt tillåtet.",
      ],
    },
    {
      heading: "§ 7 Avgifter och fakturering",
      paragraphs: [
        "Avgifterna för användningen av plattformen framgår av den prislista som avtalades vid avtalets ingående respektive av det individuella erbjudandet. Alla priser anges exklusive vid var tid tillämpliga lagstadgade skatter och i den valuta som anges i avtalet.",
        "Transaktionsbaserade avgifter (t.ex. betalnings- eller kanalavgifter) kan hållas inne eller kvittas direkt när den aktuella transaktionen genomförs.",
        "Om användaren är i dröjsmål med betalningar kan myNextDays efter föregående avisering spärra åtkomsten till plattformen till dess att de utestående fordringarna har reglerats.",
      ],
    },
    {
      heading: "§ 8 Användarens skyldigheter; egna juridiska texter",
      paragraphs: [
        "Användaren säkerställer att dennes erbjudanden, innehåll och affärsmetoder följer tillämplig lagstiftning, i synnerhet reglerna om inkvartering, registrering, skatt och konsumentskydd på den ort där boendet är beläget. Användaren ansvarar själv för att inneha nödvändiga tillstånd, registreringar och licenser.",
        "För webbplatser som användaren driver via page buildern samt för sina erbjudanden på plattformen ansvarar användaren själv; detta omfattar i synnerhet egna gästvillkor, egen juridisk information (impressum) och egen dataskyddsinformation.",
        "Förbjudet är i synnerhet: att publicera oriktiga eller vilseledande erbjudanden, att genomföra skentransaktioner eller bedrägliga transaktioner, att kringgå betalningshanteringen enligt § 5 för bokningar som kommit till stånd via plattformen samt varje användning som försämrar plattformens säkerhet eller tillgänglighet.",
      ],
    },
    {
      heading: "§ 9 Tredje parts bokningskanaler",
      paragraphs: [
        "Vid anslutning av tredjepartskanaler (t.ex. Booking.com, Airbnb) gäller dessutom villkoren för respektive kanaloperatör. Användaren ingår själv de avtal med kanaloperatören som krävs för detta.",
        "myNextDays utför den tekniska synkroniseringen av tillgänglighet, priser och bokningsdata, men har inget inflytande över kanaloperatörernas innehåll, provisioner eller beslut och ansvarar inte för deras tillgänglighet.",
      ],
    },
    {
      heading: "§ 10 Tillgänglighet och vidareutveckling",
      paragraphs: [
        "myNextDays utför tjänsterna med den omsorg som krävs av en ansvarsfull näringsidkare och eftersträvar hög tillgänglighet för plattformen. Underhållsfönster, vidareutveckling och omständigheter utanför myNextDays kontroll (t.ex. störningar hos tredjepartsleverantörer) kan tillfälligt begränsa tillgängligheten.",
        "myNextDays får vidareutveckla plattformen och ändra funktioner, förutsatt att avtalets syfte inte äventyras därigenom och ändringen är rimlig för användaren.",
      ],
    },
    {
      heading: "§ 11 Data och dataskydd",
      paragraphs: [
        "I den mån myNextDays vid tillhandahållandet av plattformen behandlar personuppgifter för användarens räkning (i synnerhet gästuppgifter) ingår parterna ett personuppgiftsbiträdesavtal enligt artikel 28 i dataskyddsförordningen (GDPR).",
        "Användaren förblir ansvarig för att insamlingen och behandlingen av de uppgifter som användaren tillför är tillåten enligt dataskyddslagstiftningen. Närmare uppgifter om myNextDays databehandling framgår av plattformens dataskyddsinformation; för Stripes databehandling gäller § 5.",
      ],
    },
    {
      heading: "§ 12 Användning av artificiell intelligens",
      paragraphs: [
        "myNextDays använder i enskilda funktioner AI-system, i synnerhet för prisrekommendationer (dynamic pricing), för svarsförslag i meddelandeinkorgen och för stöd i supporten. Dessa funktioner tar fram förslag; beslutet om och ansvaret för hur de används ligger hos användaren. Prisrekommendationer ersätter inte användarens egen affärsmässiga bedömning.",
        "Om gäster interagerar direkt med ett AI-system informeras de om detta (artikel 50.1 i förordning (EU) 2024/1689 — ”AI-förordningen”). Texter som ett AI-system har tagit fram eller väsentligt ändrat och som användaren vidarebefordrar till gäster ska användaren märka ut, i den mån användaren har en lagstadgad skyldighet till detta.",
        "myNextDays driver inga AI-system som enligt bilaga III till AI-förordningen anses vara högrisksystem och inga sådana förfaranden som är förbjudna enligt artikel 5 i AI-förordningen. Användarens inmatningar och uppgifter om användarens gäster används inte för träning av modeller utan en särskild instruktion.",
        "Användaren får inte använda AI-funktionerna för att ge gäster intryck av en mänsklig kommunikation där det finns en informationsskyldighet, eller för att lämna rättsligt bindande förklaringar utan egen kontroll.",
        "Om användaren via det gränssnitt som är avsett för detta ansluter sitt konto till en egen AI-assistent (t.ex. Claude från Anthropic) gäller följande: Användaren ingår själv avtalet om denna tjänst och ansvarar för användningen av den. Anslutningen utgör användarens instruktion till myNextDays att lämna ut de frigivna uppgifterna dit — inbegripet en överföring till ett tredjeland om leverantören har sitt säte utanför Europeiska unionen. Användaren säkerställer att det finns en rättslig grund för detta, att användarens egen dataskyddsinformation anger mottagaren och att de nödvändiga garantierna för överföringen finns.",
        "För en sådan anslutning använder användaren en åtkomst där leverantören erbjuder behandling av personuppgifter för kundens räkning och utesluter att uppgifterna används för träning av modeller — hos Claude är det företagsåtkomsterna (Team, Enterprise eller API). Åtkomster för privat bruk uppfyller regelmässigt inte detta; de är därför olämpliga för gästuppgifter. myNextDays kan inte se vilken åtkomst användaren använder och upplyser om detta i samtyckesdialogen.",
        "Användaren beaktar därvid att innehåll som denne från användargränssnittet manuellt kopierar in i ett inmatningsfält hos assistenten regelmässigt inte omfattas av leverantörens avtalsmässiga begränsningar — i motsats till de uppgifter som hämtas via gränssnittet.",
        "Uppgifter som kommer från en bokningsportal använder användaren även via gränssnittet endast för att hantera och betjäna den aktuella bokningen — inte för att bedöma personer, för profilering eller för marknadsföring. Portalerna föreskriver denna ändamålsbegränsning i sina egna villkor.",
      ],
    },
    {
      heading: "§ 13 Klagomål och medling",
      paragraphs: [
        "myNextDays har för kommersiella användare en kostnadsfri intern klagomålshantering (artikel 11 i förordning (EU) 2019/1150 — ”P2B-förordningen”). Klagomål — i synnerhet om påstådda överträdelser av dessa villkor, om tekniska problem med betydande verkan eller om åtgärder som myNextDays vidtagit mot användaren — kan lämnas in formlöst till info@mynextdays.dk eller via supporten i applikationen. Mottagandet bekräftas; handläggningen sker skyndsamt och inom rimlig tid, i enkla fall som regel inom 14 dagar. Resultatet meddelas användaren på ett klart språk.",
        "Om ingen överenskommelse nås under klagomålsförfarandet är myNextDays berett att tillsammans med användaren vända sig till följande medlare utanför domstol (artikel 12 i P2B-förordningen): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Genève 20, Schweiz — förfaranden även på distans och på flera språk; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 København K, Danmark — den stat där operatören har sitt säte.",
        "Angivandet förpliktar inte användaren att genomföra ett medlingsförfarande; rätten att väcka talan vid domstol påverkas inte. myNextDays deltar i de rimliga kostnaderna för en medling; fördelningen följer respektive medlares regler och omständigheterna i det enskilda fallet.",
        "myNextDays offentliggör årligen uppgifter om antalet klagomål, handläggningstiden och de åtgärder som vidtagits.",
      ],
    },
    {
      heading: "§ 14 Immateriella rättigheter",
      paragraphs: [
        "Samtliga rättigheter till plattformen, dess programvara och dess innehåll (med undantag för innehåll som användaren har lagt in) tillkommer myNextDays respektive dess licensgivare. Användaren erhåller för avtalstiden en enkel, icke överlåtbar rätt att använda plattformen i den omfattning som avtalats.",
        "Till det innehåll som användaren lägger in upplåter användaren åt myNextDays de enkla nyttjanderätter som krävs för driften av plattformen (i synnerhet för lagring, mångfaldigande, visning och överföring till anslutna kanaler).",
      ],
    },
    {
      heading: "§ 15 Ansvar",
      paragraphs: [
        "myNextDays ansvarar obegränsat vid uppsåt och grov vårdslöshet samt för skador till följd av skada på liv, kropp eller hälsa.",
        "Vid ringa vårdslöshet ansvarar myNextDays endast för åsidosättande av väsentliga avtalsförpliktelser (kardinalförpliktelser), begränsat till den för avtalet typiska, förutsebara skadan. Ansvar enligt produktansvarslagstiftningen samt enligt lämnade garantier påverkas inte.",
        "För förlust av data ansvarar myNextDays endast i den omfattning skadan skulle ha inträffat även om användaren hade utfört korrekta och regelbundna säkerhetskopieringar, såvida inte säkerhetskopieringen enligt avtalet åligger myNextDays.",
      ],
    },
    {
      heading: "§ 16 Avtalstid, uppsägning och avstängning",
      paragraphs: [
        "Avtalstid och uppsägningstider framgår av det aktuella avtalet. Rätten att säga upp avtalet i förtid av viktig grund påverkas inte.",
        "myNextDays kan tillfälligt spärra åtkomsten till plattformen eller enskilda funktioner (inklusive mottagande av betalningar och utbetalningar) om det finns konkreta tecken på överträdelse av dessa villkor, på bedrägeri eller på missbruk, eller om myNextDays är skyldigt att göra det enligt lag eller till följd av ett åläggande från en betaltjänstleverantör. Användaren informeras om spärrningen i den mån detta är rättsligt tillåtet.",
        "Efter avtalets upphörande tillhandahåller myNextDays på begäran användarens data för export i ett gängse format inom 30 dagar; därefter raderas uppgifterna, såvida inte lagstadgade lagringsskyldigheter hindrar detta.",
      ],
    },
    {
      heading: "§ 17 Ändringar av dessa villkor",
      paragraphs: [
        "myNextDays kan ändra dessa villkor med verkan för framtiden, i den mån detta är nödvändigt av godtagbara skäl (i synnerhet lagändringar, ändringar i rättspraxis eller krav från betaltjänstleverantörer) och användaren inte missgynnas oskäligt av detta.",
        "Ändringar aviseras användaren i textform minst sex veckor innan de träder i kraft. Om användaren inte invänder inom aviseringsfristen eller fortsätter att använda plattformen efter ikraftträdandet anses de ändrade villkoren godkända; denna följd framhålls särskilt i aviseringen.",
      ],
    },
    {
      heading: "§ 18 Slutbestämmelser",
      paragraphs: [
        "Lagen i den stat där operatören har sitt säte tillämpas, med uteslutande av FN:s konvention om avtal om internationella köp av varor (CISG). Tvingande bestämmelser i den stat där användaren har sitt säte påverkas inte.",
        "Exklusivt forum för alla tvister som uppstår ur eller i samband med detta avtal är — i den mån det är rättsligt tillåtet — den ort där operatören har sitt säte.",
        "Om enskilda bestämmelser i dessa villkor är eller blir ogiltiga påverkas inte giltigheten av övriga bestämmelser.",
      ],
    },
  ],
};
