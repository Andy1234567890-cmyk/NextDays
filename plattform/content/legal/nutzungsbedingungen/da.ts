import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Brugsvilkår for gæster",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Disse brugsvilkår regulerer brugen af bookingportalen myBestDays (herefter „platformen“) for rejsende og bookere (herefter „gæst“ eller „du“).",
    `Platformen drives af ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark, CVR-nr. ${ANBIETER.cvr} (herefter „myBestDays“ eller „vi“). myBestDays er et varemærke tilhørende dette selskab og ikke en selvstændig juridisk person. De fuldstændige udbyderoplysninger findes i [Juridiske oplysninger](https://mybestdays.dk/rechtliches/impressum).`,
    "Ved at bruge platformen accepterer du disse vilkår. Læs dem venligst omhyggeligt.",
  ],
  summary: {
    heading: "Resumé af disse vilkår",
    paragraphs: [
      "myBestDays er en markedsplads. Vi stiller platformen til rådighed, hvor udbydere tilbyder deres indkvartering — vi leverer ikke selve indkvarteringen. Indkvarteringsaftalen indgås mellem dig og udbyderen, ikke med os.",
      "Det, du ser i et opslag, kommer fra udbyderen: beskrivelse, billeder, faciliteter, pris, afbestillingsvilkår og husregler. Vi kontrollerer opslag, men vi kan ikke indestå for enhver oplysning fra en udbyder.",
      "Den pris, du ser, når du gennemfører bookingen, er totalprisen for de bookede ydelser. Beløb, der først forfalder på stedet (f.eks. turistskat eller et depositum), oplyser vi særskilt på forhånd.",
      "Går noget galt, så kontakt os først. Afsnit A15 beskriver, hvordan du indgiver en klage, og hvilke veje der derefter står åbne for dig.",
      "Dette resumé forklarer vilkårene, men erstatter dem ikke. Den fuldstændige tekst er afgørende.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Alle bookinger via myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definitioner",
          paragraphs: [
            "De begreber, der anvendes i disse vilkår, er forklaret i ordlisten sidst i dette dokument. De vigtigste er:",
          ],
          list: [
            "„Platformen“ — websitet, mobilapplikationerne og alle øvrige adgange, hvorigennem myBestDays viser indkvartering og formidler bookinger.",
            "„Udbyder“ — den fysiske eller juridiske person, der udbyder indkvartering via platformen (vært, udlejer, bureau, hotel- eller overnatningsvirksomhed).",
            "„Indkvartering“ — den overnatningsydelse, udbyderen tilbyder, altså en feriebolig eller en enhed af en værelses- eller boligtype.",
            "„Booking“ — den reservation af en indkvartering for en bestemt periode, der indgås via platformen.",
            "„Totalpris“ — det beløb, der vises ved gennemførelsen af bookingen, inklusive alle skatter, gebyrer og tillæg, der afregnes via platformen.",
            "„Omkostninger på stedet“ — beløb, der ikke afregnes via platformen, men forfalder hos udbyderen (f.eks. turistskat, depositum, slutrengøring efter udbyderens valg).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Om disse vilkår",
          paragraphs: [
            "Disse vilkår gælder for enhver brug af platformen, uanset om du opretter en konto, og uanset om der indgås en booking.",
            "Afsnit A gælder for alle bookinger. Afsnit B indeholder de supplerende regler for indkvartering. Er de i modstrid, har afsnit B forrang.",
            "For selve overnatningsydelsen gælder desuden den pågældende udbyders vilkår (navnlig husorden og afbestillingsvilkår), som er angivet i opslaget. Disse udbydervilkår gælder ved siden af vores; de kan ikke fravige vores vilkår, for så vidt angår dit forhold til os.",
            "Disse vilkår foreligger på alle 24 officielle sprog i Den Europæiske Union. Ved afvigelser mellem sprogversionerne er den tyske version afgørende, medmindre ufravigelig ret i dit bopælsland foreskriver andet.",
            "Ufravigelige forbrugerrettigheder efter loven i dit bopælsland berøres ikke af disse vilkår.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Om myBestDays",
          paragraphs: [
            "myBestDays er en online markedsplads for ferieboliger og overnatningsvirksomheder. Vi driver platformen, hvor udbydere præsenterer deres indkvartering, og gæster kan booke den.",
            "Vi er formidler, ikke logivært. Vi ejer, driver, forvalter eller kontrollerer ingen af de indkvarteringer, der udbydes på platformen, og vi er ikke part i indkvarteringsaftalen.",
            "myBestDays er en formidlingstjeneste i henhold til forordning (EU) 2022/2065 om digitale tjenester. Vores oplysninger og procedurer efter denne forordning findes under [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays er ikke rejsearrangør. Vi sammensætter ikke pakkerejser i henhold til direktiv (EU) 2015/2302; om sammensatte rejsearrangementer se A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Vores platform",
          paragraphs: [
            "Indholdet af et opslag — beskrivelse, billeder, faciliteter, belægningsgrænser, priser, ledighed, afbestillingsvilkår og husregler — kommer fra den pågældende udbyder. Udbyderen er ansvarlig for rigtigheden og fuldstændigheden.",
            "Vi kontrollerer opslag før offentliggørelse og løbende for åbenbare overtrædelser af vores [Retningslinjer for passende indhold](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Der består ingen pligt til generel overvågning af alt indhold, og en sådan ville efter artikel 8 i forordning (EU) 2022/2065 heller ikke være tilladt.",
            "Hvordan vi ordner søgeresultater, og hvilke forhold der bestemmer rækkefølgen, forklarer vi i [Priser, rangordning og anbefalinger](https://mybestdays.dk/rechtliches/preisangaben).",
            "Vi bestræber os på en vedvarende tilgængelig platform, men skylder ikke uafbrudt tilgængelighed. Vedligeholdelse, driftsforstyrrelser og tilpasninger kan forekomme.",
            "Oversættelser af udbyderindhold kan være maskinelt fremstillet. Den oprindelige version, udbyderen har indlagt, er afgørende.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Vores værdier",
          paragraphs: [
            "Vi forventer, at gæster og udbydere omgås hinanden med respekt. Forskelsbehandling på grund af oprindelse, hudfarve, religion, tro, køn, kønsidentitet, seksuel orientering, handicap, alder eller lignende forhold tolereres ikke på platformen — se [Antidiskriminationspolitik](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "For adfærd under opholdet gælder [Grundregler for gæster](https://mybestdays.dk/rechtliches/grundregeln-gaeste), for udbydere [Adfærdskodeks for udbydere](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Din konto og din brug af platformen",
          paragraphs: [
            "Du kan oprette en konto for at booke. Du er ansvarlig for at holde dine adgangsoplysninger fortrolige og skal underrette os straks, hvis du har mistanke om uberettiget brug.",
            "Du må kun bruge platformen, hvis du er myndig og gyldigt kan indgå aftaler.",
            "Dine oplysninger ved registrering og booking skal være rigtige og fuldstændige — navnlig navn, kontaktoplysninger og antal rejsende. Udbyderen har brug for disse oplysninger for at kunne stille indkvarteringen til rådighed og opfylde sine registreringspligter.",
            "Navnlig følgende er ikke tilladt:",
          ],
          list: [
            "proformabookinger, svigagtige betalinger eller brug af andres betalingsmidler uden berettigelse;",
            "automatiseret udtræk af platformen (scraping, crawlere) ud over det, vores robots.txt tillader;",
            "handlinger, der forstyrrer eller overbelaster platformen eller den underliggende infrastruktur eller omgår dens sikkerhedsforanstaltninger;",
            "indlæggelse af ulovligt, krænkende eller vildledende indhold i anmeldelser, beskeder eller profiloplysninger;",
            "forsøg på at afvikle bookingen uden om platformen, efter at kontakten er opstået via den — se [Gebyrer uden om platformen](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Priser",
          paragraphs: [
            "Alle priser vises som totalpris inklusive skatter og alle gebyrer, der afregnes via platformen, så snart rejseoplysningerne (periode og antal rejsende) er fastlagt. Forfalder en bestanddel først på stedet, oplyser vi den særskilt før gennemførelsen af bookingen.",
            "Priser vises i opslagets valuta. Vises et beløb desuden i en anden valuta, er det en uforbindende omregning til orientering; der afregnes i opslagets valuta, medmindre andet er angivet ved betalingen.",
            "Priser kan ændre sig, indtil bookingen er gennemført, f.eks. fordi udbyderen justerer dem, eller ledigheden ændrer sig. Afgørende er den pris, der vises umiddelbart før den bindende booking og nævnes i bookingbekræftelsen.",
            "Åbenbare prisfejl (f.eks. et beløb, der er forkert med tierpotenser) binder hverken os eller udbyderen. Konstaterer vi en sådan fejl, underretter vi dig straks; du kan da afbestille bookingen uden omkostninger.",
            "Hvordan servicegebyrer er sammensat, fremgår af [Servicegebyrer](https://mybestdays.dk/rechtliches/servicegebuehren). Om skatter og afgifter se [Skattepolitik](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Betaling",
          paragraphs: [
            "Betalinger via platformen afvikles gennem betalingstjenesteudbyderen Stripe. Betalingsdata (f.eks. kortoplysninger) indsamles og behandles direkte af Stripe; myBestDays gemmer ingen fuldstændige kortoplysninger.",
            "Hvornår hvilket beløb forfalder — depositum, restbetaling eller betaling på stedet — afhænger af opslaget og oplyses før gennemførelsen af bookingen. Nærmere fremgår af [Betalingsvilkår](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Er der i opslaget angivet et depositum, kan det forhåndsgodkendes eller opkræves og helt eller delvist tilbageholdes ved skade; oplysningerne i opslaget er afgørende.",
            "Mislykkes en betaling, eller tilbageføres den, kan bookingen afbestilles. Udbyderen kan fortsat kræve de beløb, der er opstået efter dennes afbestillingsvilkår.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Politikker",
          paragraphs: [
            "Ud over disse vilkår gælder følgende politikker, som er en del af aftalen mellem dig og os:",
          ],
          list: [
            "[Retningslinjer for passende indhold](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Anmeldelsespolitik](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Antidiskriminationspolitik](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Grundregler for gæster](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Afbestillingsvilkår](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Ombookings- og refusionspolitik](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Politik for alvorlige forstyrrelser](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Ophavsretspolitik](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Databeskyttelse og cookies",
          paragraphs: [
            "Hvordan vi behandler personoplysninger, fremgår af [Privatlivspolitik](https://mybestdays.dk/rechtliches/datenschutz). Hvilke cookies og lignende teknologier vi anvender, fremgår af [Cookiepolitik](https://mybestdays.dk/rechtliches/cookies).",
            "Ved en booking videregiver vi til udbyderen de oplysninger, denne har brug for til at levere overnatningsydelsen. Udbyderen er selvstændig dataansvarlig herfor; for denne gælder [Databeskyttelsesstandarder for værter](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Tilgængelighed",
          paragraphs: [
            "Vores status for platformens tilgængelighed og vejen til at indberette barrierer beskrives i [Tilgængelighedserklæring](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Oplysninger om en indkvarterings tilgængelighed kommer fra udbyderen. Er du afhængig af bestemte forhold, så afklar dem med udbyderen via beskedfunktionen før bookingen.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Anmeldelser og brugergenereret indhold",
          paragraphs: [
            "Efter opholdet kan du afgive en anmeldelse. Anmeldelser må kun afgives af den, der har booket via platformen og har påbegyndt opholdet eller kunne have påbegyndt det — derved sikrer vi, at offentliggjorte anmeldelser stammer fra faktiske gæster.",
            "Vi betaler ikke for anmeldelser, ændrer ikke deres indhold og undertrykker ikke en anmeldelse, blot fordi den er negativ. Nærmere og de grunde, hvoraf vi fjerner en anmeldelse, fremgår af [Anmeldelsespolitik](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "For indhold, du indlægger — anmeldelser, billeder, beskeder, profiloplysninger — forbliver du ansvarlig. Du giver os en ikke-eksklusiv, geografisk og tidsmæssigt ubegrænset, vederlagsfri ret til at gengive, bearbejde (f.eks. beskære, oversætte) og gøre dette indhold offentligt tilgængeligt som led i driften og markedsføringen af platformen. Du kan slette dit indhold; allerede foretagne anvendelser i allerede offentliggjorte sammenstillinger berøres ikke heraf.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Beskeder og kommunikation med udbyderen",
          paragraphs: [
            "Beskeder mellem dig og udbyderen går via platformen. Vi stiller beskedfunktionen til rådighed, men er hverken afsender eller modtager af indholdet.",
            "Vi må automatiseret kontrollere beskeder for overtrædelser af disse vilkår (f.eks. kontaktoplysninger til omgåelse af platformen, svindelmønstre, ulovligt indhold) og tilbageholde eller fjerne de berørte beskeder. Om en fjernelse underretter vi dig med en begrundelse efter A17.",
            "Vi sender dig beskeder om din booking (bekræftelse, ændringer, ankomstoplysninger) til den angivne e-mailadresse. Disse beskeder er aftalekommunikation og kan ikke frameldes, så længe bookingen består. Markedsføringsbeskeder modtager du kun, hvis du har samtykket, eller loven tillader det uden samtykke; du kan til enhver tid gøre indsigelse.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Immaterielle rettigheder",
          paragraphs: [
            "Platformen, dens udformning, software, databaser, tekster og varemærker er beskyttet. Du får en ikke-eksklusiv, ikke-overdragelig ret til at bruge platformen til at søge efter og booke indkvartering — ikke mere.",
            "Brugen af vores varemærker og logoer reguleres af [Retningslinjer for varemærker](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Mener du, at indhold på platformen krænker din ophavsret, så følg [Ophavsretspolitik](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Hvad du gør, hvis noget går galt",
          paragraphs: [
            "Vedrører problemet selve indkvarteringen, så henvend dig først til udbyderen — via beskedfunktionen eller på stedet. Mange problemer løses hurtigst sådan.",
            "Kommer du ikke videre med udbyderen, eller vedrører problemet platformen, betalingen eller bookingafviklingen, så henvend dig til os. Hvordan du når os, og hvordan vi behandler klager, fremgår af [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).",
            "Hav følgende klar: dit bookingnummer, bookingens e-mailadresse, en kort beskrivelse af problemet med dit ønske om, hvordan vi skal hjælpe, og den tilhørende dokumentation (billeder, beskeder, kvitteringer).",
            "Er indkvarteringen ikke til rådighed ved ankomsten eller afviger den væsentligt fra opslaget, gælder [Ombookings- og refusionspolitik](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Europa-Kommissionens platform for onlinetvistbilæggelse (OTB-platformen) er ophævet ved forordning (EU) 2024/3228 og har indstillet driften; den står ikke længere til rådighed som vej. Hvilke organer der træder i stedet, fremgår af [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).",
            "Har vi truffet en foranstaltning mod dit indhold eller din konto, kan du ud over vores interne klageprocedure indbringe sagen for et udenretsligt tvistbilæggelsesorgan, der er certificeret efter artikel 21 i forordning (EU) 2022/2065. Dets afgørelser er ikke bindende for os.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Foranstaltninger mod upassende adfærd",
          paragraphs: [
            "Overtræder du disse vilkår eller en af de politikker, der er nævnt i A9, kan vi — afstemt efter overtrædelsens grovhed, hyppighed og virkning — fjerne indhold eller begrænse dets synlighed, spærre funktioner, afbestille bookinger eller spærre din konto midlertidigt eller permanent.",
            "Før en foranstaltning vurderer vi den enkelte sag. Ved åbenbart ulovligt indhold, ved fare for personer eller ved svindel kan vi handle straks.",
            "Enhver foranstaltning begrunder vi over for dig og henviser til klagevejen — se A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Anmeldelse af ulovligt indhold og begrundelse af foranstaltninger",
          paragraphs: [
            "Enhver kan anmelde indhold til os, som vedkommende anser for ulovligt. Anmeldelsesproceduren efter artikel 16 i forordning (EU) 2022/2065, vores kontaktpunkter og håndteringen af anmeldelser er beskrevet under [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa).",
            "Træffer vi en foranstaltning mod indhold, du har indlagt, eller mod din konto, modtager du en begrundelse med angivelse af grunden, det faktiske grundlag, retsgrundlaget eller den tilsidesatte aftalebestemmelse samt klagemulighederne.",
            "Mod enhver foranstaltning kan du inden for seks måneder klage vederlagsfrit. Klager behandles af mennesker, ikke alene automatiseret.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Ansvarsbegrænsning",
          paragraphs: [
            "Vi hæfter ubegrænset for forsæt og grov uagtsomhed, for skader som følge af krænkelse af liv, legeme eller helbred samt i omfanget af en af os påtaget garanti. Krav efter produktansvarsretten berøres ikke.",
            "I øvrigt er vores ansvar begrænset til det forudsigelige tab, der typisk opstår ved tilsidesættelse af de forpligtelser, på hvis opfyldelse du må kunne stole — og kun i det omfang den gældende ret tillader en sådan begrænsning.",
            "Vi hæfter ikke for leveringen af selve overnatningsydelsen og ikke for udbyderes eller andre gæsters adfærd. Aftalepart for overnatningsydelsen er udbyderen.",
            "Vi hæfter ikke for rigtigheden af de oplysninger, udbydere indlægger, for så vidt vi ikke kendte dem og heller ikke burde have kendt dem. Får vi kendskab til en ulovlig oplysning, handler vi straks.",
            "Et videregående ansvar er udelukket. Ufravigelige lovbestemte krav, navnlig forbrugerrettigheder, berøres ikke.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Gældende ret og værneting",
          paragraphs: [
            "Dansk ret finder anvendelse — operatøren er etableret i Danmark — med undtagelse af FN's købelov. Ufravigelige forbrugerbeskyttelsesregler i den stat, hvor du har dit sædvanlige opholdssted, berøres ikke efter artikel 6 i forordning (EF) nr. 593/2008 (Rom I).",
            "Som forbruger kan du sagsøge os ved retten på dit bopælssted eller på vores hjemsted i Danmark; vi kan kun sagsøge dig ved retten på dit bopælssted (artikel 17 til 19 i forordning (EU) nr. 1215/2012).",
            "For indkvarteringsaftalen gælder som udgangspunkt retten i den stat, hvor indkvarteringen ligger; for sager om leje af fast ejendom har denne stats domstole enekompetence.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Sammensatte rejsearrangementer",
          paragraphs: [
            "myBestDays formidler udelukkende overnatningsydelser. Vi tilbyder hverken flyrejser, biludlejning, transportydelser, udflugter eller attraktioner og sammensætter ikke pakkerejser i henhold til direktiv (EU) 2015/2302.",
            "Skulle vi fremover formidle yderligere rejseydelser, oplyser vi dig før bookingen med den lovbestemte standardformular om, hvorvidt der opstår en pakkerejse eller et sammensat rejsearrangement, og hvilke rettigheder du har heraf.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Varighed, spærring og opsigelse",
          paragraphs: [
            "Aftalen om brug af platformen løber på ubestemt tid. Du kan til enhver tid slette din konto uden begrundelse; bestående bookinger berøres ikke heraf og afvikles efter den pågældende udbyders vilkår.",
            "Vi kan opsige brugsaftalen med 14 dages varsel. Ved en grov overtrædelse af disse vilkår kan vi opsige uden varsel og spærre kontoen.",
            "Efter ophør sletter vi dine data, medmindre en lovbestemt opbevaringspligt eller en berettiget interesse i opbevaring er til hinder herfor; nærmere fremgår af [Privatlivspolitik](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Ændringsklausul",
          paragraphs: [
            "Vi kan ændre disse vilkår, når der foreligger en saglig grund hertil — f.eks. ændret retstilstand, retspraksis fra de øverste domstole, nye eller bortfaldne funktioner på platformen eller udfyldning af huller i reguleringen.",
            "Ændringer varsler vi mindst 30 dage før ikrafttræden i tekstform. Gør du ikke indsigelse inden ikrafttrædelsen, anses de ændrede vilkår for accepteret; herpå gør vi særskilt opmærksom i varslet. Gør du indsigelse, kan vi opsige brugsaftalen med virkning fra ikrafttrædelsestidspunktet.",
            "For allerede indgåede bookinger gælder vilkårene i den version, der var gældende på bookingtidspunktet.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Indkvartering",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Dette afsnits omfang",
          paragraphs: [
            "Dette afsnit gælder for booking af indkvartering via platformen — ferieboliger såvel som værelser og enheder hos overnatningsvirksomheder.",
            "Det supplerer afsnit A. Ved modstrid har dette afsnit B forrang.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Aftaleforholdet",
          paragraphs: [
            "Indkvarteringsaftalen indgås udelukkende mellem dig og udbyderen. myBestDays er ikke aftalepart.",
            "Visningen af en indkvartering på platformen er en opfordring til dig om at afgive et bookingtilbud. Ved klik på den betalingspligtige bookingknap afgiver du et bindende tilbud.",
            "Aftalen indgås, når bookingen bekræftes. Bookingbekræftelsen sender vi til den e-mailadresse, du har angivet; den nævner udbyderen, den bookede ydelse, perioden, totalprisen og afbestillingsvilkårene.",
            "Ved indkvartering med forespørgselsbooking indgås aftalen først ved udbyderens accept. Indtil da kan dit betalingsmiddel forhåndsgodkendes, men ikke belastes.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Hvad vi gør",
          paragraphs: [
            "Vi stiller platformen til rådighed, viser udbydernes opslag, modtager din booking, videresender den til udbyderen og sender dig bookingbekræftelsen.",
            "Vi afvikler betalingen, for så vidt opslaget indeholder betaling via platformen, og stiller beskedfunktionen mellem dig og udbyderen til rådighed.",
            "Vi stiller ikke indkvarteringen til rådighed, driver den ikke og indestår ikke for dens beskaffenhed. Vi er ikke din rejsearrangør.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Hvad du skal gøre",
          paragraphs: [
            "Gennemgå opslaget fuldstændigt før bookingen: faciliteter, belægningsgrænse, ankomst- og afrejsetider, husregler, afbestillingsvilkår og de omkostninger, der først forfalder på stedet.",
            "Overhold den maksimale belægning, der er angivet i opslaget. Ankommer flere personer end booket, kan udbyderen nægte optagelse eller kræve et tillæg.",
            "Overhold udbyderens husorden og [Grundregler for gæster](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Du behandler indkvarteringen skånsomt og hæfter for skader, som du eller dine medrejsende forvolder.",
            "Har udbyderen eller en myndighed brug for oplysninger til registrering (f.eks. registreringsblanket, legitimationsoplysninger, turistskatteerklæring), stiller du dem til rådighed i god tid.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Priser og betaling",
          paragraphs: [
            "Totalprisen omfatter overnatningsprisen for den bookede periode og de tillæg og gebyrer, der er angivet i opslaget, og som afregnes via platformen.",
            "På stedet kan der forfalde yderligere beløb — navnlig turistskat eller lokale afgifter, et depositum samt tillægsydelser, du først booker på stedet. Disse oplyser vi før gennemførelsen af bookingen som omkostninger på stedet, for så vidt udbyderen har angivet dem.",
            "Indeholder opslaget et depositum, forfalder restbeløbet på det i opslaget nævnte tidspunkt. Udebliver restbetalingen, kan udbyderen efter sine afbestillingsvilkår træde tilbage fra aftalen.",
            "Betalinger til udbyderen uden om platformen modtager vi ikke og kan ikke spore; de er ikke omfattet af vores betalingsafvikling — se [Gebyrer uden om platformen](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Ændringer, afbestillinger og refusioner",
          paragraphs: [
            "Om og på hvilke betingelser en booking kan afbestilles eller ændres uden omkostninger, afhænger af udbyderens afbestillingsvilkår som angivet i opslaget. De vilkår, vi stiller til rådighed for udbydere, er beskrevet under [Afbestillingsvilkår](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Ved overnatningsydelser, der bookes for en bestemt periode, består der som udgangspunkt ingen lovbestemt fortrydelsesret efter artikel 16, litra l), i direktiv 2011/83/EU eller de tilsvarende nationale regler. Ufravigelige lovbestemte rettigheder berøres ikke.",
            "Afbestiller udbyderen, refunderer vi det via platformen betalte beløb fuldt ud. Desuden gælder [Ombookings- og refusionspolitik](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Forhindrer en begivenhed uden for begge parters kontrol rejsen eller opholdet, gælder [Politik for alvorlige forstyrrelser](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Refusioner sker til det betalingsmiddel, der er anvendt, medmindre andet er aftalt.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Hvad du desuden skal vide",
          paragraphs: [
            "Udbydere kan være private værter eller erhvervsdrivende. Om en udbyder optræder som erhvervsdrivende, oplyser vi i opslaget. Er der ikke tale om en erhvervsdrivende, gælder Unionens forbrugerbeskyttelsesregler ikke for indkvarteringsaftalen — herpå gør vi dig opmærksom i opslaget.",
            "Oplysninger om beliggenhed, omgivelser, afstande og tredjeparters vurderinger er til orientering. Bindende er oplysningerne om selve den bookede ydelse.",
            "I områder med registreringspligt for korttidsudlejning angiver vi det af udbyderen oplyste registreringsnummer i opslaget; se [Korttidsudlejning](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Ved flere identiske enheder af en bolig- eller værelsestype booker du en enhed af denne type. Hvilken konkret enhed du får, bestemmer udbyderen.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Ordliste",
      paragraphs: [
        "Følgende begreber har i disse vilkår den her nævnte betydning.",
      ],
      definitions: [
        {
          term: "Udbyder",
          description:
            "Den fysiske eller juridiske person, der udbyder indkvartering via platformen og bliver aftalepart i indkvarteringsaftalen.",
        },
        {
          term: "Forespørgselsbooking",
          description:
            "En booking, der først indgås efter udbyderens udtrykkelige accept, i modsætning til en straksbooking.",
        },
        {
          term: "Bookingbekræftelse",
          description:
            "Den besked, hvormed vi bekræfter indgåelsen af indkvarteringsaftalen; den indeholder udbyder, ydelse, periode, totalpris og afbestillingsvilkår.",
        },
        {
          term: "Enhed",
          description:
            "Det konkrete bookbare objekt under en bolig- eller værelsestype. Enheden sælges, typen beskrives og prissættes.",
        },
        {
          term: "Totalpris",
          description:
            "Det beløb, der vises ved gennemførelsen af bookingen, inklusive alle skatter og alle gebyrer, der afregnes via platformen.",
        },
        {
          term: "Maksimal belægning",
          description:
            "Det største tilladte antal personer, der må overnatte i indkvarteringen, som angivet i opslaget.",
        },
        {
          term: "Depositum",
          description:
            "Et beløb, udbyderen kræver som sikkerhed for skader, og som forhåndsgodkendes eller opkræves og frigives eller modregnes efter opholdet.",
        },
        {
          term: "Turistskat",
          description:
            "En lokal afgift på overnatninger, som alt efter kommune opkræves på stedet eller via udbyderen; den er ikke en ydelse fra myBestDays.",
        },
        {
          term: "Platformen",
          description:
            "Websitet, mobilapplikationerne og alle øvrige adgange, hvorigennem myBestDays viser indkvartering og formidler bookinger.",
        },
        {
          term: "Servicegebyr",
          description:
            "Vederlaget for myBestDays' formidlingsydelse. Hvem der bærer det, og hvordan det oplyses, fremgår af Servicegebyrer.",
        },
        {
          term: "Afbestillingsvilkår",
          description:
            "De af udbyderen valgte regler for, indtil hvornår og til hvilke omkostninger en booking kan afbestilles eller ændres.",
        },
        {
          term: "Indkvartering",
          description:
            "Den overnatningsydelse, udbyderen tilbyder — en feriebolig eller en enhed af en værelses- eller boligtype.",
        },
        {
          term: "Omkostninger på stedet",
          description:
            "Beløb, der ikke afregnes via platformen, men forfalder hos udbyderen, f.eks. turistskat, depositum eller tillægsydelser booket på stedet.",
        },
      ],
    },
  ],
};
