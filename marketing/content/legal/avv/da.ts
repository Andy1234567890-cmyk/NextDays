// Dänische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Databehandleraftale",
  metaDescription:
    "Databehandling efter artikel 28 i databeskyttelsesforordningen mellem myNextDays ApS og de virksomheder, der bruger platformen: genstand, instrukser, sikkerhed, underdatabehandlere.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Denne aftale (herefter »databehandleraftalen«) gælder mellem den virksomhed, der bruger platformen myNextDays (herefter »den dataansvarlige«), og ${ANBIETER.firma} (herefter »databehandleren« eller »vi«), og konkretiserer forpligtelserne i artikel 28 i forordning (EU) 2016/679 (databeskyttelsesforordningen).`,
    `Den inddrages via de [almindelige forretningsbetingelser](${AGB_URL}) og gælder i hele den periode, hvor platformen benyttes. Den har forrang for forretningsbetingelserne, for så vidt det angår behandling af personoplysninger på den dataansvarliges vegne.`,
    "Derudover gælder [privatlivspolitikken](/datenschutz) for de oplysninger, som vi behandler som selvstændig dataansvarlig — navnlig oplysningerne om kontoen og forretningsforholdet.",
  ],
  sections: [
    {
      heading: "Genstand og rollefordeling",
      unterpunkte: [
        {
          paragraphs: [
            "Genstanden er behandlingen af de personoplysninger, som den dataansvarlige lægger ind i platformen eller indsamler via den, så vi kan levere de aftalte ydelser: administration af ejendomme, reservationer og belægning, kommunikation med gæster, betalingsafvikling, bogføring og ejerafregning, tilkobling til bookingportaler, hjemmesidebygger samt opgave- og teamadministration.",
          ],
        },
        {
          paragraphs: [
            "Den dataansvarlige bestemmer formålene med og hjælpemidlerne til denne behandling. Vi behandler udelukkende oplysningerne efter dennes dokumenterede instruks og ikke til egne formål.",
          ],
        },
        {
          paragraphs: [
            "For oplysningerne om kontoen, faktureringen af vore egne ydelser, systemsikkerheden og den lovpligtige opbevaring er vi selv dataansvarlige. Denne behandling er ikke genstand for denne databehandleraftale.",
          ],
        },
      ],
    },
    {
      heading: "Behandlingens karakter, omfang og formål",
      paragraphs: [
        "Behandlingen sker ved indsamling, lagring, visning, ændring, videregivelse til modtagere valgt af den dataansvarlige (f.eks. bookingportaler, betalingstjenesteudbydere), begrænsning og sletning — i automatiseret form i platformen.",
        "Behandlingsstedet er Den Europæiske Union; undtagelserne er udtømmende nævnt i afsnit 8.",
      ],
    },
    {
      heading: "Kategorier af registrerede",
      list: [
        "Gæster og bookende, herunder medrejsende",
        "Interesserede, der sender forespørgsler eller beskeder",
        "Ejere af de administrerede ejendomme",
        "Den dataansvarliges medarbejdere (team, rengøring, service, reception)",
        "Kontaktpersoner hos den dataansvarliges partnere og leverandører",
      ],
    },
    {
      heading: "Kategorier af personoplysninger",
      list: [
        "Stamoplysninger: navn, adresse, fødselsdato hvis registreret, nationalitet hvis registreret af hensyn til indberetningspligten",
        "Kontaktoplysninger: e-mailadresse, telefonnummer",
        "Bookingoplysninger: periode, ejendom, antal rejsende, priser, tillægsydelser, afbestillinger",
        "Betalingsoplysninger: beløb, valuta, betalingsmåde, betalingsstatus, referencer (fuldstændige kortoplysninger når ikke vore systemer)",
        "Kommunikationsoplysninger: beskeder, noter, anmeldelser",
        "Medarbejdernes adgangs- og brugsoplysninger: rolle, rettigheder, tidspunkt for login, enhed og IP-adresse ved login",
        "Særlige kategorier efter artikel 9 i databeskyttelsesforordningen er ikke genstand for opgaven; den dataansvarlige lægger ikke sådanne oplysninger i fritekstfelter.",
      ],
    },
    {
      heading: "Instrukser",
      unterpunkte: [
        {
          paragraphs: [
            "Den dataansvarlige giver instrukser ved brug og konfiguration af platformen samt i tekstform til vor kontaktadresse. Mundtlige instrukser bekræfter vi i tekstform.",
          ],
        },
        {
          paragraphs: [
            "Anser vi en instruks for ulovlig, oplyser vi det straks og må udsætte gennemførelsen, indtil den dataansvarlige bekræfter eller ændrer den.",
          ],
        },
        {
          paragraphs: [
            "Er vi retligt forpligtet til at behandle oplysninger (f.eks. over for myndigheder), underretter vi den dataansvarlige på forhånd, i det omfang loven tillader os det.",
          ],
        },
        {
          titel: "Tilkobling af den dataansvarliges egne tjenester",
          paragraphs: [
            "Den dataansvarlige kan forbinde sin konto via en grænseflade med en tjeneste, som denne selv har valgt, og som denne har indgået sin egen aftale med — f.eks. en AI-assistent. Giver denne en sådan forbindelse, er det dennes udtrykkelige instruks efter artikel 28, stk. 3, litra a, i databeskyttelsesforordningen om at udlevere de frigivne oplysninger til denne tjeneste. Den omfatter udtrykkeligt også en dermed forbundet overførsel til et tredjeland, hvis tjenesten har hjemsted uden for Den Europæiske Union.",
            "Kort sagt: en sådan forbindelse bestemmer den dataansvarlige alene, og for den forbundne tjeneste er denne selv ansvarlig.",
            "Kun en konto med rettigheden til at administrere eksterne forbindelser kan give den. Denne rettighed er forbeholdt rollen »administrator«; konti med begrænsede rettigheder — også rollen »medadministrator« — kan ikke give en forbindelse. Vi registrerer, hvem der har givet den hvornår og til hvilken tjeneste, hvilke typer oplysninger der blev frigivet, og hvilke opslag der er foretaget; denne registrering er tilgængelig for den dataansvarlige i brugerfladen under »Konto → Forbindelser«, så denne kan opfylde sin ansvarlighedsforpligtelse og besvare anmodninger om indsigt.",
            "Den forbundne tjeneste er ikke vor underdatabehandler: vi giver den ikke opgaven, vi vælger den ikke, og vi instruerer den ikke. Den behandler oplysningerne på grundlag af den aftale, som den dataansvarlige selv har indgået med den. For denne behandling, for dens retsgrundlag og for garantierne ved overførsel til et tredjeland er den dataansvarlige derfor ansvarlig; den er ikke genstand for denne databehandleraftale.",
            "Fritekstfelter — bookingnoter og indholdet af gæstebeskeder — er som standard undtaget fra en sådan forbindelse. De kan indeholde særlige kategorier af personoplysninger efter artikel 9 i databeskyttelsesforordningen, f.eks. helbredsoplysninger. Den dataansvarlige skal frigive dem særskilt, når forbindelsen gives; uden denne frigivelse overføres de ikke.",
            "Den dataansvarlige kan til enhver tid afbryde en given forbindelse i brugerfladen. Fornyelsestokens slettes samtidig, og ved hvert yderligere opslag kontrolleres, om samtykket stadig består — en afbrudt tjeneste kan derfor øjeblikkeligt intet læse mere, ikke først når dens adgangstoken udløber.",
          ],
        },
      ],
    },
    {
      heading: "Fortrolighed",
      paragraphs: [
        "Alle personer, der som led i opgaven kan få adgang til oplysningerne, er underlagt fortrolighed og undervises regelmæssigt i databeskyttelse. Adgangen er begrænset til det, der er nødvendigt for den enkelte opgave.",
        "Vore medarbejderes adgang til kundeoplysninger sker kun ved fejlretning, efter en supportanmodning eller for at opfylde lovmæssige forpligtelser.",
      ],
    },
    {
      heading: "Behandlingssikkerhed",
      paragraphs: [
        "Vi træffer de tekniske og organisatoriske foranstaltninger, der kræves efter artikel 32 i databeskyttelsesforordningen. Navnlig følgende er gennemført:",
      ],
      list: [
        "Transportkryptering (TLS) for alle forbindelser, HTTP-sikkerhedsheadere inklusive en streng Content-Security-Policy",
        "Adskillelse af kunderne direkte i databasen: rækkebaserede adgangsregler (Row Level Security) plus inddragne tabelrettigheder for følsomme oplysninger, så adgang uden for egen virksomhed også er udelukket ad den direkte databasevej",
        "Rollebaserede rettigheder med dataadskillelse: service- og rengøringspersonale får ingen økonomi- og salgsoplysninger, ejere kun deres egne ejendomme; gæsteoplysninger maskeres for roller uden adgang",
        "Tofaktorgodkendelse (TOTP) tilgængelig for konti; fornyet login ved sikkerhedskritiske ændringer",
        "Log over login med enhed, tidspunkt og IP-adresse, som den dataansvarlige kan se",
        "Forbindelser til eksterne tjenester kan kun gives af en konto med rollen »administrator«; hvert opslag via en sådan forbindelse logges (værktøj, tidspunkt, omfang — uden indholdet selv) og kan ses af den dataansvarlige. En afbrudt forbindelse mister adgangen øjeblikkeligt: ved hvert opslag kontrolleres, om samtykket stadig består",
        "Begrænsning af antallet af forespørgsler mod automatiserede angreb, kontrol af signaturer på indgående webhook-kald",
        "Krypterede sikkerhedskopier lagret uden for produktionssystemet med regelmæssig gendannelsestest",
        "Adskilte miljøer til udvikling og drift; ændringer i databasen udelukkende via versionerede migreringer",
      ],
    },
    {
      heading: "Underdatabehandlere",
      paragraphs: [
        "Den dataansvarlige godkender brugen af følgende underdatabehandlere. Med hver af dem foreligger aftaler efter artikel 28, stk. 4, i databeskyttelsesforordningen med forpligtelser, der svarer til denne databehandleraftale.",
      ],
      list: [
        "Hetzner Online GmbH, Tyskland (servere, database, medier, mailserver; datacenter i Helsinki, Finland)",
        "Stripe Payments Europe, Limited, Irland (betalinger, udbetalinger, lovpligtig identitetskontrol)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembourg (betalinger, hvis den dataansvarlige aktiverer dem)",
        "Channex.io Ltd, Det Forenede Kongerige (tilkobling til bookingportaler, hvis aktiveret)",
        "Meta Platforms Ireland Limited, Irland (WhatsApp-beskeder, hvis aktiveret)",
        "Google Ireland Limited, Irland (oversættelse af indhold; login med Google, hvis benyttet)",
        "Groq, Inc., USA (svarforslag i indbakken, hvis aktiveret)",
        "Cloudflare, Inc., USA (administration af DNS-posterne for egne domæner, hvis benyttet)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Et skift eller en tilføjelse oplyser vi mindst 30 dage i forvejen. Den dataansvarlige kan inden for denne frist gøre indsigelse af en vigtig, databeskyttelsesmæssig grund; ryddes indsigelsen ikke af vejen, kan denne opsige den berørte del af ydelsen eller aftalen.",
          ],
        },
        {
          paragraphs: [
            "Tjenester, som den dataansvarlige selv aftaler med en tredjemand, er ikke underdatabehandling, men en overførsel foranlediget af denne. Det gælder for en bookingportal, som denne har sin egen aftale med, og ligeledes for en AI-assistent eller et andet program, som denne forbinder med sin konto via grænsefladen (se afsnittet »Instrukser«).",
            "Afgørende er ikke, gennem hvis systemer oplysningerne løber, men hvem der tilkalder tjenesten: underdatabehandling opstår, når VI giver en yderligere leverandør en opgave for at levere vor ydelse. Vælger den dataansvarlige selv tjenesten og indgår aftalen med den, behandler denne tjeneste for den dataansvarlige — ikke for os. Denne afgrænsning svarer til aftalepraksis hos sammenlignelige udbydere for tredjepartstjenester, som kunden selv forbinder.",
          ],
        },
      ],
    },
    {
      heading: "Overførsel til tredjelande",
      paragraphs: [
        "Overførsler til modtagere uden for EU er begrænset til de ovenfor nævnte tjenester med hjemsted i USA henholdsvis Det Forenede Kongerige. Grundlaget er Europa-Kommissionens standardbestemmelser om databeskyttelse efter artikel 46, stk. 2, litra c, i databeskyttelsesforordningen eller en gældende afgørelse om tilstrækkeligheden af beskyttelsesniveauet; supplerende beskyttelsesforanstaltninger (kryptering, dataminimering) anvendes.",
      ],
    },
    {
      heading: "Bistand til den dataansvarlige",
      unterpunkte: [
        {
          paragraphs: [
            "Vi bistår den dataansvarlige med at besvare anmodninger fra registrerede (artikel 15 til 22 i databeskyttelsesforordningen). Platformen tilbyder hertil indsigt, rettelse, eksport og sletning af oplysningerne direkte i brugerfladen. Henvender registrerede sig direkte til os, henviser vi dem til den dataansvarlige og underretter denne.",
          ],
        },
        {
          paragraphs: [
            "Vi bistår desuden ved konsekvensanalyser vedrørende databeskyttelse, ved overholdelsen af forpligtelserne i artikel 32 til 36 i databeskyttelsesforordningen og ved forespørgsler fra tilsynsmyndigheder.",
          ],
        },
      ],
    },
    {
      heading: "Brud på persondatasikkerheden",
      paragraphs: [
        "Bliver vi bekendt med et brud på persondatasikkerheden, som berører den dataansvarliges oplysninger, underretter vi denne straks, senest inden for 48 timer efter kendskabet, i tekstform.",
        "Meddelelsen indeholder, i det omfang det er kendt, hændelsens karakter og tidspunkt, berørte kategorier af oplysninger og persongrupper, de sandsynlige konsekvenser samt de trufne og de foreslåede foranstaltninger. Vi bistår den dataansvarlige med dennes anmeldelses- og underretningspligter efter artikel 33 og 34 i databeskyttelsesforordningen.",
      ],
    },
    {
      heading: "Dokumentation og kontrol",
      unterpunkte: [
        {
          paragraphs: [
            "Vi dokumenterer på anmodning overholdelsen af denne databehandleraftale, navnlig ved oplysning om de trufne foranstaltninger og om de anvendte underdatabehandlere.",
          ],
        },
        {
          paragraphs: [
            "Den dataansvarlige kan gennemføre kontroller i det nødvendige omfang eller lade dem gennemføre af en uafhængig revisor, der ikke konkurrerer med os. Kontroller sker efter varsel med rimelig frist, inden for almindelig arbejdstid og uden at forstyrre driften. Omkostningerne ved en kontrol, der går videre end oplysning, bæres af den dataansvarlige, medmindre kontrollen er foranlediget af en hændelse forårsaget af os.",
          ],
        },
      ],
    },
    {
      heading: "Sletning og tilbagelevering",
      paragraphs: [
        "Efter aftalens ophør stiller vi på anmodning den dataansvarliges oplysninger til rådighed for eksport inden for 30 dage i et almindeligt, maskinlæsbart format. Derefter sletter vi oplysningerne inklusive kopierne.",
        "Undtaget er oplysninger, hvor der gælder en lovbestemt opbevaringspligt (navnlig faktura- og bogføringsoplysninger); disse blokeres og slettes efter fristens udløb. Sikkerhedskopier overskrives med den almindelige rotationscyklus.",
      ],
    },
    {
      heading: "Ansvar og rangorden",
      paragraphs: [
        "Artikel 82 i databeskyttelsesforordningen gælder. I forholdet mellem parterne gælder derudover ansvarsreglerne i forretningsbetingelserne, for så vidt de ikke strider mod databeskyttelsesforordningen.",
        "Strider forretningsbetingelserne og denne databehandleraftale mod hinanden ved behandling på den dataansvarliges vegne, gælder denne databehandleraftale. Bliver en bestemmelse ugyldig, forbliver det øvrige indhold gyldigt; parterne erstatter den med en tilladt regel med samme formål.",
      ],
    },
    {
      heading: "Ændringer af denne aftale",
      paragraphs: [
        "Vi må tilpasse denne databehandleraftale, i det omfang det bliver nødvendigt på grund af lovændringer, krav fra tilsynsmyndigheder, krav fra betalingstjenesteudbydere eller teknisk udvikling, og den dataansvarlige derved ikke stilles ringere.",
        "Ændringer varsler vi mindst 30 dage før ikrafttrædelsen i tekstform. Gør den dataansvarlige ikke indsigelse inden for denne frist, anses de for accepteret; der oplyses om denne følge i varslet. Ved indsigelse kan hver part opsige aftalen med virkning fra ikrafttrædelsestidspunktet.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Forespørgsler om denne aftale, instrukser og meddelelser sendes til [${ANBIETER.email}](mailto:${ANBIETER.email}) eller til ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
