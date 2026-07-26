import type { LegalDoc } from "../types";

// Dänische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 enthält die von Stripe für Custom-Plattformen
// vorgeschriebene Klausel (Stripe Connected Account Agreement) — Wortlaut an
// Stripes offiziellen Empfehlungstext angelehnt, URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Almindelige forretningsbetingelser for bureauer og udlejere",
  stand: "Senest opdateret: 26. juli 2026",
  intro: [
    "Disse almindelige forretningsbetingelser (herefter »betingelserne«) regulerer bureauers, udlejeres, ejendomsadministratorers og andre erhvervsmæssige brugeres (herefter »brugeren«) brug af softwareplatformen myNextDays (herefter »platformen«).",
    "Udbyderen af platformen er [fuldt firmanavn, selskabsform, adresse og registreringsoplysninger for operatøren — udfyldes inden offentliggørelse] (herefter »myNextDays« eller »vi«).",
    "Platformen henvender sig udelukkende til erhvervsdrivende som omhandlet i § 14 i den tyske borgerlige lovbog (BGB) eller de tilsvarende bestemmelser i det pågældende EU-medlemsland. Den henvender sig ikke til forbrugere.",
  ],
  sections: [
    {
      heading: "§ 1 Anvendelsesområde",
      paragraphs: [
        "Disse betingelser gælder for alle aftaler om brug af platformen mellem myNextDays og brugeren samt for alle ydelser og moduler, der stilles til rådighed via platformen.",
        "Afvigende, modstridende eller supplerende forretningsbetingelser fra brugeren bliver kun en del af aftalen, hvis myNextDays udtrykkeligt har accepteret dem i tekstform.",
      ],
    },
    {
      heading: "§ 2 Aftalens genstand og ydelser",
      paragraphs: [
        "myNextDays stiller en cloudbaseret software til administration af ferieboliger og overnatningsvirksomheder til rådighed for brugeren. Funktionsomfanget fremgår af den til enhver tid gældende ydelsesbeskrivelse og omfatter navnlig:",
      ],
      list: [
        "administration af overnatningssteder, belægningskalendere og reservationer (property management-system),",
        "tilslutning til tredjeparters bookingkanaler (f.eks. Booking.com, Airbnb) via en channel manager,",
        "offentliggørelse af tilbud via platformens egen bookingkanal myNextDays,",
        "oprettelse af egne websteder via den integrerede page builder,",
        "bogførings-, afregnings- og rapporteringsfunktioner, herunder ejerafregninger,",
        "kommunikation med gæster samt modtagelse af betalinger via den integrerede betalingsbehandling (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registrering, konto og brugerens oplysninger",
      paragraphs: [
        "Brug af platformen forudsætter registrering af en konto. Brugeren er forpligtet til ved registreringen og i hele aftaleperioden at afgive korrekte, aktuelle og fuldstændige oplysninger om sig selv og sin virksomhed og til straks at opdatere dem ved ændringer.",
        "Loginoplysninger skal holdes hemmelige og beskyttes mod tredjeparters adgang. Brugeren skal straks underrette myNextDays, hvis der er tegn på misbrug af brugerens konto.",
        "En konto kan ikke overdrages. Brugeren sikrer, at alle personer, der bruger kontoen på brugerens vegne, overholder disse betingelser.",
      ],
    },
    {
      heading: "§ 4 myNextDays' rolle ved bookinger",
      paragraphs: [
        "Aftaler om overnatning vedrørende de overnatningssteder, der udbydes på platformen, via tilsluttede tredjepartskanaler eller på brugerens eget websted, indgås udelukkende mellem brugeren (eller den ejer, som brugeren repræsenterer) og den pågældende gæst. myNextDays bliver ikke part i overnatningsaftalen.",
        "Brugeren er alene ansvarlig for, at tilbuddenes indhold (beskrivelser, fotos, priser, tilgængelighed, skatter og afgifter) er korrekt og lovligt.",
      ],
    },
    {
      heading: "§ 5 Betalingsbehandling via Stripe",
      paragraphs: [
        "Betalingsbehandlingstjenesterne for bureauer og udlejere på myNextDays leveres af Stripe og er underlagt [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), som omfatter Stripes tjenestevilkår (samlet »Stripe-rammeaftalen«). Ved at acceptere disse betingelser eller ved fortsat at drive virksomhed som bureau eller udlejer på myNextDays erklærer brugeren sig bundet af Stripe-rammeaftalen, som fra tid til anden kan ændres af Stripe.",
        "Det er en forudsætning for, at myNextDays kan muliggøre betalingsbehandlingstjenester via Stripe, at brugeren giver myNextDays korrekte og fuldstændige oplysninger om sig selv og sin virksomhed. Brugeren bemyndiger myNextDays til at videregive disse oplysninger samt transaktionsdata, der vedrører brugen af de betalingsbehandlingstjenester, som Stripe leverer, til Stripe.",
        "Retsforholdet til Stripe reguleres af den linkede engelsksprogede aftaletekst i den til enhver tid gældende affattelse. Aftalepart for brugere i Det Europæiske Økonomiske Samarbejdsområde er det Stripe-selskab, der er angivet i Stripe-rammeaftalen (i øjeblikket Stripe Payments Europe, Limited, Irland). Stripe behandler personoplysninger i overensstemmelse med [Stripes privatlivspolitik](https://stripe.com/privacy).",
        "Til opfyldelse af lovbestemte identifikations- og kontrolforpligtelser (bl.a. forebyggelse af hvidvask, »know your customer«) kan myNextDays og Stripe til enhver tid kræve yderligere oplysninger og dokumentation, navnlig identitetsdokumenter, oplysninger om reelle ejere og bankoplysninger. Fremlægges de krævede oplysninger eller dokumenter ikke inden for den fastsatte frist, kan modtagelse af betalinger eller udbetalinger helt eller delvist suspenderes, indtil oplysningerne foreligger fuldstændigt.",
      ],
    },
    {
      heading: "§ 6 Udbetalinger, tilbageførsler og negative saldi",
      paragraphs: [
        "Betalingsvejen afhænger af bookingkanalen. Ved bookinger via brugerens egen bookingløsning og ved bookinger via tilsluttede distributionsportaler modtages gæsternes betalinger direkte på brugerens betalingskonto; i disse tilfælde er brugeren over for gæsten betalingsmodtager og aftalepart for indkvarteringsydelsen (§ 4), og myNextDays bliver på intet tidspunkt indehaver af disse midler. myNextDays opkræver intet procentuelt bookinggebyr på sådanne bookinger; provisionen for bookinger via tilsluttede distributionsportaler angives særskilt og faktureres efterfølgende.",
        "Ved bookinger, der indgås via myNextDays-bookingportalen, afvikles betalingen gennem myNextDays. myNextDays tilbageholder her den formidlingsprovision, der fremgår af den til enhver tid gældende prisliste, inklusive omkostningerne til betalingsafvikling, og videresender det resterende beløb til brugeren i overensstemmelse med nedenstående afsnit. Vederlaget for brug af softwaren (§ 7) berøres ikke heraf.",
        "Udbetalinger sker til den bankkonto, som brugeren har angivet. myNextDays kan af risikohensyn tilpasse udbetalingsfrekvensen, navnlig ved nye konti, usædvanlige transaktionsmønstre eller igangværende kontroller.",
        "Refusioner til gæster bæres økonomisk af brugeren. Tilbageførsler (chargebacks) og heraf følgende gebyrer bæres af brugeren ved bookinger via brugerens egen bookingløsning og via tilsluttede distributionsportaler, da brugeren i disse tilfælde er betalingsmodtager; ved bookinger via myNextDays-bookingportalen bærer myNextDays tilbageførselsrisikoen, medmindre tilbageførslen skyldes brugerens pligtforsømmelse (navnlig manglende levering af eller væsentlig afvigelse i indkvarteringsydelsen). myNextDays er berettiget til at modregne beløb, som brugeren skal bære, i fremtidige udbetalinger.",
        "Opstår der en negativ saldo på brugerens betalingskonto, skal brugeren straks udligne den. Brugeren bemyndiger myNextDays og Stripe til at trække negative saldi fra den angivne bankkonto, i det omfang det er lovligt.",
      ],
    },
    {
      heading: "§ 7 Vederlag og afregning",
      paragraphs: [
        "Vederlaget for brug af platformen fremgår af den prisliste, der er aftalt ved aftalens indgåelse, eller af det individuelle tilbud. Alle priser er eksklusive de til enhver tid gældende lovpligtige skatter og angives i den valuta, der er anført i aftalen.",
        "Transaktionsafhængige gebyrer (f.eks. betalings- eller kanalgebyrer) kan tilbageholdes eller modregnes direkte ved behandlingen af den pågældende transaktion.",
        "Kommer brugeren i betalingsmisligholdelse, kan myNextDays efter forudgående varsel spærre adgangen til platformen, indtil de udestående krav er betalt.",
      ],
    },
    {
      heading: "§ 8 Brugerens forpligtelser; egne juridiske tekster",
      paragraphs: [
        "Brugeren sikrer, at brugerens tilbud, indhold og forretningspraksis overholder de til enhver tid gældende love, navnlig lovgivningen om overnatning, registrering, skat og forbrugerbeskyttelse på det sted, hvor overnatningsstedet er beliggende. Brugeren indhenter og opretholder alle nødvendige tilladelser, registreringer og licenser på eget ansvar.",
        "Brugeren er selv ansvarlig for websteder, som brugeren driver via page builderen, samt for sine tilbud på platformen; dette omfatter navnlig egne gæstebetingelser, egne juridiske oplysninger (kolofon) og egne oplysninger om databeskyttelse.",
        "Følgende er navnlig forbudt: offentliggørelse af urigtige eller vildledende tilbud, gennemførelse af proformahandler eller svigagtige transaktioner, omgåelse af betalingsbehandlingen efter § 5 for bookinger indgået via platformen samt enhver brug, der forringer platformens sikkerhed eller tilgængelighed.",
      ],
    },
    {
      heading: "§ 9 Tredjeparters bookingkanaler",
      paragraphs: [
        "Ved tilslutning af tredjepartskanaler (f.eks. Booking.com, Airbnb) gælder desuden den pågældende kanaloperatørs betingelser. Brugeren indgår selv de hertil nødvendige aftaler med kanaloperatøren.",
        "myNextDays varetager den tekniske synkronisering af tilgængelighed, priser og bookingdata, men har ingen indflydelse på kanaloperatørernes indhold, provisioner eller beslutninger og hæfter ikke for deres tilgængelighed.",
      ],
    },
    {
      heading: "§ 10 Tilgængelighed og videreudvikling",
      paragraphs: [
        "myNextDays leverer ydelserne med den omhu, der påhviler en ordentlig erhvervsdrivende, og tilstræber en høj tilgængelighed af platformen. Vedligeholdelsesvinduer, videreudvikling og forhold uden for myNextDays' kontrol (f.eks. driftsforstyrrelser hos tredjepartsleverandører) kan midlertidigt begrænse tilgængeligheden.",
        "myNextDays må videreudvikle platformen og ændre funktioner, forudsat at aftalens formål ikke bringes i fare, og ændringen er rimelig for brugeren.",
      ],
    },
    {
      heading: "§ 11 Data og databeskyttelse",
      paragraphs: [
        "I det omfang myNextDays i forbindelse med leveringen af platformen behandler personoplysninger på brugerens vegne (navnlig gæstedata), indgår parterne en databehandleraftale i henhold til artikel 28 i databeskyttelsesforordningen (GDPR).",
        "Brugeren forbliver ansvarlig for, at indsamlingen og behandlingen af de data, som brugeren tilfører, er lovlig efter databeskyttelsesreglerne. Nærmere oplysninger om myNextDays' databehandling fremgår af platformens oplysninger om databeskyttelse; for Stripes databehandling gælder § 5.",
      ],
    },
    {
      heading: "§ 12 Immaterielle rettigheder",
      paragraphs: [
        "Alle rettigheder til platformen, dens software og dens indhold (bortset fra det indhold, som brugeren har lagt op) tilhører myNextDays eller dennes licensgivere. Brugeren får i aftaleperioden en simpel, ikke-overdragelig ret til at bruge platformen i det aftalte omfang.",
        "Brugeren giver myNextDays de simple brugsrettigheder til det indhold, som brugeren har lagt op, der er nødvendige for driften af platformen (navnlig til lagring, reproduktion, visning og overførsel til tilsluttede kanaler).",
      ],
    },
    {
      heading: "§ 13 Ansvar",
      paragraphs: [
        "myNextDays hæfter ubegrænset for forsæt og grov uagtsomhed samt for skader som følge af krænkelse af liv, legeme eller helbred.",
        "Ved simpel uagtsomhed hæfter myNextDays kun for tilsidesættelse af væsentlige kontraktforpligtelser (kardinalforpligtelser), begrænset til den for aftalen typiske, påregnelige skade. Ansvar efter produktansvarslovgivningen samt for afgivne garantier berøres ikke.",
        "For tab af data hæfter myNextDays kun i det omfang, skaden også ville være indtrådt, hvis brugeren havde foretaget korrekt og regelmæssig sikkerhedskopiering, medmindre sikkerhedskopieringen kontraktligt påhviler myNextDays.",
      ],
    },
    {
      heading: "§ 14 Løbetid, opsigelse og spærring",
      paragraphs: [
        "Løbetid og opsigelsesvarsler fremgår af den pågældende aftale. Retten til ekstraordinær opsigelse af væsentlig grund berøres ikke.",
        "myNextDays kan midlertidigt spærre adgangen til platformen eller enkelte funktioner (herunder modtagelse af betalinger og udbetalinger), hvis der er konkrete tegn på overtrædelse af disse betingelser, på svig eller på misbrug, eller hvis myNextDays er forpligtet hertil ved lov eller efter påbud fra en betalingstjenesteudbyder. Brugeren underrettes om spærringen, i det omfang det er lovligt.",
        "Efter aftalens ophør stiller myNextDays på anmodning brugerens data til rådighed for eksport i et gængs format inden for 30 dage; herefter slettes dataene, medmindre lovbestemte opbevaringspligter er til hinder herfor.",
      ],
    },
    {
      heading: "§ 15 Ændringer af disse betingelser",
      paragraphs: [
        "myNextDays kan ændre disse betingelser med virkning for fremtiden, i det omfang det er nødvendigt af vægtige grunde (navnlig lovændringer, ændringer i retspraksis eller krav fra betalingstjenesteudbydere), og brugeren ikke stilles urimeligt ringere herved.",
        "Ændringer varsles over for brugeren i tekstform mindst seks uger, inden de træder i kraft. Gør brugeren ikke indsigelse inden for varslingsfristen, eller fortsætter brugeren med at bruge platformen efter ikrafttrædelsen, anses de ændrede betingelser for accepteret; der gøres særskilt opmærksom på denne retsvirkning i varslingen.",
      ],
    },
    {
      heading: "§ 16 Afsluttende bestemmelser",
      paragraphs: [
        "Retten i den stat, hvor udbyderen har sit hjemsted, finder anvendelse med udelukkelse af FN's konvention om aftaler om internationale køb (CISG). Ufravigelige regler i den stat, hvor brugeren har sit hjemsted, berøres ikke.",
        "Eksklusivt værneting for alle tvister, der udspringer af eller har forbindelse med denne aftale, er — i det omfang det er lovligt — udbyderens hjemsted.",
        "Skulle enkelte bestemmelser i disse betingelser være eller blive ugyldige, berøres gyldigheden af de øvrige bestemmelser ikke.",
      ],
    },
  ],
};
