// Schwedische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookiepolicy",
  metaDescription:
    "Vilka cookies myNextDays använder: tekniskt nödvändiga cookies samt – endast med ditt samtycke – funktionella, analytiska och marknadsföringscookies. Varje kategori kan aktiveras och avaktiveras individuellt.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Denna policy förklarar vilka cookies och jämförbara lagringstekniker ${ANBIETER.firma} använder på denna webbplats och i plattformen myNextDays.`,
    "Kort sagt: Endast de cookies som är nödvändiga för att webbplatsen ska fungera som begärt är obligatoriska. Allt annat kräver ditt samtycke och laddas inte utan det – skräppostskyddet för vårt kontaktformulär, räckviddsmätningen och marknadsföringscookies som vi använder för att mäta framgången för vår reklam. Du kan tillåta eller neka var och en av dessa kategorier individuellt och återkalla ditt beslut när som helst.",
  ],
  sections: [
    {
      heading: "Vad cookies är",
      paragraphs: [
        "Cookies är små textfiler som en webbplats sparar i webbläsaren. De gör det möjligt att känna igen en session — till exempel så att du förblir inloggad efter att ha loggat in. Utöver cookies använder webbläsare andra lagringsformer som Local Storage, som fungerar tekniskt på liknande sätt.",
      ],
    },
    {
      heading: "Vad vi behöver ditt samtycke för",
      paragraphs: [
        "Samtycke krävs enligt artikel 9 i den danska cookieförordningen (Cookie-bekendtgørelsen) (som genomför artikel 5.3 i direktiv 2002/58/EG) endast när åtkomst till din enhet inte uteslutande syftar till att överföra ett meddelande eller inte är absolut nödvändig för en tjänst som du uttryckligen har begärt.",
        "Alla cookies som vi sätter är nödvändiga för inloggning, sessionens säkerhet eller en inställning som du själv har gjort — därför frågar vi inte efter något för dem, och sätter omvänt heller inget som skulle kräva samtycke.",
        'Du måste samtycka till tre kategorier, som alla inte laddas utan ditt tillstånd: skräppostskyddet för vårt kontaktformulär (reCAPTCHA från Google), räckviddsmätningen av denna webbplats (Google Analytics 4) och marknadsföringscookies (Meta, LinkedIn, Google Ads). Ett fönster med en kategorilista visas för detta – vid första besöket, utan förval, varje kategori med en egen omkopplare. Så länge du inte har bestämt dig gäller "inte tillåtet", och varken utvärdering eller reklam sker.',
        "Ditt beslut lagras i din webbläsares minne (Local Storage, värdet ”nd_consent”); det innehåller endast kategorin, tidpunkten och ett versionsnummer, ingen identifiering av din person. Via cookie-ikonen längst ner till vänster på varje sida kan du när som helst ändra eller återkalla det. Efter sex månader frågar vi igen — ett samtycke ska inte gälla obegränsat.",
      ],
    },
    {
      heading: "Denna webbplats",
      paragraphs: [
        'Denna webbplats använder inga cookies av sig själv. Typsnitt och symboler finns på vår egen server – ingen symbol- eller typsnittstjänst från tredje part används för detta. Endast de tjänster du tillåter läggs till: skräppostskyddet för kontaktformuläret, räckviddsmätningen och marknadsföringstjänsterna. Vilka cookies som används, med vilken varaktighet och på vilken värd, anges nedan i avsnittet "Tredjepartscookies". Återkallelse via cookie-ikonen längst ner till vänster – respektive tjänst avslutas omedelbart och dess cookies raderas. Detaljer finns i [Dataskyddspolicyn](/datenschutz).',
      ],
    },
    {
      heading: "Plattformens cookies",
      paragraphs: [
        "Så snart du loggar in i instrumentpanelen, på marknadsplatsen eller i mobilvyn sätts följande cookies:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Inloggning (tekniskt nödvändig)",
          list: [
            "Syfte: identifierar din inloggade session gentemot servern.",
            "Innehåll: kortlivad åtkomsttoken; endast läsbar för servern (HttpOnly), överförs endast via HTTPS.",
            "Varaktighet: session respektive tills token löper ut.",
          ],
        },
        {
          titel: "nd_refresh — Sessionsförlängning (tekniskt nödvändig)",
          list: [
            "Syfte: förnyar åtkomsttoken så att du inte ständigt behöver logga in på nytt.",
            "Innehåll: förnyelsetoken; HttpOnly, endast via HTTPS.",
            "Varaktighet: fram till utloggning eller till dess den löper ut.",
          ],
        },
        {
          titel: "nd_locale — Språkval (funktionell)",
          list: [
            "Syfte: kommer ihåg det språk du har valt.",
            "Innehåll: språkkod, t.ex. ”de” eller ”en”.",
            "Varaktighet: fram till ändring eller radering.",
          ],
        },
        {
          titel: "sidebar_state — Sidopanel (funktionell)",
          list: [
            "Syfte: kommer ihåg om navigeringsfältet är utfällt eller infällt.",
            "Innehåll: ”true” eller ”false”.",
            "Varaktighet: fram till ändring eller radering.",
          ],
        },
        {
          titel:
            "sb-… — Inloggning med Google (tekniskt nödvändig, endast vid användning)",
          list: [
            "Syfte: håller sessionen vid liv när du loggar in via Google.",
            "Innehåll: sessionstoken från inloggningstjänsten.",
            "Varaktighet: session respektive tills token löper ut. Sätts endast om du väljer Google-inloggning.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Registrerar ditt beslut om de tjänster som kräver samtycke (spam-skydd för kontaktformuläret och räckviddsmätning).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Sätts endast om du själv öppnar chatten på denna webbplats och skickar ett meddelande. Det är nyckeln till ditt eget samtal — utan det skulle du inte hitta vårt svar igen efter ett sidbyte. Det innehåller inga uppgifter om dig och används endast för detta ändamål.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Sparar i webbläsaren om du har samtyckt till användningen av röstinmatning, så att samtycket inte efterfrågas igen vid varje besök. Värdet lämnar inte din enhet.",
          ],
        },
      ],
    },
    {
      heading: "Cookies i mobilappen",
      paragraphs: [
        "Mobilappen använder inte cookies. Åtkomst- och förnyelsetoken lagras i enhetens säkra nyckellager (iOS Keychain, Android Keystore) och raderas vid utloggning.",
      ],
    },
    {
      heading: "Cookies från tredje part",
      paragraphs: [
        "Om du genomför en betalning kan betaltjänstleverantören (Stripe eller PayPal) på sin egen sida sätta cookies som krävs för hantering och bedrägeriskydd. För dessa gäller respektive leverantörs bestämmelser.",
        "På webbplatser som verksamheter skapar med vår webbplatsbyggare beslutar respektive verksamhet om ytterligare cookies och ansvarar för informationen där.",
        "Endast med ditt samtycke använder Googles tjänster på denna webbplats följande cookies – två för räckviddsmätning, en för spam-skydd. Utan ditt samtycke laddas inte respektive skript och ingen av dessa cookies ställs in; vid återkallande raderar vi dem.",
      ],
      unterpunkte: [
        {
          titel: "_fbp – Mätning av annonsresultat (samtycke krävs)",
          list: [
            "Syfte: Kopplar ditt besök till en annons så att vi kan mäta hur framgångsrika våra kampanjer är.",
            "Innehåll: Ett slumpmässigt genererat ID; inga namn-, e-post- eller kontouppgifter från oss.",
            "Leverantör: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irland.",
            "Värd: mynextdays.com (förstapartscookie, inställd av Metas skript). Varaktighet: cirka tre månader.",
          ],
        },
        {
          titel: "_gcl_au – Mätning av Google Ads-resultat (samtycke krävs)",
          list: [
            "Syfte: Kopplar ditt besök till en Google-annons så att vi kan mäta hur framgångsrika våra kampanjer är.",
            "Innehåll: Ett slumpmässigt genererat ID utan koppling till din person.",
            "Leverantör: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Värd: mynextdays.com (förstapartscookie). Varaktighet: cirka tre månader.",
          ],
        },
        {
          titel: "li_gc och bcookie – LinkedIn-annonsering (samtycke krävs)",
          list: [
            "Syfte: Identifierar din webbläsare för LinkedIn så att annonser och deras framgång kan kopplas; li_gc lagrar även ditt samtycke där.",
            "Innehåll: Ett webbläsar-ID samt samtyckesstatus; inga uppgifter från ditt konto hos oss.",
            "Leverantör: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irland.",
            "Värd: linkedin.com (tredjepartscookies). Varaktighet: cirka sex månader respektive ett år.",
          ],
        },
        {
          titel: "_GRECAPTCHA — Spamskydd för kontaktformulär (samtycke krävs)",
          list: [
            "Värd: www.google.com (tredjepartscookie).",
            "Syfte: Tillåter Google att utföra riskbedömningar för att skilja automatiserade massutskick från verkliga förfrågningar.",
            "Innehåll: En identifierare som genereras av Google för denna bedömning; inga namn-, e-post- eller kontouppgifter från oss.",
            "Leverantör: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Varaktighet: Bestäms av Google, upp till sex månader. Det ställs in först när du har godkänt spamskyddet och öppnat kontaktformuläret.",
          ],
        },
        {
          titel: "_ga — Räckviddsmätning (samtycke krävs)",
          list: [
            "Värd: mynextdays.com (förstapartscookie, inställd av Googles skript).",
            "Syfte: skiljer besökare åt så att återkommande besök inte räknas dubbelt.",
            "Innehåll: slumpmässigt genererat ID utan koppling till din person; inga namn-, e-post- eller kontouppgifter.",
            "Leverantör: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Varaktighet: upp till två år.",
          ],
        },
        {
          titel: "_ga_<ID> — Mätningens sessionsstatus (samtycke krävs)",
          list: [
            "Värd: mynextdays.com (förstapartscookie, inställd av Googles skript).",
            "Syfte: registrerar när ditt nuvarande besök började, så att sidvisningar inom en session hör ihop.",
            "Innehåll: tidsstämpel och sessionsräknare; ID:t i namnet avser vår egendom, inte dig.",
            "Leverantör: Google Ireland Limited.",
            "Varaktighet: upp till två år.",
          ],
        },
      ],
    },
    {
      heading: "Radera och styra cookies",
      paragraphs: [
        "Du kan när som helst radera eller blockera cookies i din webbläsares inställningar. Om du blockerar de nödvändiga cookies är det tekniskt sett inte möjligt att logga in på plattformen — den offentliga webbplatsen och marknadsplatsen förblir användbara utan inloggning.",
        "Vid utloggning tar vi själva bort inloggningscookies.",
      ],
    },
    {
      heading: "Ändringar av denna policy",
      paragraphs: [
        "Om funktioner tillkommer som kräver ytterligare cookies uppdaterar vi denna lista. Det är alltid den här publicerade versionen som gäller; datumet ovan visar aktualiseringsdatumet.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
