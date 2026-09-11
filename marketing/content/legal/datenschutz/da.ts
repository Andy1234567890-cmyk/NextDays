// Dänische Fassung der Datenschutzerklärung — reine Übersetzung von `de.ts`.
// Inhaltliche Änderungen gehören ZUERST in `de.ts` und werden von dort hierher
// nachgezogen; hier wird ausschließlich übersetzt, nie ergänzt.
// Struktur (Abschnitte, Reihenfolge, Anzahl der Absätze) ist mit `de.ts`
// deckungsgleich zu halten.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, DATENSCHUTZ_STAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Privatlivspolitik",
  metaDescription:
    "Hvordan myNextDays behandler personoplysninger: formål, retsgrundlag, modtagere, opbevaringsperioder og dine rettigheder efter databeskyttelsesforordningen.",
  standIso: DATENSCHUTZ_STAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Denne politik beskriver, hvordan ${ANBIETER.firma} behandler personoplysninger — når du besøger dette websted, når du bruger myNextDays-platformen (dashboard, markedsplads og mobilapp) og som led i forretningsforholdet med vores kunder.`,
    "Vi sælger ikke data og opretter ikke profiler, der identificerer dig som person. På denne hjemmeside måler vi – kun med dit samtykke – rækkevidden af vores sider og succesen af vores annoncering; begge kategorier kan fravælges individuelt (se afsnittene Rækkeviddemåling samt Annoncering og succesmåling). Vi behandler kun data til reklameformål, hvis De udtrykkeligt har givet samtykke hertil – nemlig til vores nyhedsbrev (se afsnittet Kommunikation), som De til enhver tid kan afmelde med et enkelt klik.",
  ],
  sections: [
    {
      heading: "Dataansvarlig",
      paragraphs: [
        "Dataansvarlig for de behandlinger, der er beskrevet i denne politik, er:",
      ],
      zeilen: [
        {
          label: "Virksomhed",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adresse",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Anvendelsesområde og roller",
      unterpunkte: [
        {
          paragraphs: [
            "For besøg på dette websted, for din kundekonto og for afviklingen af vores forretningsforhold er vi dataansvarlig som omhandlet i art. 4, nr. 7, i databeskyttelsesforordningen.",
          ],
        },
        {
          paragraphs: [
            "For de data, som vores kunder (udlejere, hoteller, bureauer) behandler i platformen om deres gæster, ejere og medarbejdere, er kunderne dataansvarlige, og vi er databehandler efter art. 28 i databeskyttelsesforordningen. Detaljerne fremgår af [databehandleraftalen](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Booker du som gæst et overnatningssted via vores markedsplads, behandler vi dine booking- og kontaktoplysninger både i eget navn (drift af markedspladsen, betalingsbehandling) og for den virksomhed, der er vært. Din overnatningsaftale indgås udelukkende med virksomheden; dennes oplysninger om databeskyttelse gælder derudover.",
          ],
        },
      ],
    },
    {
      heading: "Besøg på dette websted",
      unterpunkte: [
        {
          titel: "Serverlogfiler",
          paragraphs: [
            "Ved hvert opkald sender din browser teknisk nødvendige data, som vores webserver logger: IP-adresse, dato og klokkeslæt, den kaldte adresse, den overførte datamængde, statuskode, referrer og browseroplysninger. Formålet er at levere siden samt at opdage og afværge angreb og driftsforstyrrelser. Retsgrundlaget er art. 6, stk. 1, litra f, i databeskyttelsesforordningen; vores legitime interesse er en sikker og stabil drift. Logfilerne opbevares kun, så længe det er nødvendigt af drifts- og sikkerhedshensyn, og de sammenstilles ikke med andre data.",
          ],
        },
        {
          titel: "Skrifttyper",
          paragraphs: [
            "De anvendte skrifttyper er indlejret lokalt på vores server. Der oprettes ingen forbindelse til Google Fonts eller til nogen anden skrifttypetjeneste.",
          ],
        },
        {
          titel: "Ikoner",
          paragraphs: [
            "Ikonerne på dette websted ligger hos os på samme måde som skrifttyperne: De indsættes i siden på vores server og hentes ikke fra en ikontjeneste. Der oprettes i den forbindelse ingen forbindelse til en tredjepart, og din IP-adresse overføres ikke til nogen.",
          ],
        },
        {
          titel: "Spambeskyttelse af kontaktformularen (reCAPTCHA)",
          paragraphs: [
            "Vores kontaktformular er beskyttet mod automatiserede massehenvendelser med reCAPTCHA Enterprise fra Google Ireland Limited. Kun hvis du samtykker hertil, indlæser din browser et script fra www.google.com, når du udfylder formularen; i den forbindelse overføres din IP-adresse og oplysninger om din interaktion med formularen til Google og analyseres dér for at skelne mellem menneske og script. Retsgrundlaget er art. 6, stk. 1, litra a, i databeskyttelsesforordningen (samtykke); supplerende gælder [Googles privatlivspolitik](https://policies.google.com/privacy).",
            "Uden din tilladelse indlæses intet fra Google, og ingen data overføres dertil; vi accepterer ikke formularen, men du kan altid sende os en e-mail. Hvis du giver dit samtykke, sætter reCAPTCHA sin egen cookie (_GRECAPTCHA, varighed fastsat af Google, op til seks måneder), som bruges til risikovurdering. Du kan til enhver tid ændre eller tilbagekalde dit samtykke via cookie-ikonet nederst til venstre på hver side; cookien slettes derefter.",
          ],
        },
        {
          titel: "Rækkeviddemåling (Google Analytics)",
          paragraphs: [
            "På denne hjemmeside måler vi med Google Analytics 4 fra Google Ireland Limited, hvordan vores sider bruges – hvilke sider der besøges, hvor besøgende kommer fra, og hvor de forlader siden. Formålet er udelukkende at forbedre tilbuddet og synligheden.",
            "Indlæsning sker udelukkende med Deres samtykke. Hvis De giver samtykke, indlæser Deres browser et script fra www.googletagmanager.com og gemmer to cookies („_ga“ og „_ga_<ID>“, levetid op til to år) med et tilfældigt genereret ID; dette ID, de besøgte sider, henvisningskilde, omtrentlig placering på lande- eller regionsniveau, enhed og browser samt Deres IP-adresse, som Google forkorter før enhver lagring, overføres. Retsgrundlaget er art. 6, stk. 1, lit. a GDPR (samtykke).",
            "Vi har udtrykkeligt begrænset evalueringen: Google-signaler og reklamepersonalisering er deaktiveret. Der oprettes derfor ingen tværgående profiler og ingen målgrupper til reklame, og vi videregiver ingen brugsdata til annoncenetværk. En sammenføjning med Deres kundekonto finder ikke sted.",
            "Google behandler dataene som vores databehandler på grundlag af en kontrakt i henhold til art. 28 GDPR (Google Ads Data Processing Terms). Deres IP-adresse forkortes på servere i EU, før data overføres til USA; der overføres altså et pseudonymiseret datasæt. Grundlaget for overførslen er EU-Kommissionens tilstrækkelighedsbeslutning om EU-US Data Privacy Framework (art. 45 GDPR), under hvilket Google LLC er certificeret; derudover har Google inkluderet EU-Kommissionens standardkontraktklausuler (art. 46 GDPR). Vi gør udtrykkeligt opmærksom på, at amerikanske myndigheder i henhold til Section 702 FISA også kan få adgang til data fra certificerede virksomheder, og at en rest risiko derfor ikke kan udelukkes fuldstændigt. Googles [databeskyttelseserklæring](https://policies.google.com/privacy) gælder desuden.",
            "Lagringsvarighed: De hændelses- og brugerrelaterede data slettes automatisk i vores ejendom efter 14 måneder; aggregerede rapportdata uden relation til individuelle besøgende bevares derudover. Deres samtykke udløber efter seks måneder.",
            "Uden Deres samtykke indlæses intet, der sættes ingen cookie, og der overføres ingen data til Google. De kan til enhver tid tilbagekalde Deres samtykke via cookie-ikonet nederst til venstre på hver side; målingen stopper derefter øjeblikkeligt, og de nævnte cookies slettes. Efter seks måneder spørger vi igen.",
          ],
        },
        {
          titel: "Annoncering og resultatmåling",
          paragraphs: [
            "Med dit samtykke bruger vi marketing-cookies til at måle effekten af vores annoncering og vise dig relevante annoncer på andre platforme. Dette involverer Meta Platforms Ireland (Meta-pixel, cookie _fbp), LinkedIn Ireland (Insight-tag, cookies li_gc og bcookie) og Google Ireland Limited (Google Ads, cookie _gcl_au). Retsgrundlaget er artikel 6, stk. 1, litra a i GDPR. Uden dit samtykke indlæses ingen af disse scripts, og ingen cookies sættes; ved tilbagekaldelse sletter vi dem. Detaljer om hver cookie findes i [Cookiepolitikken](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Kundekonto og brug af platformen",
      paragraphs: [
        "Til registrering og drift af en konto behandler vi de oplysninger, som du eller din virksomhed indtaster: navn, firmanavn og selskabsform, adresse, e-mailadresse, telefonnummer, rolle og rettigheder, registeroplysninger (f.eks. handelsregister- eller momsnummer), bankoplysninger til udbetalinger samt det indhold, der oprettes i kontoen.",
        "For at sikre adgangen behandler vi desuden loginlogfiler (tidspunkt, IP-adresse, enhed og browser ved login) og — hvis det er aktiveret — oplysningerne til tofaktorgodkendelse.",
        "Log ind med Google: I stedet for e-mail og adgangskode kan du også logge ind med en Google-konto. Vælger du denne vej, modtager vi fra Google Ireland Limited udelukkende din e-mailadresse, dit navn, dit profilbillede og en identifikator for din Google-konto (områderne »openid«, »email«, »profile«) — udtrykkeligt ingen adgang til dine e-mails, kontakter, filer eller kalendere. Vi får ikke kendskab til din Google-adgangskode. Google behandler selve loginforløbet som selvstændig dataansvarlig; her gælder [Googles privatlivspolitik](https://policies.google.com/privacy). Retsgrundlaget er art. 6, stk. 1, litra b, i databeskyttelsesforordningen, da login tjener opfyldelsen af aftalen; valget af denne loginvej er frivilligt og kan til enhver tid erstattes af login med e-mail og adgangskode.",
        "Retsgrundlaget er art. 6, stk. 1, litra b, i databeskyttelsesforordningen (opfyldelse af brugsaftalen, se [forretningsbetingelserne](" +
          AGB_URL +
          ")), for sikringen af adgangen art. 6, stk. 1, litra f, i databeskyttelsesforordningen og for opbevaring efter skatte- og regnskabslovgivningen art. 6, stk. 1, litra c, i databeskyttelsesforordningen.",
      ],
    },
    {
      heading: "Bookinger, gæste- og ejendomsdata",
      paragraphs: [
        "Via platformen behandles reservationer, gæstedata, beskeder, opgaver og afregninger. Det omfatter navnlig gæstens navn og kontaktoplysninger, ankomst og afrejse, antallet af rejsende, priser og betalingsstatus, beskedforløb samt — hvis virksomheden registrerer dem — indberetningsdata og særlige ønsker.",
        "Denne behandling sker på den enkelte virksomheds vegne og efter dennes instruks. Vi bruger ikke disse data til egne formål, ikke til markedsføring og ikke til træning af AI-modeller.",
        "Inden for en virksomhed er dataene adskilt efter roller: rengørings- og servicemedarbejdere ser ingen økonomi- og salgsdata, ejere kun deres egne ejendomme. Mellem forskellige virksomheder er dataene teknisk adskilt (adgangsregler pr. virksomhed i databasen).",
      ],
    },
    {
      heading: "Betalingsbehandling",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Kortbetalinger og udbetalinger foregår via Stripe Payments Europe, Limited, Irland. I den forbindelse overføres de data, der er nødvendige for betalingen (beløb, valuta, betalingsmiddel, navn, e-mailadresse, bookingreference), samt for vores kunders konti de lovpligtige identifikationsoplysninger (indehaver, reelle ejere, legitimationsoplysninger, bankoplysninger) til Stripe. Fuldstændige kortoplysninger når ikke vores systemer. Retsgrundlagene er art. 6, stk. 1, litra b, i databeskyttelsesforordningen og, for identifikations- og hvidvaskforpligtelser, art. 6, stk. 1, litra c, i databeskyttelsesforordningen. Detaljerne fremgår af [Stripes privatlivspolitik](https://stripe.com/privacy).",
            "Betalingslinks til tillægsydelser: Fakturerer en virksomhed sin gæst en tillægsydelse (f.eks. rengøring eller vask) via et betalingslink, fører linket til en betalingsside, der drives af Stripe. Vi overfører hertil ydelsens betegnelse, beløbet, valutaen samt en intern reference til booking og virksomhed; virksomhedens firmalogo overføres til dennes Stripe-konto, så siden viser dennes mærke. På selve betalingssiden indsamler Stripe gæstens betalings- og enhedsoplysninger som selvstændig dataansvarlig. Tilbage til os kommer kun betalingsstatus, beløbet, de tilbageholdte beløb og betalingens identifikatorer — ingen kortoplysninger.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Tilbyder virksomheden PayPal som betalingsmåde, overføres betalingsdataene til PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxembourg. Her gælder [PayPals privatlivspolitik](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Distributionskanaler og portaler",
      paragraphs: [
        "Sælger en virksomhed sine ejendomme via portaler som Booking.com, Airbnb eller Expedia, udveksles tilgængelighed, priser, restriktioner og bookingdata med den pågældende portal via vores tilslutningsleverandør Channex.io Ltd, Det Forenede Kongerige. Fra den retning modtager vi portalens booking- og gæstedata.",
        "For den enkelte portal gælder dennes egne databeskyttelsesregler; i det omfang er portalen selvstændigt ansvarlig. Retsgrundlaget for overførslen er art. 6, stk. 1, litra b, i databeskyttelsesforordningen i forbindelse med virksomhedens opdrag.",
      ],
    },
    {
      heading: "Kommunikation",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "E-mails i forbindelse med brugen (bookingbekræftelser, systembeskeder, support, bekræftelses- og invitationslinks) sender og modtager vi via vores egen mailserver, som vi selv driver. Der er ingen ekstern udsendelsestjeneste involveret i disse beskeder.",
          ],
        },
        {
          titel: "Nyhedsbrev og forhåndstilmelding",
          paragraphs: [
            "På vores websted kan du tilmelde dig nyheder om myNextDays (forhåndstilmelding/nyhedsbrev). I den forbindelse behandles din e-mailadresse, sproget og det sted, hvor du har tilmeldt dig.",
            "Tilmeldingen sker efter dobbelt opt-in-princippet: Efter tilmeldingen modtager du en e-mail med et bekræftelseslink; først når du klikker på det, er tilmeldingen gyldig. Til dokumentation af samtykket gemmer vi tidspunktet for tilmeldingen og for bekræftelsen, den anvendte IP-adresse, browseroplysningerne samt den ordlyd, du har samtykket til. Disse oplysninger tjener udelukkende som dokumentation efter art. 7, stk. 1, i databeskyttelsesforordningen og analyseres ikke til markedsføring.",
            "Retsgrundlaget er dit samtykke efter art. 6, stk. 1, litra a, i databeskyttelsesforordningen; opbevaringen af dokumentationen støtter vi på art. 6, stk. 1, litra c, i forbindelse med art. 7, stk. 1, i databeskyttelsesforordningen. Du kan til enhver tid tilbagekalde samtykket med virkning for fremtiden — via afmeldingslinket i hver nyhedsbrevsmail eller uformelt pr. e-mail til os. Tilbagekaldelsen berører ikke lovligheden af den behandling, der er sket indtil da.",
            "Til administration og udsendelse af nyhedsbrevene bruger vi Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Frankrig; tysk filial: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) som databehandler. Der overføres din e-mailadresse og de nævnte supplerende oplysninger (sprog, kilde). Dataene behandles på servere inden for Den Europæiske Union (Frankrig og Tyskland); med Brevo er der indgået en databehandleraftale efter art. 28 i databeskyttelsesforordningen. Her gælder [Brevos privatlivspolitik](https://www.brevo.com/legal/privacypolicy/).",
            "Udsender vi et nyhedsbrev, måler Brevo på vores vegne, om beskeden er blevet åbnet, og om links i den er blevet klikket på. Denne måling hjælper os med at tilpasse indhold og hyppighed; den er en del af samtykket og ophører med din afmelding. Der sker ingen sammenstilling med andre datakilder og ingen profilering.",
            "Så længe bekræftelsen mangler, bliver din adresse ikke skrevet til og ikke overført til Brevo; en ubekræftet tilmelding bortfalder efter syv dage. Efter en afmelding spærrer vi adressen for udsendelse og opbevarer dokumentationen for samtykke og afmelding, så længe der kan gøres krav gældende på grundlag af den; på anmodning sletter vi den fuldstændigt.",
          ],
        },
        {
          titel: "Beskeder i platformen",
          paragraphs: [
            "Beskeder mellem gæst og virksomhed gemmes i platformen, så begge sider kan se forløbet. Blokerer en virksomhed en gæst, spærres beskedkanalen; eksisterende beskeder bevares af hensyn til sporbarheden.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Bruger en virksomhed WhatsApp-tilslutningen, overføres beskedernes indhold og de involveredes telefonnumre via WhatsApp Business Platform fra Meta Platforms Ireland Limited. Virksomheden beslutter selv, om denne funktion skal bruges; uden aktivering finder ingen overførsel sted.",
          ],
        },
      ],
    },
    {
      heading: "Automatiserede funktioner og kunstig intelligens",
      paragraphs: [
        "For de funktioner, der beskrives her, gælder ud over databeskyttelsesforordningen også forordning (EU) 2024/1689 (AI-forordningen, »AI Act«), hvis gennemsigtighedsforpligtelser efter art. 50 finder anvendelse siden den 2. august 2026.",
      ],
      unterpunkte: [
        {
          titel: "Svarforslag",
          paragraphs: [
            "Til svarforslag i beskedindbakken bruger vi — hvis funktionen er aktiveret for virksomheden — sprogmodeltilbuddet fra Groq, Inc., USA. I den forbindelse overføres den pågældende beskedkontekst til tjenesten. Forslag sendes ikke automatisk; det er altid et menneske, der beslutter, om de sendes. Der finder ingen automatiseret afgørelse med retsvirkning som omhandlet i art. 22 i databeskyttelsesforordningen sted.",
            "Der er således ikke tale om et AI-system, der interagerer direkte med fysiske personer i henhold til artikel 50, stk. 1, i AI-forordningen: Forpligtelsen forudsætter en DIREKTE interaktion, hvor AI'en selv kommunikerer med personen og ikke via en menneskelig mellemmand. Her foreslår funktionen en tekst til virksomheden, som en medarbejder gennemgår, kan ændre og selv sender – medarbejderen er denne mellemmand, gæsten korresponderer med virksomheden og ikke med en chatbot. En assistent, der automatisk svarer gæster, er ikke i brug; produktkonsulenten på denne hjemmeside (se nedenfor) vedrører udelukkende interesserede parter og ingen gæstekommunikation. Ifølge vores vurdering opfylder funktionen heller ikke nogen af betingelserne for højrisiko-AI i henhold til bilag III i AI-forordningen.",
            "Beskeder til gæster er desuden ikke en »tekst om spørgsmål af offentlig interesse« som omhandlet i art. 50, stk. 4, i AI-forordningen: De offentliggøres ikke, men sendes individuelt til en bestemt person, og de vedrører afviklingen af et ophold. Uafhængigt heraf gælder her den menneskelige gennemgang, som den afsendende medarbejder foretager.",
            "Skulle der fremover blive tilbudt en funktion, der selvstændigt — uden menneskelig godkendelse — svarer gæster, bliver gæsten ved dialogens begyndelse synligt gjort opmærksom på, at vedkommende skriver med et AI-system. Uden denne oplysning stilles en sådan funktion ikke til rådighed.",
          ],
        },
        {
          titel: "Produktkonsulent på denne hjemmeside",
          paragraphs: [
            "På denne hjemmeside besvarer en AI-drevet produktkonsulent spørgsmål om vores software. Den bruger udelukkende offentligt tilgængeligt indhold fra denne hjemmeside (hjælpeartikler, funktionsbeskrivelser, ofte stillede spørgsmål, juridiske tekster) samt aktuelle priser fra vores fakturering. Kundedata, bookinger eller gæstedata er ikke tilgængelige for den.",
            "I modsætning til de foreslåede svar i indbakken svarer denne konsulent ØJEBLIKKELIGT og uden menneskelig godkendelse. Den er således et AI-system i henhold til artikel 50, stk. 1, i AI-forordningen, der interagerer direkte med fysiske personer. Du vil derfor i starten af dialogen blive tydeligt informeret om, at svarene kommer fra en AI-assistent og kan indeholde fejl.",
            "Din forespørgsel og det valgte sprog behandles. Begge dele overføres til Google Cloud (Vertex AI) i regionen europe-west4 (Holland) for at blive besvaret; der sker ingen behandling uden for EU. Vi gemmer ikke spørgsmålene permanent og bruger dem ikke til træning af AI-modeller. Retsgrundlaget er vores berettigede interesse i hurtig information til interesserede parter (artikel 6, stk. 1, litra f, GDPR).",
            "Hvis konsulenten ikke kan besvare et spørgsmål ud fra det eksisterende indhold, tilbyder den at videresende det til vores support. Først da – og kun hvis du udfylder formularen – indsamler vi navn, e-mailadresse og eventuelt dit telefonnummer; disse oplysninger behandler vi i henhold til reglerne i afsnittet „Kommunikation“.",
          ],
        },
        {
          titel: "Roller efter AI-forordningen",
          paragraphs: [
            "For de AI-funktioner, der er indbygget i produktet, er vi idriftsætter som omhandlet i art. 3, nr. 4, i AI-forordningen; udbydere af de underliggende sprogmodeller er de pågældende modeludbydere. Bruger en virksomhed disse funktioner som led i sin erhvervsmæssige virksomhed, er den selv idriftsætter herfor og omfattet af pligten til AI-færdigheder efter art. 4 i AI-forordningen, som siden den 2. februar 2025 gælder uafhængigt af virksomhedens størrelse. Siden den 27. juli 2026 gælder den i den affattelse, der følger af forordning (EU) 2026/1744: udbydere og idriftsættere træffer foranstaltninger for at understøtte udviklingen af deres personales AI-færdigheder; et bestemt niveau skal udtrykkeligt ikke garanteres. Vi understøtter det med vejledninger i applikationen og i vores hjælpecenter; oplæringen af egne medarbejdere er fortsat virksomhedens opgave.",
            "Forbinder en virksomhed sin konto med en egen AI-assistent (se følgende punkt), er den også idriftsætter herfor som omhandlet i AI-forordningen — den beslutter om brugen og formulerer forespørgslerne. Selve grænsefladen er ikke et AI-system: den læser data fra databasen og udleverer dem uden at foretage slutninger; betragtning 12 til AI-forordningen afgrænser udtrykkeligt sådanne systemer fra AI.",
          ],
        },
        {
          titel: "Forbindelse til en egen AI-assistent",
          paragraphs: [
            "En virksomhed kan via en grænseflade forbinde sin konto med en AI-assistent, som den selv har valgt, og som den har sin egen aftale med — f.eks. Claude fra Anthropic PBC, USA. Er en sådan forbindelse givet, kan assistenten på virksomhedens forespørgsel læse: belægning, tilgængelighed og dagspriser; bookinger med gæstens navn, opholdsperiode, ejendom, bookingkanal og status samt beløb og valuta, i det omfang den forespørgende kontos rolle må se beløb; og oversigten over samtaler i indbakken. Uden en given forbindelse finder ingen overførsel sted.",
            "Der overføres ikke gæsternes e-mailadresse og telefonnummer, kortoplysninger, bankoplysninger og betalingsbilag, adgangskoder eller ejendomsdossierer. Bookingnoter og indholdet af gæstebeskeder er undtaget som standard, fordi de kan indeholde oplysninger om helbred eller andre særlige kategorier efter art. 9 i databeskyttelsesforordningen; virksomheden skal udtrykkeligt og særskilt frigive dem, når forbindelsen gives.",
            "Forbindelsen kan kun gives af en konto med rollen »administrator«, ikke af enhver konto med adgang. Hvert opkald logges og kan ses af virksomheden under »Konto → Forbindelser«; virksomheden kan til enhver tid afbryde forbindelsen dér, og adgangen ophører straks derefter.",
            "Retligt er denne overførsel en instruks fra virksomheden til os (art. 28, stk. 3, litra a, i databeskyttelsesforordningen). Udbyderen af assistenten er ikke underdatabehandler for os — vi giver denne intet opdrag og instruerer den ikke; den behandler dataene på grundlag af den aftale, som virksomheden selv har indgået med den. Virksomheden er derfor ansvarlig for retsgrundlaget for denne behandling, for informationen af sine gæster og for garantierne ved en overførsel til et tredjeland.",
          ],
        },
        {
          titel: "Oversættelser",
          paragraphs: [
            "Tekster om ejendomme og andet indhold kan oversættes via Cloud Translation API fra Google Ireland Limited. Der overføres de tekster, der skal oversættes; personoplysninger kun i det omfang, de indgår i disse tekster.",
          ],
        },
        {
          titel: "Prisanbefalinger",
          paragraphs: [
            "Til prisanbefalinger henter vi markeds-, vejr- og valutakursdata fra eksterne kilder. Disse forespørgsler indeholder ingen personoplysninger, men kun sted, periode og ejendommens egenskaber.",
          ],
        },
      ],
    },
    {
      heading: "Vores kunders websteder og domæner",
      paragraphs: [
        "Opretter en virksomhed via page builderen sit eget websted med eget domæne, administrerer vi de nødvendige DNS-poster via Cloudflare, Inc. I den forbindelse overføres domæne- og konfigurationsdata; besøgsdata fra kundens websted behandler vi, som det er beskrevet i denne politik.",
        "Den enkelte virksomhed er ansvarlig for indhold, juridiske oplysninger og oplysninger om databeskyttelse på kundens websted.",
      ],
    },
    {
      heading: "Partnerprogram",
      paragraphs: [
        "Vi driver et partnerprogram, hvor partnere (influencere, konsulenter, bureauer, kunder) anbefaler virksomheder til myNextDays og modtager en provision herfor. I den forbindelse behandler vi data om partnere og – i begrænset omfang – om anbefalede virksomheder.",
      ],
      unterpunkte: [
        {
          titel: "Partnerdata",
          paragraphs: [
            "Ved ansøgning behandler vi navn, firmanavn, retsform, land, e-mailadresse, sprog, sociale mediekonti (platform, adresse, handle, selvangivet rækkevidde), momsregistreringsnummer (kontrol via EU-systemet VIES), udbetalingsdata (IBAN, Wise- eller PayPal-adresse) samt samtykke til deltagelsesbetingelserne med version og tidspunkt. Retsgrundlaget er opfyldelse af partneraftalen (artikel 6, stk. 1, litra b, GDPR); for kreditnotaer og opbevaring gælder skatte- og handelsretlige forpligtelser (artikel 6, stk. 1, litra c, GDPR).",
            "Hvis en partner leder et team, ser vedkommende navn eller firmanavn, rang, antal betalende kunder og den deraf følgende teamprovision for sine team-partnere. Meddelelser mellem sponsor og team-partner gemmes på platformen, så begge kan se forløbet.",
          ],
        },
        {
          titel: "Klik på partnerlinks",
          paragraphs: [
            "Hvis en besøgende åbner et partnerlink (mynextdays.com/p/CODE), gemmer vi koden, tidspunktet, den besøgte side, den henvisende side og eventuelle kampagneparametre samt IP-adresse og browseridentifikation udelukkende som forkortede kontrolsummer (hash) – til misbrugsdetektion (ophobninger), ikke til genkendelse. Der sættes ingen tracking-cookie. Klikdata slettes efter 90 dage. Retsgrundlaget er vores berettigede interesse i en svindelsikker afregning af programmet (artikel 6, stk. 1, litra f, GDPR).",
          ],
        },
        {
          titel: "Forbundne sociale mediekonti og indlæg",
          paragraphs: [
            "Partnere kan frivilligt forbinde deres konti på YouTube (Google), Instagram og Facebook (Meta) samt TikTok med partner-dashboardet. Derved giver de den pågældende platform læseadgang (OAuth); vi skriver intet på disse konti. Vi gemmer kontoens identifikation og navn, adgangstoken krypteret, tidspunktet for forbindelsen samt dagligt en måleværdi pr. konto: antal følgere eller abonnenter, visninger de seneste 28 dage, interaktionsrate og antal indlæg, hver med tidspunktet for platformens svar. For indlæg, som partneren opretter i dashboardet (titel, platform, adresse, udgivelsesdato), gemmer vi desuden visninger, likes, kommentarer, delinger og gemte elementer fra platformen.",
            "Formålet er at kontrollere den rækkevidde, som partneren har angivet, og at tildele klik og kunder til individuelle indlæg; ubekræftede oplysninger vægtes lavere ved frigivelse. Henvisninger til uoverensstemmelser (f.eks. et følgerspring uden passende visninger) tjener udelukkende til manuel kontrol af os og fører ikke til en automatiseret beslutning. Retsgrundlaget er partnerens samtykke (artikel 6, stk. 1, litra a, i GDPR), som gives ved tilslutning og til enhver tid kan trækkes tilbage i dashboardet under \"Afbryd forbindelse\"; ved afbrydelse sletter vi adgangstokenet med det samme, gemte målinger forbliver som historik og slettes sammen med partnerkontoen. Vi bruger udelukkende platformenes officielle grænseflader; for behandling af Google, Meta og TikTok gælder deres egne databeskyttelsesmeddelelser.",
          ],
        },
        {
          titel: "Anbefalede virksomheder",
          paragraphs: [
            "Hvis en virksomhed registrerer sig med en partnerkode, gemmer vi virksomhedens tilknytning til partneren samt tidspunkt, metode (link eller kode) og status. Partneren ser udelukkende virksomheden pseudonymt (løbenummer, land, status, beløb) – aldrig navn, e-mailadresse eller bookingdata. Kun hvis virksomheden udtrykkeligt giver samtykke ved registreringen, må partneren kontakte den via platformen. Til provisionsafregning behandler vi nettobeløbene for de betalte fakturaer fra virksomheden; retsgrundlaget er opfyldelsen af partner- og brugsaftalen (artikel 6, stk. 1, litra b, i GDPR).",
          ],
        },
      ],
    },
    {
      heading: "Hosting og lagring",
      paragraphs: [
        "Platformen, databasen, medierne og mailserveren kører på servere hos Hetzner Online GmbH, Tyskland, i datacentret i Helsinki (Finland) — altså inden for Den Europæiske Union. Med Hetzner er der indgået en databehandleraftale.",
        "Sikkerhedskopier oprettes krypteret og opbevares krypteret hos en lagringsudbyder inden for EU.",
      ],
    },
    {
      heading: "Oversigt over modtagere",
      paragraphs: [
        "Ud over de nævnte leverandører videregiver vi kun personoplysninger, når vi er retligt forpligtet til det (f.eks. skattemyndigheder, retsforfølgning), eller når du eller den ansvarlige virksomhed anmoder om det.",
      ],
      list: [
        "Hetzner Online GmbH (Tyskland/Finland) — hosting, database, medier, mailserver",
        "Stripe Payments Europe, Limited (Irland) — betalinger, udbetalinger, identitetskontrol",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxembourg) — betalinger, hvis det er aktiveret",
        "Channex.io Ltd (Det Forenede Kongerige) — tilslutning til bookingportaler",
        "Meta Platforms Ireland Limited (Irland) — WhatsApp-beskeder, hvis det er aktiveret",
        "Sendinblue SAS / Brevo (Frankrig, Tyskland) — administration og udsendelse af nyhedsbreve, kun ved samtykke",
        "Google Ireland Limited (Irland) — oversættelser; spambeskyttelse af kontaktformularen (reCAPTCHA Enterprise), kun ved samtykke; log ind med Google, hvis det bruges; Rækkeviddeanalyse (Google Analytics 4), kun med samtykke",
        "Groq, Inc. (USA) — svarforslag, hvis det er aktiveret",
        "Cloudflare, Inc. (USA) — DNS-administration for kundedomæner",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "På denne liste står ikke tjenester, som en virksomhed selv aftaler med en tredjepart og forbinder med sin konto via grænsefladen — f.eks. en AI-assistent som Claude fra Anthropic PBC, USA. De er ikke leverandører, som vi har givet et opdrag, men modtagere efter den enkelte virksomheds instruks; uden dennes forbindelse flyder der ingen data dertil. Anthropic er efter den officielle deltagerliste fra det amerikanske handelsministerium ikke certificeret under EU-US Data Privacy Framework; en overførsel støttes derfor på standardbestemmelserne om databeskyttelse, som den enkelte virksomhed som dataansvarlig skal indestå for.",
          ],
        },
      ],
    },
    {
      heading: "Overførsel til tredjelande",
      paragraphs: [
        "Behandlingen finder principielt sted inden for EU. Ved de ovennævnte tjenester med hjemsted uden for EU kan der forekomme en overførsel til et tredjeland.",
        "For Groq, Inc. og Cloudflare, Inc. (USA) støtter vi overførslen på Europa-Kommissionens standardbestemmelser om databeskyttelse efter art. 46, stk. 2, litra c, i databeskyttelsesforordningen, i det omfang modtageren ikke kan påberåbe sig en afgørelse om tilstrækkeligheden af beskyttelsesniveauet (EU-US Data Privacy Framework).",
        "Aftalepart for betalingsbehandlingen er Stripe Payments Europe, Limited (Irland). I det omfang Stripe herved benytter Stripe, LLC (USA), er dette selskab certificeret under EU-US Data Privacy Framework; overførslen støttes i det omfang på Europa-Kommissionens afgørelse om tilstrækkeligheden af beskyttelsesniveauet efter art. 45 i databeskyttelsesforordningen. Supplerende gælder standardbestemmelserne om databeskyttelse fra [Stripes databehandleraftale](https://stripe.com/legal/dpa).",
        "For Channex.io Ltd (Det Forenede Kongerige) gælder Europa-Kommissionens afgørelse om tilstrækkeligheden af beskyttelsesniveauet for Det Forenede Kongerige; bortfalder den, gælder standardbestemmelserne om databeskyttelse.",
      ],
    },
    {
      heading: "Myndighedsadgang fra tredjelande (US CLOUD Act)",
      paragraphs: [
        "Leverandører, der er underlagt amerikansk jurisdiktion, kan efter den amerikanske CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) blive forpligtet til at udlevere data til amerikanske myndigheder — også når disse data ligger på servere inden for Den Europæiske Union. En sådan adgang kan være i strid med databeskyttelsesforordningen, og leverandøren kan være retligt afskåret fra at underrette os eller dig om den. Hverken afgørelsen om tilstrækkeligheden af beskyttelsesniveauet for EU-US Data Privacy Framework eller standardbestemmelserne om databeskyttelse udelukker denne risiko.",
        "Vi begrænser denne risiko ved, at de bærende systemer — platform, database, medier, mailserver og sikkerhedskopier — drives hos europæiske leverandører inden for EU, hvor amerikansk jurisdiktion ikke gælder.",
      ],
      unterpunkte: [
        {
          titel: "Berørte tjenester",
          paragraphs: [
            "Amerikansk jurisdiktion kan udelukkende komme i betragtning ved følgende, klart afgrænsede tillægstjenester:",
          ],
          list: [
            "Groq, Inc. (USA) — svarforslag i beskedindbakken, kun hvis virksomheden aktiverer funktionen. Der overføres den pågældende beskedkontekst.",
            "Cloudflare, Inc. (USA) — DNS-administration for kundedomæner. Der overføres domæne- og konfigurationsdata, ingen gæstedata.",
            "Google LLC (USA) — ved login med Google, ved oversættelser og ved rækkeviddeanalyse (Google Analytics 4, kun med samtykke); kontraktpartner er Google Ireland Limited, men adgang fra det amerikanske moderselskab kan ikke udelukkes.",
          ],
        },
        {
          titel: "Muligheden for at undgå dem",
          paragraphs: [
            "Platformen kan bruges uden disse tjenester: svarforslagene kan slås fra, DNS-administrationen vedrører kun kunder med eget domæne, og log ind med Google er et frivilligt alternativ til login med e-mail og adgangskode.",
          ],
        },
        {
          titel: "Afgrænsning over for EU-retten",
          paragraphs: [
            "CLOUD Act er amerikansk ret, ikke EU-ret. Den skal holdes ude fra EU Data Act (forordning (EU) 2023/2854), som regulerer skift og portabilitet ved databehandlingstjenester, samt fra Cloud and AI Development Act, der på tidspunktet for denne politik befinder sig i den europæiske lovgivningsproces.",
          ],
        },
      ],
    },
    {
      heading: "Opbevaringsperioder",
      list: [
        "Kontooplysninger: så længe forretningsforholdet består; derefter sletning, medmindre der gælder en opbevaringspligt.",
        "Booking-, faktura- og betalingsdata: efter bogføringsloven fem år efter udløbet af det regnskabsår, som de hører til; for kunder med hjemsted i Tyskland kan længere frister efter handels- og skattelovgivningen gælde.",
        "Beskeder og gæstedata i platformen: efter den ansvarlige virksomheds instruks, længst indtil denne sletter dem, eller indtil aftalens ophør.",
        "Nyhedsbrev: indtil samtykket tilbagekaldes; ubekræftede tilmeldinger bortfalder efter syv dage. Dokumentationen for samtykke og afmelding bevares derudover, så længe der er behov for den som dokumentation.",
        "Loginlogfiler og sikkerhedshændelser: kortvarigt til opdagelse af angreb.",
        "Serverlogfiler: kun så længe, det er nødvendigt af drifts- og sikkerhedshensyn.",
        "Sikkerhedskopier: rullende, indtil de erstattes af nyere sikkerhedskopier.",
      ],
    },
    {
      heading: "Dine rettigheder",
      paragraphs: [
        "Du har ret til indsigt (art. 15), berigtigelse (art. 16), sletning (art. 17), begrænsning af behandlingen (art. 18), dataportabilitet (art. 20) og indsigelse mod behandlinger, der sker på grundlag af legitime interesser (art. 21 i databeskyttelsesforordningen). Et givet samtykke kan du til enhver tid tilbagekalde med virkning for fremtiden.",
        `Henvend dig herom til [${ANBIETER.email}](mailto:${ANBIETER.email}). Vedrører dine data en virksomheds brug af platformen, videresender vi din anmodning til den ansvarlige virksomhed eller bistår denne med at besvare den.`,
        `Du kan desuden klage til en databeskyttelsestilsynsmyndighed — for os er den kompetente myndighed ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Du kan også henvende dig til tilsynsmyndigheden på dit bopælssted.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht —
      // gefordert ist der konkrete, benannte Weg.
      heading: "Sletning af konto og appdata",
      paragraphs: [
        "Du kan til enhver tid selv anmode om at få din konto slettet — i appen under »Profil → Konto« eller via vores formular på nettet:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Vejen på nettet virker bevidst også, hvis du ikke længere har appen installeret, eller hvis du ikke længere kan logge ind. For at beskytte mod misbrug sker det i to trin: Du indtaster e-mailadressen på din konto og modtager et bekræftelseslink på netop denne adresse. Først når du åbner det, er anmodningen gyldig — en indtastet adresse alene har ingen virkning. Vi behandler anmodningen inden for 30 dage og svarer pr. e-mail.",
        "Sammen med kontoen sletter vi dine loginoplysninger, din profil, dine ejendoms- og kalenderdata samt dine beskeder. Der slettes ikke dokumenter, som er omfattet af en lovbestemt opbevaringspligt — navnlig fakturaer og bookingbilag for afregnede perioder (bogføringspligt efter dansk ret, som regel fem år). Disse dokumenter spærres i fristens løbetid, dvs. de opbevares udelukkende for at opfylde denne pligt og slettes derefter.",
      ],
    },
    {
      heading: "Behandlingssikkerhed",
      paragraphs: [
        "Vi sikrer behandlingen med tekniske og organisatoriske foranstaltninger efter art. 32 i databeskyttelsesforordningen, navnlig: gennemgående transportkryptering (TLS), adgangsregler pr. virksomhed direkte i databasen, rollebaserede rettigheder med adskillelse af økonomi- og servicedata, valgfri tofaktorgodkendelse, begrænsning af loginforsøg, krypterede sikkerhedskopier med regelmæssig gendannelsestest samt logning af sikkerhedsrelevante hændelser.",
      ],
    },
    {
      heading: "Pligt til at afgive oplysninger",
      paragraphs: [
        "De oplysninger, som vi har brug for til aftaleindgåelse, afregning og lovbestemte pligter, er nødvendige — uden dem kan vi ikke stille platformen til rådighed. Alle øvrige oplysninger er frivillige.",
      ],
    },
    {
      heading: "Ændringer af denne politik",
      paragraphs: [
        "Vi tilpasser denne politik, når behandlingen, de anvendte leverandører eller retstilstanden ændrer sig. Den her offentliggjorte affattelse er den gældende; datoen ovenfor viser, hvornår den senest er opdateret.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
