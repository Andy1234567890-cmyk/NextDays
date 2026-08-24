// Schwedische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin
// (dort stehen auch die Belege für die technischen und organisatorischen
// Maßnahmen und die Liste der Unterauftragsverarbeiter) und werden von dort
// in alle Sprachfassungen übernommen.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Personuppgiftsbiträdesavtal",
  metaDescription:
    "Behandling av personuppgifter enligt artikel 28 i dataskyddsförordningen mellan myNextDays ApS och de verksamheter som använder plattformen: föremål, instruktioner, säkerhet, underbiträden.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Detta avtal (nedan ”biträdesavtalet”) gäller mellan den verksamhet som använder plattformen myNextDays (nedan ”den personuppgiftsansvarige”) och ${ANBIETER.firma} (nedan ”personuppgiftsbiträdet” eller ”vi”) och preciserar skyldigheterna enligt artikel 28 i förordning (EU) 2016/679 (dataskyddsförordningen).`,
    `Det införlivas genom de [allmänna villkoren](${AGB_URL}) och gäller under hela den tid plattformen används. Det har företräde framför de allmänna villkoren i den mån det rör behandling av personuppgifter för den personuppgiftsansvariges räkning.`,
    "Därutöver gäller [integritetspolicyn](/datenschutz) för de uppgifter som vi behandlar som egen personuppgiftsansvarig — särskilt uppgifterna om kontot och affärsrelationen.",
  ],
  sections: [
    {
      heading: "Föremål och rollfördelning",
      unterpunkte: [
        {
          paragraphs: [
            "Föremålet är behandlingen av personuppgifter som den personuppgiftsansvarige för in i plattformen eller samlar in via den, så att vi kan tillhandahålla de avtalade tjänsterna: förvaltning av boenden, reservationer och beläggning, kommunikation med gäster, betalningshantering, bokföring och ägaravräkning, anslutning till bokningsportaler, webbplatsbyggare samt uppgifts- och teamhantering.",
          ],
        },
        {
          paragraphs: [
            "Den personuppgiftsansvarige bestämmer ändamålen med och medlen för denna behandling. Vi behandlar uppgifterna uteslutande enligt dennes dokumenterade instruktioner och inte för egna ändamål.",
          ],
        },
        {
          paragraphs: [
            "För uppgifterna om kontot, faktureringen av våra egna tjänster, systemsäkerheten och den lagstadgade arkiveringen är vi själva personuppgiftsansvariga. Denna behandling omfattas inte av detta biträdesavtal.",
          ],
        },
      ],
    },
    {
      heading: "Behandlingens art, omfattning och ändamål",
      paragraphs: [
        "Behandlingen sker genom insamling, lagring, visning, ändring, överföring till mottagare som den personuppgiftsansvarige har valt (t.ex. bokningsportaler, betaltjänstleverantörer), begränsning och radering — i automatiserad form i plattformen.",
        "Behandlingsorten är Europeiska unionen; undantagen anges uttömmande i avsnitt 8.",
      ],
    },
    {
      heading: "Kategorier av registrerade",
      list: [
        "Gäster och bokare, inklusive medresenärer",
        "Intressenter som skickar förfrågningar eller meddelanden",
        "Ägare till de förvaltade boendena",
        "Den personuppgiftsansvariges medarbetare (team, städning, service, reception)",
        "Kontaktpersoner hos den personuppgiftsansvariges partner och leverantörer",
      ],
    },
    {
      heading: "Kategorier av personuppgifter",
      list: [
        "Grunduppgifter: namn, adress, födelsedatum om det registreras, nationalitet om den registreras för anmälningsplikten",
        "Kontaktuppgifter: e-postadress, telefonnummer",
        "Bokningsuppgifter: period, boende, antal resenärer, priser, tilläggstjänster, avbokningar",
        "Betalningsuppgifter: belopp, valuta, betalningssätt, betalningsstatus, referenser (fullständiga kortuppgifter når inte våra system)",
        "Kommunikationsuppgifter: meddelanden, anteckningar, omdömen",
        "Medarbetarnas åtkomst- och användningsuppgifter: roll, behörigheter, inloggningstidpunkt, enhet och IP-adress vid inloggningen",
        "Särskilda kategorier enligt artikel 9 i dataskyddsförordningen omfattas inte av uppdraget; den personuppgiftsansvarige för inte in sådana uppgifter i fritextfält.",
      ],
    },
    {
      heading: "Instruktioner",
      unterpunkte: [
        {
          paragraphs: [
            "Instruktioner lämnas av den personuppgiftsansvarige genom användningen och konfigurationen av plattformen samt i textform till vår kontaktadress. Muntliga instruktioner bekräftar vi i textform.",
          ],
        },
        {
          paragraphs: [
            "Anser vi att en instruktion är rättsstridig meddelar vi detta utan dröjsmål och får skjuta upp genomförandet till dess att den personuppgiftsansvarige bekräftar eller ändrar den.",
          ],
        },
        {
          paragraphs: [
            "Är vi rättsligt skyldiga att behandla uppgifterna (till exempel gentemot myndigheter) informerar vi den personuppgiftsansvarige i förväg, i den mån det är rättsligt tillåtet för oss.",
          ],
        },
        {
          titel: "Anslutning av den personuppgiftsansvariges egna tjänster",
          paragraphs: [
            "Den personuppgiftsansvarige kan ansluta sitt konto via ett gränssnitt till en tjänst som denne själv har valt och med vilken denne har ingått ett eget avtal — till exempel en AI-assistent. Lämnar denne en sådan anslutning är det dennes uttryckliga instruktion enligt artikel 28.3 led a i dataskyddsförordningen att lämna ut de frisläppta uppgifterna till denna tjänst. Den omfattar uttryckligen även en därmed förbunden överföring till tredjeland, om tjänsten har sitt säte utanför Europeiska unionen.",
            "Kort sagt: om en sådan anslutning beslutar den personuppgiftsansvarige ensam, och för den anslutna tjänsten ansvarar denne själv.",
            "Den kan bara lämnas av ett konto med behörighet att hantera externa anslutningar. Denna behörighet är förbehållen rollen ”Administratör”; konton med begränsade rättigheter — även rollen ”Medadministratör” — kan inte lämna någon anslutning. Vi registrerar vem som lämnade den, när och för vilken tjänst, vilka typer av uppgifter som frisläpptes och vilka hämtningar som har skett; denna registrering är tillgänglig för den personuppgiftsansvarige i gränssnittet under ”Konto → Anslutningar”, så att denne kan uppfylla sin ansvarsskyldighet och besvara begäranden om information.",
            "Den anslutna tjänsten är inte något underbiträde till oss: vi anlitar den inte, väljer den inte och instruerar den inte. Den behandlar uppgifterna på grundval av det avtal som den personuppgiftsansvarige själv har ingått med den. För denna behandling, för dess rättsliga grund och för garantierna vid överföring till tredjeland ansvarar därför den personuppgiftsansvarige; den omfattas inte av detta biträdesavtal.",
            "Fritextfält — bokningsanteckningar och innehållet i gästmeddelanden — är som standard undantagna från en sådan anslutning. De kan innehålla särskilda kategorier av personuppgifter enligt artikel 9 i dataskyddsförordningen, till exempel uppgifter om hälsa. Den personuppgiftsansvarige måste frisläppa dem särskilt när anslutningen lämnas; utan denna frisläppning överförs de inte.",
            "Den personuppgiftsansvarige kan när som helst koppla bort en lämnad anslutning i gränssnittet. Förnyelsetokenen raderas då, och vid varje ytterligare hämtning kontrolleras om samtycket fortfarande finns — en bortkopplad tjänst kan därför omedelbart inte läsa något mer, inte först när dess åtkomsttoken löper ut.",
          ],
        },
      ],
    },
    {
      heading: "Konfidentialitet",
      paragraphs: [
        "Alla personer som enligt uppdraget kan få åtkomst till uppgifterna är bundna av konfidentialitet och får regelbunden utbildning om dataskydd. Åtkomsten är begränsad till vad som är nödvändigt för respektive uppgift.",
        "Våra medarbetares åtkomst till kunduppgifter sker endast för felsökning, på begäran om support eller för att uppfylla lagstadgade skyldigheter.",
      ],
    },
    {
      heading: "Säkerhet i behandlingen",
      paragraphs: [
        "Vi vidtar de tekniska och organisatoriska åtgärder som krävs enligt artikel 32 i dataskyddsförordningen. Genomförda är särskilt:",
      ],
      list: [
        "Transportkryptering (TLS) för alla anslutningar, HTTP-säkerhetsheaders inklusive en strikt Content-Security-Policy",
        "Åtskillnad mellan verksamheter direkt i databasen: radbaserade åtkomstregler (Row Level Security) plus återkallade tabellrättigheter för känsliga uppgifter, så att åtkomst utanför den egna verksamheten är utesluten även via direkt databasväg",
        "Rollbaserade behörigheter med datauppdelning: service- och städpersonal får inga ekonomi- och försäljningsuppgifter, ägare endast sina egna boenden; gästuppgifter maskeras för roller som inte är behöriga",
        "Tvåfaktorsautentisering (TOTP) tillgänglig för konton; ny inloggning vid säkerhetskritiska ändringar",
        "Logg över inloggningar med enhet, tidpunkt och IP-adress, tillgänglig för den personuppgiftsansvarige",
        "Anslutningar till externa tjänster kan endast lämnas av ett konto med rollen ”Administratör”; varje hämtning via en sådan anslutning loggas (verktyg, tidpunkt, omfattning — utan innehållet självt) och är tillgänglig för den personuppgiftsansvarige. En bortkopplad anslutning förlorar åtkomsten omedelbart: vid varje hämtning kontrolleras om samtycket fortfarande finns",
        "Begränsning av antalet förfrågningar mot automatiserade angrepp, kontroll av signaturer i inkommande webhook-anrop",
        "Krypterade säkerhetskopior som lagras utanför produktionssystemet, med regelbundet återställningstest",
        "Åtskilda miljöer för utveckling och drift; ändringar i databasen uteslutande via versionerade migrationer",
      ],
    },
    {
      heading: "Underbiträden",
      paragraphs: [
        "Den personuppgiftsansvarige godkänner att följande underbiträden anlitas. Med var och en av dem finns avtal enligt artikel 28.4 i dataskyddsförordningen med skyldigheter som motsvarar detta biträdesavtal.",
      ],
      list: [
        "Hetzner Online GmbH, Tyskland (server, databas, media, e-postserver; datacenter Helsingfors, Finland)",
        "Stripe Payments Europe, Limited, Irland (betalningar, utbetalningar, lagstadgad identitetskontroll)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg (betalningar, om den personuppgiftsansvarige aktiverar dem)",
        "Channex.io Ltd, Storbritannien (anslutning till bokningsportaler, om aktiverad)",
        "Meta Platforms Ireland Limited, Irland (WhatsApp-meddelanden, om aktiverade)",
        "Google Ireland Limited, Irland (översättning av innehåll; inloggning med Google, om den används)",
        "Groq, Inc., USA (svarsförslag i inkorgen, om aktiverade)",
        "Cloudflare, Inc., USA (hantering av DNS-poster för egna domäner, om den används)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Ett byte eller ett tillägg meddelar vi minst 30 dagar i förväg. Den personuppgiftsansvarige kan inom denna frist invända av viktigt dataskyddsrelaterat skäl; undanröjs invändningen inte kan denne säga upp den berörda delen av tjänsten eller avtalet.",
          ],
        },
        {
          paragraphs: [
            "Tjänster som den personuppgiftsansvarige själv avtalar med en tredje part utgör inte underbiträdesbehandling utan en överföring som denne har föranlett. Detta gäller för en bokningsportal som denne har ett eget avtal med, liksom för en AI-assistent eller ett annat program som denne ansluter till sitt konto via gränssnittet (se avsnittet ”Instruktioner”).",
            "Avgörande är därvid inte genom vems system uppgifterna flödar, utan vem som anlitar tjänsten: underbiträdesbehandling uppstår när VI anlitar ytterligare en leverantör för att tillhandahålla vår tjänst. Väljer den personuppgiftsansvarige tjänsten själv och ingår avtalet med den, behandlar denna tjänst för den personuppgiftsansvariges räkning — inte för vår. Denna avgränsning motsvarar avtalspraxis hos jämförbara leverantörer för tredjepartstjänster som kunden själv ansluter.",
          ],
        },
      ],
    },
    {
      heading: "Överföring till tredjeland",
      paragraphs: [
        "Överföringar till mottagare utanför EU är begränsade till de tjänster som ovan anges med säte i USA respektive Storbritannien. Grunden är Europeiska kommissionens standardavtalsklausuler enligt artikel 46.2 c i dataskyddsförordningen eller ett gällande beslut om adekvat skyddsnivå; kompletterande skyddsåtgärder (kryptering, uppgiftsminimering) tillämpas.",
      ],
    },
    {
      heading: "Stöd till den personuppgiftsansvarige",
      unterpunkte: [
        {
          paragraphs: [
            "Vi stöder den personuppgiftsansvarige vid besvarandet av begäranden från registrerade (artikel 15 till 22 i dataskyddsförordningen). Plattformen erbjuder för detta information, rättelse, export och radering av uppgifterna direkt i gränssnittet. Vänder sig registrerade direkt till oss hänvisar vi dem till den personuppgiftsansvarige och informerar denne.",
          ],
        },
        {
          paragraphs: [
            "Vi stöder vidare vid konsekvensbedömningar avseende dataskydd, vid uppfyllandet av skyldigheterna enligt artikel 32 till 36 i dataskyddsförordningen och vid förfrågningar från tillsynsmyndigheter.",
          ],
        },
      ],
    },
    {
      heading: "Personuppgiftsincidenter",
      paragraphs: [
        "Får vi kännedom om en personuppgiftsincident som berör den personuppgiftsansvariges uppgifter informerar vi denne utan dröjsmål, senast inom 48 timmar efter kännedomen, i textform.",
        "Meddelandet innehåller, i den mån det är känt, incidentens art och tidpunkt, berörda uppgiftskategorier och persongrupper, sannolika följder samt de vidtagna och föreslagna åtgärderna. Vi stöder den personuppgiftsansvarige vid dennes anmälnings- och informationsskyldigheter enligt artikel 33 och 34 i dataskyddsförordningen.",
      ],
    },
    {
      heading: "Bevis och kontroller",
      unterpunkte: [
        {
          paragraphs: [
            "Vi visar på begäran att detta biträdesavtal följs, särskilt genom information om de vidtagna åtgärderna och om de underbiträden som anlitas.",
          ],
        },
        {
          paragraphs: [
            "Den personuppgiftsansvarige kan genomföra kontroller i nödvändig omfattning eller låta dem genomföras av en oberoende granskare som inte konkurrerar med oss. Kontroller sker efter förvarning med skälig frist, under normala kontorstider och utan att störa driften. Kostnaden för en granskning som går utöver informationen bärs av den personuppgiftsansvarige, om granskningen inte är föranledd av en incident som vi har orsakat.",
          ],
        },
      ],
    },
    {
      heading: "Radering och återlämnande",
      paragraphs: [
        "Efter avtalets slut tillhandahåller vi på begäran den personuppgiftsansvariges uppgifter för export inom 30 dagar i ett vanligt, maskinläsbart format. Därefter raderar vi uppgifterna inklusive kopiorna.",
        "Undantagna är uppgifter för vilka det finns en lagstadgad arkiveringsskyldighet (särskilt faktura- och bokföringsuppgifter); dessa blockeras och raderas när fristen har löpt ut. Säkerhetskopior skrivs över med den ordinarie rotationscykeln.",
      ],
    },
    {
      heading: "Ansvar och företrädesordning",
      paragraphs: [
        "Artikel 82 i dataskyddsförordningen gäller. I förhållandet mellan parterna gäller därutöver ansvarsreglerna i de allmänna villkoren, i den mån de inte strider mot dataskyddsförordningen.",
        "Strider de allmänna villkoren och detta biträdesavtal mot varandra vid behandling för den personuppgiftsansvariges räkning gäller detta biträdesavtal. Blir en bestämmelse ogiltig förblir det övriga innehållet gällande; parterna ersätter den med en tillåten reglering med samma syfte.",
      ],
    },
    {
      heading: "Ändringar av detta avtal",
      paragraphs: [
        "Vi får anpassa detta biträdesavtal i den mån det blir nödvändigt på grund av lagändringar, krav från tillsynsmyndigheter, föreskrifter från betaltjänstleverantörer eller teknisk utveckling och den personuppgiftsansvarige därigenom inte får en sämre ställning.",
        "Ändringar meddelar vi i textform minst 30 dagar innan de träder i kraft. Invänder den personuppgiftsansvarige inte inom denna frist anses de godkända; på denna följd upplyses i meddelandet. Vid invändning kan var part säga upp avtalet till den tidpunkt då ändringarna träder i kraft.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Förfrågningar om detta avtal, instruktioner och anmälningar riktar du till [${ANBIETER.email}](mailto:${ANBIETER.email}) eller till ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen.
export default avv;
