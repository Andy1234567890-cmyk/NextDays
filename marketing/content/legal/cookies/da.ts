// Dänische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookiepolitik",
  metaDescription:
    "Hvilke cookies myNextDays bruger: teknisk nødvendige cookies samt – kun med dit samtykke – funktionelle, analytiske og marketingcookies. Hver kategori kan aktiveres og deaktiveres individuelt.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Denne politik forklarer, hvilke cookies og lignende lagringsteknikker ${ANBIETER.firma} anvender på denne hjemmeside og i platformen myNextDays.`,
    "Kort sagt: Kun de cookies, uden hvilke hjemmesiden ikke fungerer som ønsket, er nødvendige. Alt andet kræver dit samtykke og indlæses ikke uden det – spam-beskyttelsen af vores kontaktformular, rækkeviddemålingen og marketingcookies, som vi bruger til at måle succesen af vores annoncering. Du kan tillade eller afvise hver af disse kategorier individuelt og tilbagekalde din beslutning til enhver tid.",
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
        'Du skal give samtykke til tre kategorier, som alle ikke indlæses uden din tilladelse: spam-beskyttelsen af vores kontaktformular (reCAPTCHA fra Google), rækkeviddemålingen af denne hjemmeside (Google Analytics 4) og marketingcookies (Meta, LinkedIn, Google Ads). Til dette formål vises et vindue med en kategoriliste – ved første besøg, uden forvalg, hver kategori med sin egen kontakt. Så længe du ikke har truffet en beslutning, gælder "ikke tilladt", og der foretages ingen evaluering eller annoncering.',
        "Din beslutning ligger i din browsers lager (Local Storage, værdien »nd_consent«); den indeholder kun kategorien, tidspunktet og et versionsnummer, ingen identifikation af din person. Via cookie-ikonet nederst til venstre på hver side kan du til enhver tid ændre eller tilbagekalde den. Efter seks måneder spørger vi igen — et samtykke skal ikke gælde uendeligt.",
      ],
    },
    {
      heading: "Denne hjemmeside",
      paragraphs: [
        'Denne hjemmeside sætter ingen cookies af sig selv. Skrifttyper og symboler er placeret på vores egen server – der kaldes ingen symbol- eller skrifttjeneste fra en tredjepart. Kun de tjenester, du tillader, tilføjes: spam-beskyttelsen af kontaktformularen, rækkeviddemålingen og marketingtjenesterne. Hvilke cookies der sættes, med hvilken varighed og på hvilken vært, er angivet nedenfor i afsnittet "Tredjeparts cookies". Tilbagekaldelse via cookie-ikonet nederst til venstre – den pågældende tjeneste afsluttes øjeblikkeligt, og dens cookies slettes. Detaljer findes i [databeskyttelseserklæringen](/datenschutz).',
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
            "Fastholder din beslutning om de samtykkepligtige tjenester (spam-beskyttelse af kontaktformularen og rækkeviddemåling).",
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
        "Kun med Deres samtykke anvender Google-tjenester på denne hjemmeside følgende cookies – to til måling af rækkevidde, én til spambeskyttelse. Uden Deres samtykke indlæses det pågældende script ikke, og ingen af disse cookies sættes; ved tilbagekaldelse sletter vi dem.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Måling af annonceeffektivitet (samtykke påkrævet)",
          list: [
            "Formål: Tilknytter dit besøg til en annonce, så vi kan måle effektiviteten af vores kampagner.",
            "Indhold: Et tilfældigt genereret id; ingen navne-, e-mail- eller kontooplysninger fra os.",
            "Udbyder: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irland.",
            "Host: mynextdays.com (førstepartscookie, indstillet af Metas script). Varighed: ca. tre måneder.",
          ],
        },
        {
          titel:
            "_gcl_au — Måling af Google Ads-effektivitet (samtykke påkrævet)",
          list: [
            "Formål: Tilknytter dit besøg til en Google-annonce, så vi kan måle effektiviteten af vores kampagner.",
            "Indhold: Et tilfældigt genereret id uden personlig reference.",
            "Udbyder: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Host: mynextdays.com (førstepartscookie). Varighed: ca. tre måneder.",
          ],
        },
        {
          titel: "li_gc og bcookie — LinkedIn-annoncering (samtykke påkrævet)",
          list: [
            "Formål: Identificerer din browser over for LinkedIn, så annoncer og deres succes kan spores; li_gc gemmer også dit samtykke der.",
            "Indhold: Et browser-id samt samtykkestatus; ingen oplysninger fra din konto hos os.",
            "Udbyder: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irland.",
            "Host: linkedin.com (tredjepartscookies). Varighed: ca. seks måneder eller et år.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Spambeskyttelse af kontaktformularen (samtykke påkrævet)",
          list: [
            "Host: www.google.com (tredjepartscookie).",
            "Formål: Giver Google mulighed for at foretage en risikovurdering, der adskiller automatiske masseforsendelser fra reelle forespørgsler.",
            "Indhold: Et id genereret af Google til denne vurdering; ingen navne-, e-mail- eller kontooplysninger fra os.",
            "Udbyder: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Varighed: Fastsat af Google, op til seks måneder. Det indstilles først, når du har tilladt spambeskyttelse og åbnet kontaktformularen.",
          ],
        },
        {
          titel: "_ga — Rækkeviddemåling (samtykke påkrævet)",
          list: [
            "Host: mynextdays.com (førstepartscookie, indstillet af Googles script).",
            "Formål: adskiller besøgende, så gentagne besøg ikke tælles dobbelt.",
            "Indhold: tilfældigt genereret ID uden relation til din person; ingen navn-, e-mail- eller kontooplysninger.",
            "Udbyder: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Varighed: op til to år.",
          ],
        },
        {
          titel: "_ga_<ID> — Målingens sessionsstatus (samtykke påkrævet)",
          list: [
            "Host: mynextdays.com (førstepartscookie, indstillet af Googles script).",
            "Formål: registrerer, hvornår dit nuværende besøg startede, så sidevisninger fra en session hører sammen.",
            "Indhold: tidsstempel og tæller for sessionen; ID'et i navnet refererer til vores ejendom, ikke dig.",
            "Udbyder: Google Ireland Limited.",
            "Varighed: op til to år.",
          ],
        },
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
