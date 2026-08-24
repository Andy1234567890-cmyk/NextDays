// Niederländische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookiebeleid",
  metaDescription:
    "Welke cookies myNextDays gebruikt: uitsluitend technisch noodzakelijke en functionele cookies, geen tracking- of advertentiecookies.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Dit beleid legt uit welke cookies en vergelijkbare opslagtechnieken ${ANBIETER.firma} gebruikt op deze website en in het myNextDays-platform.`,
    "Kort samengevat: wij gebruiken uitsluitend technisch noodzakelijke en functionele cookies. Er zijn geen analytische, advertentie- of trackingcookies en er worden geen gebruiksgegevens doorgegeven aan advertentienetwerken.",
  ],
  sections: [
    {
      heading: "Wat cookies zijn",
      paragraphs: [
        "Cookies zijn kleine tekstbestanden die een website in de browser opslaat. Ze maken het mogelijk een sessie te herkennen — bijvoorbeeld zodat u na het inloggen ingelogd blijft. Naast cookies gebruiken browsers ook andere opslag zoals Local Storage, die technisch vergelijkbaar werkt.",
      ],
    },
    {
      heading: "Waarvoor wij uw toestemming nodig hebben",
      paragraphs: [
        "Toestemming is op grond van § 9 van de Deense cookieverordening (Cookie-bekendtgørelsen) (uitvoering van artikel 5, lid 3, van Richtlijn 2002/58/EG) alleen nodig wanneer toegang tot uw apparaat niet uitsluitend dient om een bericht over te brengen of niet strikt noodzakelijk is voor een door u uitdrukkelijk gevraagde dienst.",
        "Alle cookies die wij plaatsen zijn noodzakelijk voor het inloggen, de beveiliging van de sessie of een door uzelf gekozen instelling — daarvoor vragen wij niets en plaatsen wij omgekeerd ook niets waarvoor toestemming nodig zou zijn.",
        "U hoeft slechts voor één ding toestemming te geven: de spambeveiliging van ons contactformulier. Deze komt van Google (reCAPTCHA Enterprise), is dus een externe dienst, en wordt uitsluitend geladen als u dit hebt toegestaan. Daarvoor verschijnt bij het eerste bezoek een balk onderaan het scherm, met gelijkwaardige knoppen voor Weigeren en Accepteren en zonder vooraf gemaakte keuze. Zolang u niet hebt beslist, geldt „niet toegestaan”.",
        "Uw keuze wordt opgeslagen in het geheugen van uw browser (Local Storage, waarde „nd_consent”); deze bevat alleen de categorie, het tijdstip en een versienummer, geen identificatie van uw persoon. Onderaan deze pagina kunt u deze op elk moment wijzigen of intrekken.",
      ],
    },
    {
      heading: "Deze website",
      paragraphs: [
        "De marketingwebsite plaatst geen cookies. Lettertypen en pictogrammen staan op onze eigen server — daarvoor wordt geen lettertype- of pictogramdienst van een derde partij aangeroepen. De enige externe dienst van deze website is de spambeveiliging van het contactformulier, en die laadt alleen met uw toestemming. Details vindt u in de [Privacyverklaring](/datenschutz).",
      ],
    },
    {
      heading: "Cookies van het platform",
      paragraphs: [
        "Zodra u inlogt op het dashboard, in de marktplaats of in de mobiele weergave, worden de volgende cookies geplaatst:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Inloggen (technisch noodzakelijk)",
          list: [
            "Doel: identificeert uw ingelogde sessie bij de server.",
            "Inhoud: kortlevend toegangstoken; alleen leesbaar voor de server (HttpOnly), alleen verzonden via HTTPS.",
            "Bewaartermijn: sessie resp. verval van het token.",
          ],
        },
        {
          titel: "nd_refresh — Sessieverlenging (technisch noodzakelijk)",
          list: [
            "Doel: vernieuwt het toegangstoken zodat u niet steeds opnieuw hoeft in te loggen.",
            "Inhoud: vernieuwingstoken; HttpOnly, alleen via HTTPS.",
            "Bewaartermijn: tot uitloggen of verval.",
          ],
        },
        {
          titel: "nd_locale — Taalkeuze (functioneel)",
          list: [
            "Doel: onthoudt de door u gekozen taal.",
            "Inhoud: taalcode, bijv. „de” of „en”.",
            "Bewaartermijn: tot wijziging of verwijdering.",
          ],
        },
        {
          titel: "sidebar_state — Zijbalk (functioneel)",
          list: [
            "Doel: onthoudt of de navigatiebalk in- of uitgeklapt is.",
            "Inhoud: „true” of „false”.",
            "Bewaartermijn: tot wijziging of verwijdering.",
          ],
        },
        {
          titel: "sb-… — Inloggen met Google (technisch noodzakelijk, alleen bij gebruik)",
          list: [
            "Doel: houdt de sessie in stand wanneer u inlogt via Google.",
            "Inhoud: sessietoken van de inlogdienst.",
            "Bewaartermijn: sessie resp. verval van het token. Wordt alleen geplaatst als u kiest voor inloggen via Google.",
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
            "Bevat uw beslissing over de spambeveiliging van het contactformulier, zodat de toestemmingsbalk niet bij elk bezoek opnieuw vraagt. Er worden alleen de categorie, het tijdstip en een versienummer opgeslagen. De waarde verlaat uw apparaat niet en wordt niet naar onze server verzonden; deze geldt voor deze browser. Als u deze verwijdert, vraagt de balk bij het volgende bezoek opnieuw.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Wordt alleen geplaatst als u zelf de chat op deze website opent en een bericht verstuurt. Het is de sleutel tot uw eigen gesprek — zonder deze zou u ons antwoord na een paginawissel niet terugvinden. Het bevat geen gegevens over u en wordt alleen voor dit doel gebruikt.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Slaat in de browser op of u hebt ingestemd met het gebruik van spraakinvoer, zodat niet bij elk bezoek opnieuw om toestemming wordt gevraagd. De waarde verlaat uw apparaat niet.",
          ],
        },
      ],
    },
    {
      heading: "Cookies van de mobiele app",
      paragraphs: [
        "De mobiele app werkt niet met cookies. Toegangs- en vernieuwingstokens worden opgeslagen in de beveiligde sleutelopslag van het apparaat (iOS Keychain, Android Keystore) en verwijderd bij het uitloggen.",
      ],
    },
    {
      heading: "Cookies van derden",
      paragraphs: [
        "Wanneer u een betaling uitvoert, kan de betalingsdienstaanbieder (Stripe of PayPal) op zijn eigen pagina cookies plaatsen die nodig zijn voor de afhandeling en fraudepreventie. Daarvoor gelden de bepalingen van de betreffende aanbieder.",
        "Op websites die bedrijven met onze website-bouwer aanmaken, beslist het betreffende bedrijf over aanvullende cookies en is het verantwoordelijk voor de aldaar getoonde informatie.",
      ],
    },
    {
      heading: "Cookies verwijderen en beheren",
      paragraphs: [
        "U kunt cookies te allen tijde verwijderen of blokkeren in de instellingen van uw browser. Als u de noodzakelijke cookies blokkeert, is inloggen op het platform technisch niet mogelijk — de openbare website en de marktplaats blijven zonder inloggen bruikbaar.",
        "Bij het uitloggen verwijderen wij de inlogcookies zelf.",
      ],
    },
    {
      heading: "Wijzigingen van dit beleid",
      paragraphs: [
        "Als er functies bijkomen waarvoor extra cookies nodig zijn, werken wij deze lijst bij. Steeds geldt de hier gepubliceerde versie; de datum bovenaan toont de laatste bijwerking.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
