// Schwedische Fassung der Datenschutzerklärung.
//
// Referenz ist content/legal/datenschutz/de.ts — INHALTLICHE Änderungen gehören
// ZUERST dorthin und werden von dort in alle Sprachfassungen nachgezogen. Diese
// Datei hat dieselbe Struktur wie de.ts (20 Abschnitte, gleiche Absatzzahlen);
// Firmen-, Register-, Dienstleister- und Rechtsakt-Bezeichnungen bleiben
// unübersetzt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Integritetspolicy",
  metaDescription:
    "Så behandlar myNextDays personuppgifter: ändamål, rättsliga grunder, mottagare, lagringstider och dina rättigheter enligt dataskyddsförordningen.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Denna policy beskriver hur ${ANBIETER.firma} behandlar personuppgifter — vid besök på den här webbplatsen, vid användning av plattformen myNextDays (kontrollpanel, marknadsplats och mobilapp) och inom ramen för affärsrelationen med våra kunder.`,
    "Grunden är förordning (EU) 2016/679 (dataskyddsförordningen) samt den danska dataskyddslagen (databeskyttelsesloven). Vi säljer inga uppgifter, skapar inga profiler och använder inga analys-, spårnings- eller annonstjänster på våra webbplatser. För marknadsföringsändamål behandlar vi uppgifter uteslutande där du uttryckligen har lämnat samtycke — nämligen för vårt nyhetsbrev (se avsnittet Kommunikation), som du när som helst kan avbeställa med ett klick.",
  ],
  sections: [
    {
      heading: "Personuppgiftsansvarig",
      paragraphs: [
        "Ansvarig för de behandlingar som beskrivs i denna policy är:",
      ],
      zeilen: [
        {
          label: "Företag",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adress",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-post",
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
      heading: "Tillämpningsområde och roller",
      unterpunkte: [
        {
          paragraphs: [
            "För besöket på den här webbplatsen, för ditt kundkonto och för genomförandet av vår affärsrelation är vi personuppgiftsansvariga i den mening som avses i artikel 4.7 i dataskyddsförordningen.",
          ],
        },
        {
          paragraphs: [
            "För de uppgifter som våra kunder (uthyrare, hotell, byråer) behandlar i plattformen om sina gäster, ägare och medarbetare är kunderna personuppgiftsansvariga och vi personuppgiftsbiträde enligt artikel 28 i dataskyddsförordningen. Detaljerna framgår av [biträdesavtalet](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Om du som gäst bokar ett boende via vår marknadsplats behandlar vi dina boknings- och kontaktuppgifter både i eget namn (drift av marknadsplatsen, betalningshantering) och för den mottagande verksamheten. Ditt boendeavtal ingås uteslutande med verksamheten; dess dataskyddsinformation gäller därutöver.",
          ],
        },
      ],
    },
    {
      heading: "Besök på den här webbplatsen",
      unterpunkte: [
        {
          titel: "Serverloggfiler",
          paragraphs: [
            "Vid varje anrop överför din webbläsare tekniskt nödvändiga uppgifter som vår webbserver loggar: IP-adress, datum och klockslag, anropad adress, överförd datamängd, statuskod, hänvisande sida och webbläsarkännetecken. Ändamålet är att tillhandahålla sidan samt att upptäcka och avvärja angrepp och störningar. Rättslig grund är artikel 6.1 f i dataskyddsförordningen; vårt berättigade intresse är en säker och stabil drift. Loggarna bevaras endast så länge det är nödvändigt för drift och säkerhet och sammanförs inte med andra uppgifter.",
          ],
        },
        {
          titel: "Typsnitt",
          paragraphs: [
            "De typsnitt som används är inbäddade lokalt på vår server. Ingen anslutning sker till Google Fonts eller någon annan typsnittstjänst.",
          ],
        },
        {
          titel: "Ikoner",
          paragraphs: [
            "Ikonerna på den här webbplatsen finns, liksom typsnitten, hos oss: de sätts in i sidan på vår server och hämtas inte i efterhand från någon ikontjänst. Ingen anslutning till tredje part sker, och din IP-adress överförs inte till någon.",
          ],
        },
        {
          titel: "Skräppostskydd för kontaktformuläret (reCAPTCHA)",
          paragraphs: [
            "Vårt kontaktformulär är skyddat mot automatiserade massmeddelanden med reCAPTCHA Enterprise från Google Ireland Limited. Endast om du samtycker läser din webbläsare in ett skript från www.google.com när du fyller i formuläret; därvid överförs din IP-adress och uppgifter om din interaktion med formuläret till Google och analyseras där för att skilja människa från skript. Rättslig grund är artikel 6.1 a i dataskyddsförordningen (samtycke); kompletterande gäller [Googles integritetspolicy](https://policies.google.com/privacy).",
            "Utan ditt samtycke läses ingenting in från Google och inga uppgifter flödar dit; formuläret tar vi då inte emot, men du kan alltid skriva ett e-postmeddelande till oss. Ditt samtycke kan du ändra eller återkalla i [cookiepolicyn](/cookie-richtlinie).",
          ],
        },
        {
          titel: "Ingen analys, ingen annonsering",
          paragraphs: [
            "Vi använder inga analys-, spårnings- eller annonstjänster (inget Google Analytics, inga pixlar, inga annonsnätverk) och skapar inga profiler. Vilka cookies plattformen behöver tekniskt framgår av [cookiepolicyn](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Kundkonto och användning av plattformen",
      paragraphs: [
        "För registrering och drift av ett konto behandlar vi de uppgifter som du eller din verksamhet anger: namn, firma och associationsform, adress, e-postadress, telefonnummer, roll och behörigheter, registeruppgifter (t.ex. handelsregister- eller momsregistreringsnummer), bankkonto för utbetalningar samt det innehåll som skapas i kontot.",
        "För att säkra åtkomsten behandlar vi dessutom inloggningsloggar (tidpunkt, IP-adress, enhet och webbläsare vid inloggningen) och — om det är aktiverat — uppgifterna för tvåfaktorsautentisering.",
        "Inloggning med Google: i stället för e-postadress och lösenord kan du även logga in med ett Google-konto. Väljer du den vägen får vi från Google Ireland Limited uteslutande din e-postadress, ditt namn, din profilbild och en identifierare för ditt Google-konto (omfången ”openid”, ”email”, ”profile”) — uttryckligen ingen åtkomst till dina e-postmeddelanden, kontakter, filer eller kalender. Ditt Google-lösenord får vi inte kännedom om. Google behandlar inloggningsförfarandet som självständigt personuppgiftsansvarig; [Googles integritetspolicy](https://policies.google.com/privacy) gäller. Rättslig grund är artikel 6.1 b i dataskyddsförordningen, eftersom inloggningen tjänar fullgörandet av avtalet; valet av denna inloggningsväg är frivilligt och kan när som helst ersättas med inloggning med e-postadress och lösenord.",
        "Rättslig grund är artikel 6.1 b i dataskyddsförordningen (fullgörande av användningsavtalet, se [allmänna villkor](" +
          AGB_URL +
          ")), för åtkomstsäkringen artikel 6.1 f i dataskyddsförordningen och för bevarande enligt skatte- och bokföringsrätt artikel 6.1 c i dataskyddsförordningen.",
      ],
    },
    {
      heading: "Bokningar, gäst- och boendeuppgifter",
      paragraphs: [
        "Via plattformen behandlas reservationer, gästuppgifter, meddelanden, uppgifter och avräkningar. Hit hör i synnerhet gästens namn och kontaktuppgifter, ankomst och avresa, antal resenärer, priser och betalningsstatus, meddelandehistorik samt — i den mån verksamheten registrerar dem — anmälningsuppgifter och särskilda önskemål.",
        "Denna behandling sker på uppdrag av och enligt instruktion från respektive verksamhet. Vi använder inte dessa uppgifter för egna ändamål, inte för marknadsföring och inte för träning av AI-modeller.",
        "Inom en verksamhet är uppgifterna åtskilda efter roll: städ- och servicepersonal ser inga ekonomi- och försäljningsuppgifter, ägare endast sina egna boenden. Mellan olika verksamheter är uppgifterna tekniskt åtskilda (åtkomstregler per hyresgäst direkt i databasen).",
      ],
    },
    {
      heading: "Betalningshantering",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Kortbetalningar och utbetalningar går via Stripe Payments Europe, Limited, Irland. Därvid överförs de uppgifter som är nödvändiga för betalningen (belopp, valuta, betalningsmedel, namn, e-postadress, bokningsreferens) samt, för våra kunders konton, de lagstadgade identifieringsuppgifterna (innehavare, verkliga huvudmän, identitetshandlingsuppgifter, bankkonto) till Stripe. Fullständiga kortuppgifter når inte våra system. Rättsliga grunder är artikel 6.1 b i dataskyddsförordningen och, för identifierings- och penningtvättsskyldigheter, artikel 6.1 c i dataskyddsförordningen. Detaljerna regleras i [Stripes integritetspolicy](https://stripe.com/privacy).",
            "Betalningslänkar för tilläggstjänster: om en verksamhet fakturerar sin gäst en tilläggstjänst (t.ex. städning eller tvätt) via en betalningslänk leder länken till en betalningssida som drivs av Stripe. Vi överför för detta till Stripe tjänstens benämning, beloppet, valutan samt en intern referens till bokning och verksamhet; verksamhetens logotyp överförs till dess Stripe-konto så att sidan visar dess varumärke. På själva betalningssidan samlar Stripe in gästens betalnings- och enhetsuppgifter under eget ansvar. Tillbaka till oss kommer endast betalningsstatus, belopp, innehållna belopp och betalningens identifierare — inga kortuppgifter.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "I den mån verksamheten erbjuder PayPal som betalningssätt överförs betalningsuppgifterna till PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg. [PayPals integritetspolicy](https://www.paypal.com/de/webapps/mpp/ua/privacy-full) gäller.",
          ],
        },
      ],
    },
    {
      heading: "Försäljningskanaler och portaler",
      paragraphs: [
        "Om en verksamhet säljer sina boenden via portaler som Booking.com, Airbnb eller Expedia utbyts tillgänglighet, priser, restriktioner och bokningsuppgifter med respektive portal via vår anslutningsleverantör Channex.io Ltd, Storbritannien. Från den riktningen får vi portalens boknings- och gästuppgifter.",
        "För respektive portal gäller dess egna dataskyddsbestämmelser; i den mån är portalen självständigt ansvarig. Rättslig grund för överföringen är artikel 6.1 b i dataskyddsförordningen i förening med verksamhetens uppdrag.",
      ],
    },
    {
      heading: "Kommunikation",
      unterpunkte: [
        {
          titel: "E-post",
          paragraphs: [
            "E-postmeddelanden inom ramen för användningen (bokningsbekräftelser, systemmeddelanden, support, bekräftelse- och inbjudningslänkar) skickar och tar vi emot via en egen e-postserver som vi driver själva. För dessa meddelanden är ingen extern utskickstjänst inkopplad.",
          ],
        },
        {
          titel: "Nyhetsbrev och föranmälan",
          paragraphs: [
            "På vår webbplats kan du anmäla dig för nyheter om myNextDays (föranmälan/nyhetsbrev). Därvid behandlas din e-postadress, språket och den plats där du anmälde dig.",
            "Anmälan sker enligt förfarandet med dubbel opt-in: efter anmälan får du ett e-postmeddelande med en bekräftelselänk; först med klicket på den blir anmälan verksam. Som bevis för samtycket lagrar vi tidpunkten för anmälan och bekräftelsen, den IP-adress som därvid användes, webbläsarkännetecknet samt den ordalydelse du samtyckte till. Dessa uppgifter tjänar uteslutande som bevis enligt artikel 7.1 i dataskyddsförordningen och analyseras inte för marknadsföring.",
            "Rättslig grund är ditt samtycke enligt artikel 6.1 a i dataskyddsförordningen; lagringen av beviset stöder vi på artikel 6.1 c i förening med artikel 7.1 i dataskyddsförordningen. Du kan när som helst återkalla samtycket med verkan för framtiden — via avanmälningslänken i varje nyhetsbrev eller formlöst via e-post till oss. Återkallelsen påverkar inte lagligheten av den behandling som skett fram till dess.",
            "För förvaltning och utskick av nyhetsbreven använder vi Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Frankrike; tysk filial: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) som personuppgiftsbiträde. Överförs gör din e-postadress och de nämnda tilläggsuppgifterna (språk, källa). Uppgifterna behandlas på servrar inom Europeiska unionen (Frankrike och Tyskland); med Brevo finns ett biträdesavtal enligt artikel 28 i dataskyddsförordningen. [Brevos integritetspolicy](https://www.brevo.com/legal/privacypolicy/) gäller.",
            "När vi skickar ett nyhetsbrev mäter Brevo på vårt uppdrag om meddelandet har öppnats och om länkar i det har klickats. Denna mätning hjälper oss att anpassa innehåll och frekvens; den är en del av samtycket och upphör med din avanmälan. Någon sammanföring med andra datakällor eller profilering sker inte.",
            "Så länge bekräftelsen uteblir kontaktas din adress inte och överförs inte till Brevo; en obekräftad anmälan förfaller efter sju dagar. Efter en avanmälan blockerar vi adressen för utskick och bevarar beviset för samtycke och avanmälan så länge anspråk kan göras gällande utifrån det; på begäran raderar vi det fullständigt.",
          ],
        },
        {
          titel: "Meddelanden i plattformen",
          paragraphs: [
            "Meddelanden mellan gäst och verksamhet lagras i plattformen så att båda sidor kan se historiken. Blockerar en verksamhet en gäst stängs meddelandekanalen; befintliga meddelanden bevaras för spårbarhetens skull.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Använder en verksamhet WhatsApp-anslutningen överförs meddelandeinnehållet och de deltagandes telefonnummer via WhatsApp Business Platform från Meta Platforms Ireland Limited. Verksamheten beslutar om användningen av denna funktion; utan aktivering sker ingen överföring.",
          ],
        },
      ],
    },
    {
      heading: "Automatiserade funktioner och AI",
      paragraphs: [
        "För de funktioner som beskrivs här gäller utöver dataskyddsförordningen även förordning (EU) 2024/1689 (AI-förordningen, ”AI Act”), vars transparenskrav enligt artikel 50 är tillämpliga sedan den 2 augusti 2026.",
      ],
      unterpunkte: [
        {
          titel: "Svarsförslag",
          paragraphs: [
            "För svarsförslag i meddelandeinkorgen använder vi — i den mån funktionen är aktiverad för verksamheten — språkmodellerbjudandet från Groq, Inc., USA. Därvid överförs det aktuella meddelandesammanhanget till tjänsten. Förslag skickas inte automatiskt; om utskicket beslutar alltid en människa. Något automatiserat beslutsfattande med rättslig verkan i den mening som avses i artikel 22 i dataskyddsförordningen sker inte.",
            "Det är därmed inte ett AI-system som i den mening som avses i artikel 50.1 i AI-förordningen interagerar direkt med fysiska personer: skyldigheten förutsätter en DIREKT interaktion där AI:n själv kommunicerar med personen och inte via en mänsklig mellanhand. Här föreslår funktionen verksamheten en text som en medarbetare kontrollerar, kan ändra och själv skickar — medarbetaren är denna mellanhand, gästen korresponderar med verksamheten och inte med en chattrobot. Någon automatiskt svarande assistent används inte. Enligt vår bedömning uppfyller funktionen inte heller något av fallen för AI med hög risk enligt bilaga III till AI-förordningen.",
            "Meddelanden till gäster är dessutom inte ”text om frågor av allmänt intresse” i den mening som avses i artikel 50.4 i AI-förordningen: de publiceras inte utan skickas individuellt till en bestämd person och rör genomförandet av en vistelse. Oberoende av detta gäller här den mänskliga kontrollen genom den medarbetare som skickar.",
            "Skulle det i framtiden erbjudas en funktion som självständigt — utan mänskligt godkännande — svarar gäster, informeras gästen synligt i början av dialogen om att han eller hon skriver med ett AI-system. Utan denna upplysning tillhandahålls ingen sådan funktion.",
          ],
        },
        {
          titel: "Roller enligt AI-förordningen",
          paragraphs: [
            "För de AI-funktioner som är inbyggda i produkten är vi tillämpare i den mening som avses i artikel 3.4 i AI-förordningen; leverantörer av de underliggande språkmodellerna är respektive modelleverantör. Använder en verksamhet dessa funktioner inom ramen för sin yrkesverksamhet är den i sin tur tillämpare och omfattas av skyldigheten om AI-kunnighet enligt artikel 4 i AI-förordningen, som gäller sedan den 2 februari 2025 oberoende av företagets storlek. Sedan den 27 juli 2026 gäller den i den lydelse som följer av förordning (EU) 2026/1744: leverantörer och tillämpare vidtar åtgärder för att stödja utvecklingen av sin personals AI-kunnighet; någon bestämd nivå behöver uttryckligen inte garanteras. Vi stöder genom upplysningar i applikationen och i vårt hjälpcenter; utbildningen av de egna medarbetarna förblir verksamhetens uppgift.",
            "Kopplar en verksamhet sitt konto till en egen AI-assistent (se följande punkt) är den även för detta tillämpare i den mening som avses i AI-förordningen — den beslutar om användningen och formulerar frågorna. Gränssnittet i sig är inget AI-system: det läser uppgifter ur databasen och lämnar ut dem utan att dra slutsatser; skäl 12 i AI-förordningen avgränsar uttryckligen sådana system från AI.",
          ],
        },
        {
          titel: "Koppling till en egen AI-assistent",
          paragraphs: [
            "En verksamhet kan koppla sitt konto via ett gränssnitt till en AI-assistent som den själv har valt och med vilken den har ett eget avtal — till exempel Claude från Anthropic PBC, USA. Är en sådan koppling beviljad kan assistenten på verksamhetens fråga läsa: belastning, tillgänglighet och dagspriser; bokningar med gästnamn, vistelseperiod, boende, bokningskanal, status samt belopp och valuta, i den mån det frågande kontots roll får se belopp; och översikten över konversationerna i inkorgen. Utan en beviljad koppling sker ingen överföring.",
            "Inte överförs gästernas e-postadress och telefonnummer, kortuppgifter, bankkonton och betalningsunderlag, tillträdeskoder samt boendedossierer. Bokningsanteckningar och innehållet i gästmeddelanden är undantagna som standard, eftersom de kan innehålla uppgifter om hälsa eller andra särskilda kategorier enligt artikel 9 i dataskyddsförordningen; verksamheten måste uttryckligen och separat frige dem när kopplingen beviljas.",
            "Kopplingen kan endast beviljas av ett konto med rollen ”administratör”, inte av varje konto med åtkomst. Varje anrop loggas och kan ses av verksamheten under ”Konto → Kopplingar”; den kan där när som helst bryta kopplingen, och åtkomsten upphör därmed omedelbart.",
            "Rättsligt är denna överföring en instruktion från verksamheten till oss (artikel 28.3 a i dataskyddsförordningen). Assistentens leverantör är inget underbiträde till oss — vi anlitar den inte och instruerar den inte; den behandlar uppgifterna på grundval av det avtal som verksamheten själv har ingått med den. För den rättsliga grunden för denna behandling, för informationen till sina gäster och för garantierna vid en överföring till ett tredjeland är därför verksamheten ansvarig.",
          ],
        },
        {
          titel: "Översättningar",
          paragraphs: [
            "Boende- och innehållstexter kan översättas via Cloud Translation API från Google Ireland Limited. Överförs gör de texter som ska översättas; personuppgifter endast i den mån de finns i dessa texter.",
          ],
        },
        {
          titel: "Prisrekommendationer",
          paragraphs: [
            "För prisrekommendationer använder vi marknads-, väder- och valutakursuppgifter från externa källor. Dessa förfrågningar innehåller inga personuppgifter, utan endast ort, period och boendets egenskaper.",
          ],
        },
      ],
    },
    {
      heading: "Våra kunders webbplatser och domäner",
      paragraphs: [
        "Skapar en verksamhet en egen webbplats med egen domän via webbplatsbyggaren förvaltar vi de DNS-poster som behövs via Cloudflare, Inc. Därvid överförs domän- och konfigurationsuppgifter; besöksuppgifter från kundens webbplats behandlar vi såsom beskrivs i denna policy.",
        "För innehåll, utgivningsuppgifter och dataskyddsinformation på kundens webbplats ansvarar respektive verksamhet.",
      ],
    },
    {
      heading: "Drift och lagring",
      paragraphs: [
        "Plattformen, databasen, medierna och e-postservern körs på servrar hos Hetzner Online GmbH, Tyskland, i datacentret Helsingfors (Finland) — alltså inom Europeiska unionen. Med Hetzner finns ett biträdesavtal.",
        "Säkerhetskopior skapas krypterade och bevaras krypterade hos en lagringsleverantör inom EU.",
      ],
    },
    {
      heading: "Mottagare i översikt",
      paragraphs: [
        "Utöver de nämnda leverantörerna lämnar vi ut personuppgifter endast när vi är rättsligt skyldiga till det (t.ex. skattemyndigheter, brottsbekämpning) eller när du respektive den ansvariga verksamheten begär det.",
      ],
      list: [
        "Hetzner Online GmbH (Tyskland/Finland) — drift, databas, medier, e-postserver",
        "Stripe Payments Europe, Limited (Irland) — betalningar, utbetalningar, identitetskontroll",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) — betalningar, om aktiverat",
        "Channex.io Ltd (Storbritannien) — anslutning till bokningsportaler",
        "Meta Platforms Ireland Limited (Irland) — WhatsApp-meddelanden, om aktiverat",
        "Sendinblue SAS / Brevo (Frankrike, Tyskland) — förvaltning och utskick av nyhetsbrev, endast vid samtycke",
        "Google Ireland Limited (Irland) — översättningar; skräppostskydd för kontaktformuläret (reCAPTCHA Enterprise), endast vid samtycke; inloggning med Google, om det används",
        "Groq, Inc. (USA) — svarsförslag, om aktiverat",
        "Cloudflare, Inc. (USA) — DNS-förvaltning för kunddomäner",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "I denna lista står inte tjänster som en verksamhet själv avtalar med en tredje part och kopplar till sitt konto via gränssnittet — till exempel en AI-assistent som Claude från Anthropic PBC, USA. De är inte leverantörer som vi anlitar, utan mottagare på instruktion av respektive verksamhet; utan dess koppling flödar inga uppgifter dit. Anthropic är enligt den officiella deltagarförteckningen från det amerikanska handelsdepartementet inte certifierat under EU-US Data Privacy Framework; en överföring stöder sig därför på standardavtalsklausulerna, för vilka respektive verksamhet som personuppgiftsansvarig ska svara.",
          ],
        },
      ],
    },
    {
      heading: "Överföring till tredjeland",
      paragraphs: [
        "Behandlingen sker i princip inom EU. Vid de ovan nämnda tjänsterna med säte utanför EU kan en överföring till ett tredjeland förekomma.",
        "För Groq, Inc. och Cloudflare, Inc. (USA) stöder vi överföringen på Europeiska kommissionens standardavtalsklausuler enligt artikel 46.2 c i dataskyddsförordningen, i den mån mottagaren inte kan åberopa ett beslut om adekvat skyddsnivå (EU-US Data Privacy Framework).",
        "Avtalspart för betalningshanteringen är Stripe Payments Europe, Limited (Irland). I den mån Stripe därvid anlitar Stripe, LLC (USA) är detta bolag certifierat under EU-US Data Privacy Framework; överföringen stöder sig i den mån på Europeiska kommissionens beslut om adekvat skyddsnivå enligt artikel 45 i dataskyddsförordningen. Kompletterande gäller standardavtalsklausulerna i [Stripes biträdesavtal](https://stripe.com/legal/dpa).",
        "För Channex.io Ltd (Storbritannien) gäller Europeiska kommissionens beslut om adekvat skyddsnivå för Storbritannien; upphör detta träder standardavtalsklausulerna in.",
      ],
    },
    {
      heading: "Myndighetsåtkomst från tredjeland (US CLOUD Act)",
      paragraphs: [
        "Leverantörer som omfattas av amerikansk jurisdiktion kan enligt den amerikanska CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) förpliktas att lämna ut uppgifter till amerikanska myndigheter — även då dessa uppgifter finns på servrar inom Europeiska unionen. En sådan åtkomst kan strida mot dataskyddsförordningen, och leverantören kan vara rättsligt förhindrad att informera oss eller dig om den. Varken beslutet om adekvat skyddsnivå avseende EU-US Data Privacy Framework eller standardavtalsklausulerna utesluter denna risk.",
        "Vi begränsar denna risk genom att de bärande systemen — plattform, databas, medier, e-postserver och säkerhetskopior — drivs hos europeiska leverantörer inom EU, där amerikansk jurisdiktion inte gäller.",
      ],
      unterpunkte: [
        {
          titel: "Berörda tjänster",
          paragraphs: [
            "Amerikansk jurisdiktion kan komma i fråga uteslutande vid följande tydligt avgränsade tilläggstjänster:",
          ],
          list: [
            "Groq, Inc. (USA) — svarsförslag i meddelandeinkorgen, endast om verksamheten aktiverar funktionen. Överförs gör det aktuella meddelandesammanhanget.",
            "Cloudflare, Inc. (USA) — DNS-förvaltning för kunddomäner. Överförs gör domän- och konfigurationsuppgifter, inga gästuppgifter.",
            "Google LLC (USA) — endast vid inloggning med Google och vid översättningar; avtalspart är i varje fall Google Ireland Limited, men åtkomst från det amerikanska moderbolaget är ändå inte utesluten.",
          ],
        },
        {
          titel: "Möjlighet att undvika",
          paragraphs: [
            "Användningen av plattformen är möjlig utan dessa tjänster: svarsförslagen kan stängas av, DNS-förvaltningen berör endast kunder med egen domän, och inloggning med Google är ett frivilligt alternativ till inloggning med e-postadress och lösenord.",
          ],
        },
        {
          titel: "Avgränsning mot europeisk rätt",
          paragraphs: [
            "CLOUD Act är amerikansk rätt, inte rätt inom Europeiska unionen. Den ska skiljas från EU Data Act (förordning (EU) 2023/2854), som reglerar byte och portabilitet vid databehandlingstjänster, samt från Cloud and AI Development Act, som vid tidpunkten för denna policy befinner sig i det europeiska lagstiftningsförfarandet.",
          ],
        },
      ],
    },
    {
      heading: "Lagringstid",
      list: [
        "Kontouppgifter: under affärsrelationens varaktighet; därefter radering, i den mån ingen bevarandeskyldighet föreligger.",
        "Boknings-, faktura- och betalningsuppgifter: enligt den danska bokföringslagen fem år efter slutet av det räkenskapsår som de ska hänföras till; för kunder med säte i Tyskland kan längre handels- och skatterättsliga frister gälla.",
        "Meddelanden och gästuppgifter i plattformen: enligt instruktion från den ansvariga verksamheten, längst till dess radering av denna respektive till avtalets slut.",
        "Nyhetsbrev: till dess samtycket återkallas; obekräftade anmälningar förfaller efter sju dagar. Beviset för samtycke och avanmälan bevaras därutöver så länge det behövs som bevis.",
        "Inloggningsloggar och säkerhetshändelser: kortvarigt för att upptäcka angrepp.",
        "Serverloggfiler: endast så länge det är nödvändigt för drift och säkerhet.",
        "Säkerhetskopior: rullande, till dess de ersätts av nyare säkerhetskopior.",
      ],
    },
    {
      heading: "Dina rättigheter",
      paragraphs: [
        "Du har rätt till tillgång (artikel 15), rättelse (artikel 16), radering (artikel 17), begränsning av behandlingen (artikel 18), dataportabilitet (artikel 20) och att invända mot behandlingar som grundas på berättigade intressen (artikel 21 i dataskyddsförordningen). Ett lämnat samtycke kan du när som helst återkalla med verkan för framtiden.",
        `Vänd dig för detta till [${ANBIETER.email}](mailto:${ANBIETER.email}). Rör dina uppgifter en verksamhets användning av plattformen vidarebefordrar vi din förfrågan till den ansvariga verksamheten eller stöder denna vid besvarandet.`,
        `Du kan dessutom lämna in ett klagomål till en dataskyddstillsynsmyndighet — behörig för oss är ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Du kan också vända dig till tillsynsmyndigheten på din hemvist.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Nicht mit „Ihre Rechte" zusammenlegen.
      heading: "Radera konto och appdata",
      paragraphs: [
        "Raderingen av ditt konto kan du när som helst begära själv — i appen under ”Profil → Konto” eller via vårt formulär på webben:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Vägen på webben fungerar medvetet även när du inte längre har appen installerad eller inte längre kan logga in. Som skydd mot missbruk sker det i två steg: du anger e-postadressen till ditt konto och får en bekräftelselänk till exakt denna adress. Först när den öppnas blir begäran giltig — en angiven adress i sig medför ingenting. Vi behandlar begäran inom 30 dagar och svarar via e-post.",
        "Med kontot raderar vi dina inloggningsuppgifter, din profil, dina boende- och kalenderuppgifter samt dina meddelanden. Inte raderas handlingar för vilka en lagstadgad bevarandeskyldighet föreligger — i synnerhet fakturor och bokningsunderlag för avräknade perioder (bokföringsskyldighet enligt dansk rätt, som regel fem år). Dessa handlingar blockeras under fristens längd, bevaras alltså uteslutande för att uppfylla denna skyldighet, och raderas därefter.",
      ],
    },
    {
      heading: "Säkerhet vid behandlingen",
      paragraphs: [
        "Vi säkrar behandlingen genom tekniska och organisatoriska åtgärder enligt artikel 32 i dataskyddsförordningen, i synnerhet: genomgående transportkryptering (TLS), åtkomstregler per hyresgäst direkt i databasen, rollbaserade behörigheter med åtskillnad av ekonomi- och serviceuppgifter, valfri tvåfaktorsautentisering, begränsning av inloggningsförsök, krypterade säkerhetskopior med regelbundet återställningstest samt loggning av säkerhetsrelevanta händelser.",
      ],
    },
    {
      heading: "Skyldighet att lämna uppgifter",
      paragraphs: [
        "De uppgifter som vi behöver för avtalsslut, avräkning och lagstadgade skyldigheter är nödvändiga — utan dem kan vi inte tillhandahålla plattformen. Alla övriga uppgifter är frivilliga.",
      ],
    },
    {
      heading: "Ändringar av denna policy",
      paragraphs: [
        "Vi anpassar denna policy när behandlingen, de anlitade leverantörerna eller rättsläget ändras. Den version som är publicerad här gäller i varje fall; datumet ovan visar när den senast uppdaterades.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte Export
// bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
