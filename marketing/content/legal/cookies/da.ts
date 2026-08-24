// Dänische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookiepolitik",
  metaDescription:
    "Hvilke cookies myNextDays sætter: udelukkende teknisk nødvendige og funktionelle cookies, ingen sporings- eller reklamecookies.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Denne politik forklarer, hvilke cookies og lignende lagringsteknikker ${ANBIETER.firma} anvender på denne hjemmeside og i platformen myNextDays.`,
    "Kort fortalt: Vi anvender udelukkende teknisk nødvendige og funktionelle cookies. Der er ingen analyse-, reklame- eller sporingscookies og ingen videregivelse af brugsdata til reklamenetværk.",
  ],
  sections: [
    {
      heading: "Hvad cookies er",
      paragraphs: [
        "Cookies er små tekstfiler, som en hjemmeside gemmer i browseren. De gør det muligt at genkende en session — for eksempel så du forbliver logget ind, efter du har logget på. Ud over cookies bruger browsere andre lagre som Local Storage, der teknisk fungerer på lignende måde.",
      ],
    },
    {
      heading: "Hvornår vi har brug for dit samtykke",
      paragraphs: [
        "Samtykke er efter § 9 i bekendtgørelse om cookies (gennemfører artikel 5, stk. 3, i direktiv 2002/58/EF) kun nødvendigt, hvis adgangen til din enhed ikke udelukkende tjener til at overføre en meddelelse eller ikke er strengt nødvendig for en tjeneste, du udtrykkeligt har anmodet om.",
        "Alle cookies, vi sætter, er nødvendige for login, sikkerheden af sessionen eller en indstilling, du selv har foretaget — det behøver vi ikke spørge om, og omvendt sætter vi heller ikke noget, der ville kræve samtykke.",
        "Du skal kun give samtykke til én ting: spambeskyttelsen i vores kontaktformular. Den kommer fra Google (reCAPTCHA Enterprise), er altså en ekstern tjeneste, og indlæses udelukkende, hvis du har tilladt den. Det spørger en bjælke nederst på skærmen om — ved første besøg, med ligestillede knapper til afvis og accepter og uden forudvalg. Så længe du ikke har truffet en beslutning, gælder »ikke tilladt«.",
        "Din beslutning ligger i din browsers lager (Local Storage, værdien »nd_consent«); den indeholder kun kategorien, tidspunktet og et versionsnummer, ingen identifikation af din person. Nederst på denne side kan du til enhver tid ændre eller tilbagekalde den.",
      ],
    },
    {
      heading: "Denne hjemmeside",
      paragraphs: [
        "Marketing-hjemmesiden sætter ingen cookies. Skrifttyper og ikoner ligger på vores egen server — der kaldes ikke en tredjeparts ikon- eller skrifttypetjeneste til det. Den eneste eksterne tjeneste på denne side er spambeskyttelsen i kontaktformularen, og den indlæses kun med dit samtykke. Detaljer findes i [Privatlivspolitikken](/datenschutz).",
      ],
    },
    {
      heading: "Platformens cookies",
      paragraphs: [
        "Så snart du logger ind i dashboardet, på markedspladsen eller i den mobile visning, sættes følgende cookies:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Login (teknisk nødvendig)",
          list: [
            "Formål: identificerer din loggede session over for serveren.",
            "Indhold: kortlivet adgangstoken; kun læsbart for serveren (HttpOnly), overføres kun via HTTPS.",
            "Varighed: sessionen hhv. tokenets udløb.",
          ],
        },
        {
          titel: "nd_refresh — Sessionsforlængelse (teknisk nødvendig)",
          list: [
            "Formål: fornyer adgangstokenet, så du ikke konstant skal logge ind igen.",
            "Indhold: fornyelsestoken; HttpOnly, kun via HTTPS.",
            "Varighed: indtil log ud eller udløb.",
          ],
        },
        {
          titel: "nd_locale — Sprogvalg (funktionel)",
          list: [
            "Formål: husker det sprog, du har valgt.",
            "Indhold: sprogkode, f.eks. »de« eller »en«.",
            "Varighed: indtil ændring eller sletning.",
          ],
        },
        {
          titel: "sidebar_state — Sidepanel (funktionel)",
          list: [
            "Formål: husker, om navigationspanelet er foldet ud eller sammen.",
            "Indhold: »true« eller »false«.",
            "Varighed: indtil ændring eller sletning.",
          ],
        },
        {
          titel: "sb-… — Login med Google (teknisk nødvendig, kun ved brug)",
          list: [
            "Formål: holder sessionen, når du logger ind via Google.",
            "Indhold: sessionstoken fra logintjenesten.",
            "Varighed: sessionen hhv. tokenets udløb. Sættes kun, hvis du vælger Google-login.",
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
            "Fastholder din beslutning om spambeskyttelsen i kontaktformularen, så samtykkebjælken ikke spørger igen ved hvert besøg. Der gemmes kun kategorien, tidspunktet og et versionsnummer. Værdien forlader ikke din enhed og overføres ikke til vores server; den gælder for denne browser. Sletter du den, spørger bjælken igen ved næste besøg.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Sættes kun, hvis du selv åbner chatten på denne hjemmeside og sender en besked. Det er nøglen til din egen samtale — uden det ville du ikke kunne finde vores svar igen efter et sideskift. Det indeholder ingen oplysninger om dig og bruges kun til dette formål.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Gemmer i browseren, om du har givet samtykke til brugen af talegenkendelse, så samtykket ikke spørges igen ved hvert besøg. Værdien forlader ikke din enhed.",
          ],
        },
      ],
    },
    {
      heading: "Cookies i mobilappen",
      paragraphs: [
        "Mobilappen arbejder ikke med cookies. Adgangs- og fornyelsestokens gemmes i enhedens sikrede nøglelager (iOS Keychain, Android Keystore) og slettes ved log ud.",
      ],
    },
    {
      heading: "Tredjeparts cookies",
      paragraphs: [
        "Når du gennemfører en betaling, kan betalingsudbyderen (Stripe eller PayPal) på sin egen side sætte cookies, der er nødvendige til afvikling og svindelforebyggelse. Her gælder den pågældende udbyders bestemmelser.",
        "På hjemmesider, som virksomheder opretter med vores byggesystem, bestemmer den pågældende virksomhed selv om yderligere cookies og er ansvarlig for oplysningerne dér.",
      ],
    },
    {
      heading: "Slet og kontrollér cookies",
      paragraphs: [
        "Du kan til enhver tid slette eller blokere cookies i din browsers indstillinger. Blokerer du de nødvendige cookies, er login til platformen teknisk ikke muligt — den offentlige hjemmeside og markedspladsen forbliver brugbare uden login.",
        "Ved log ud fjerner vi selv login-cookies.",
      ],
    },
    {
      heading: "Ændringer af denne politik",
      paragraphs: [
        "Kommer der funktioner til, som kræver flere cookies, opdaterer vi denne liste. Det er altid den her offentliggjorte version, der gælder; datoen øverst viser status.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
