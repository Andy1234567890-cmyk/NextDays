// Niederländische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookiebeleid",
  metaDescription:
    "Welke cookies myNextDays plaatst: technisch noodzakelijke cookies en – alleen met uw toestemming – functionele, analytische en marketingcookies. Elke categorie kan afzonderlijk worden in- en uitgeschakeld.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Dit beleid legt uit welke cookies en vergelijkbare opslagtechnieken ${ANBIETER.firma} gebruikt op deze website en in het myNextDays-platform.`,
    "Kortom: Noodzakelijk zijn alleen de cookies zonder welke de website niet functioneert zoals gevraagd. Al het andere vereist uw toestemming en wordt zonder deze niet geladen – de spambeveiliging van ons contactformulier, de bereikmeting en de marketingcookies waarmee we het succes van onze advertenties meten. U kunt elk van deze categorieën afzonderlijk toestaan of weigeren en uw beslissing op elk moment intrekken.",
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
        "U moet toestemming geven voor drie categorieën, die allemaal niet worden geladen zonder uw toestemming: de spambeveiliging van ons contactformulier (reCAPTCHA van Google), de bereikmeting van deze website (Google Analytics 4) en de marketingcookies (Meta, LinkedIn, Google Ads). Hiervoor verschijnt een venster met een categorielijst – bij het eerste bezoek, zonder voorselectie, elke categorie met een eigen schakelaar. Zolang u geen beslissing heeft genomen, geldt 'niet toegestaan' en wordt er niets geëvalueerd of geadverteerd.",
        "Uw keuze wordt opgeslagen in het geheugen van uw browser (Local Storage, waarde „nd_consent”); deze bevat alleen de categorie, het tijdstip en een versienummer, geen identificatie van uw persoon. Via het cookie-icoon linksonder op elke pagina kunt u deze op elk moment wijzigen of intrekken. Na zes maanden vragen wij opnieuw — een toestemming mag niet onbeperkt geldig blijven.",
      ],
    },
    {
      heading: "Deze website",
      paragraphs: [
        "Deze website plaatst uit zichzelf geen cookies. Lettertypen en symbolen staan op onze eigen server – er wordt geen symbool- of lettertypedienst van een derde partij opgeroepen. Alleen de diensten die u toestaat, worden toegevoegd: de spambeveiliging van het contactformulier, de bereikmeting en de marketingdiensten. Welke cookies daarbij worden geplaatst, met welke looptijd en op welke host, staat hieronder in de sectie 'Cookies van derden'. Intrekking via het cookie-symbool linksonder – de betreffende dienst eindigt onmiddellijk en de cookies worden verwijderd. Details staan in de [Privacyverklaring](/datenschutz).",
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
          titel:
            "sb-… — Inloggen met Google (technisch noodzakelijk, alleen bij gebruik)",
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
            "Legt uw beslissing vast over de diensten waarvoor toestemming nodig is (spambeveiliging van het contactformulier en bereikmeting).",
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
        "Alleen met uw toestemming plaatsen Google-diensten op deze website de volgende cookies — twee voor bereikmeting, één voor spambeveiliging. Zonder uw toestemming wordt het betreffende script niet geladen en worden deze cookies niet geplaatst; bij intrekking verwijderen wij ze.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Reclameprestatiemeting (toestemming vereist)",
          list: [
            "Doel: koppelt uw bezoek aan een advertentie, zodat wij het succes van onze campagnes kunnen meten.",
            "Inhoud: een willekeurig gegenereerde identificatie; geen naam-, e-mail- of accountgegevens van ons.",
            "Aanbieder: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Ierland.",
            "Host: mynextdays.com (first-party cookie, geplaatst door Meta's script). Looptijd: ongeveer drie maanden.",
          ],
        },
        {
          titel: "_gcl_au — Prestatiemeting Google Ads (toestemming vereist)",
          list: [
            "Doel: koppelt uw bezoek aan een Google-advertentie, zodat wij het succes van onze campagnes kunnen meten.",
            "Inhoud: een willekeurig gegenereerde identificatie zonder persoonlijke verwijzing.",
            "Aanbieder: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ierland.",
            "Host: mynextdays.com (first-party cookie). Looptijd: ongeveer drie maanden.",
          ],
        },
        {
          titel: "li_gc en bcookie — LinkedIn-reclame (toestemming vereist)",
          list: [
            "Doel: identificeert uw browser bij LinkedIn, zodat advertenties en hun succes kunnen worden toegewezen; li_gc slaat ook uw toestemming daar op.",
            "Inhoud: een browseridentificatie en de toestemmingsstatus; geen gegevens van uw account bij ons.",
            "Aanbieder: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Ierland.",
            "Host: linkedin.com (third-party cookies). Looptijd: ongeveer zes maanden of één jaar.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Spambeveiliging contactformulier (toestemming vereist)",
          list: [
            "Host: www.google.com (third-party cookie).",
            "Doel: stelt Google in staat een risicobeoordeling uit te voeren, die geautomatiseerde bulkberichten onderscheidt van echte aanvragen.",
            "Inhoud: een door Google gegenereerde identificatie voor deze beoordeling; geen naam-, e-mail- of accountgegevens van ons.",
            "Aanbieder: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ierland.",
            "Looptijd: door Google bepaald, tot zes maanden. Het wordt pas ingesteld als u de spambeveiliging heeft toegestaan en het contactformulier heeft geopend.",
          ],
        },
        {
          titel: "_ga — Bereikmeting (toestemming vereist)",
          list: [
            "Host: mynextdays.com (first-party cookie, ingesteld door Google-script).",
            "Doel: onderscheidt bezoekers, zodat terugkerende oproepen niet dubbel worden geteld.",
            "Inhoud: willekeurig gegenereerde ID zonder betrekking op uw persoon; geen naam-, e-mail- of accountgegevens.",
            "Aanbieder: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ierland.",
            "Looptijd: tot twee jaar.",
          ],
        },
        {
          titel: "_ga_<ID> — Sessiestatus van de meting (toestemming vereist)",
          list: [
            "Host: mynextdays.com (first-party cookie, ingesteld door Google-script).",
            "Doel: registreert wanneer uw huidige bezoek is begonnen, zodat paginaweergaven van één sessie bij elkaar horen.",
            "Inhoud: tijdstempel en teller van de sessie; de ID in de naam verwijst naar onze property, niet naar u.",
            "Aanbieder: Google Ireland Limited.",
            "Looptijd: tot twee jaar.",
          ],
        },
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
