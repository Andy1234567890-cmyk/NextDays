// Schwedische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookiepolicy",
  metaDescription:
    "Vilka cookies myNextDays använder: uteslutande tekniskt nödvändiga och funktionella cookies, inga spårnings- eller reklamcookies.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Denna policy förklarar vilka cookies och jämförbara lagringstekniker ${ANBIETER.firma} använder på denna webbplats och i plattformen myNextDays.`,
    "Kort sagt: vi använder uteslutande tekniskt nödvändiga och funktionella cookies. Det finns inga analys-, reklam- eller spårningscookies och ingen vidarebefordran av användningsdata till reklamnätverk.",
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
        "Du behöver bara samtycka till en enda sak: spamskyddet i vårt kontaktformulär. Det kommer från Google (reCAPTCHA Enterprise), är alltså en extern tjänst, och laddas endast om du har tillåtit det. För detta frågar en rad längst ner på skärmen — vid första besöket, med likvärdiga knappar för ”Avvisa” och ”Acceptera” och utan förval. Så länge du inte har bestämt dig gäller ”ej tillåtet”.",
        "Ditt beslut lagras i din webbläsares minne (Local Storage, värdet ”nd_consent”); det innehåller endast kategorin, tidpunkten och ett versionsnummer, ingen identifiering av din person. Längst ner på denna sida kan du när som helst ändra eller återkalla det.",
      ],
    },
    {
      heading: "Denna webbplats",
      paragraphs: [
        "Marknadsföringswebbplatsen sätter inga cookies. Typsnitt och ikoner ligger på vår egen server — ingen tredje parts ikon- eller typsnittstjänst anropas för detta. Den enda externa tjänsten på denna sida är spamskyddet i kontaktformuläret, som endast laddas med ditt samtycke. Detaljer finns i [Integritetspolicyn](/datenschutz).",
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
            "Sparar ditt beslut om spamskyddet i kontaktformuläret, så att samtyckesraden inte frågar igen vid varje besök. Endast kategorin, tidpunkten och ett versionsnummer sparas. Värdet lämnar inte din enhet och överförs inte till vår server; det gäller för denna webbläsare. Om du raderar det frågar raden igen vid nästa besök.",
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
