// Niederländische Fassung der Datenschutzerklärung.
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
  title: "Privacyverklaring",
  metaDescription:
    "Hoe myNextDays persoonsgegevens verwerkt: doeleinden, rechtsgronden, ontvangers, bewaartermijnen en uw rechten op grond van de AVG.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Deze verklaring beschrijft hoe ${ANBIETER.firma} persoonsgegevens verwerkt — bij een bezoek aan deze website, bij het gebruik van het platform myNextDays (dashboard, marktplaats en mobiele app) en in het kader van de zakelijke relatie met onze klanten.`,
    "Wij verkopen geen gegevens en maken geen profielen die u als persoon identificeren. Op deze website meten we – alleen met uw toestemming – het bereik van onze pagina's en het succes van onze advertenties; beide categorieën zijn afzonderlijk af te melden (zie secties Bereikmeting en Advertenties en succesmeting). Voor promotionele doeleinden verwerken wij gegevens uitsluitend indien u hiervoor uitdrukkelijk toestemming heeft gegeven — namelijk voor onze nieuwsbrief (zie sectie Communicatie), die u op elk moment met één klik kunt opzeggen.",
  ],
  sections: [
    {
      heading: "Verwerkingsverantwoordelijke",
      paragraphs: [
        "Verantwoordelijk voor de in deze verklaring beschreven verwerkingen is:",
      ],
      zeilen: [
        {
          label: "Onderneming",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adres",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefoon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Toepassingsgebied en rollen",
      unterpunkte: [
        {
          paragraphs: [
            "Voor het bezoek aan deze website, voor uw klantaccount en voor de uitvoering van onze zakelijke relatie zijn wij verwerkingsverantwoordelijke in de zin van art. 4, punt 7, AVG.",
          ],
        },
        {
          paragraphs: [
            "Voor de gegevens die onze klanten (verhuurders, hotels, agentschappen) in het platform over hun gasten, eigenaren en medewerkers verwerken, zijn de klanten verwerkingsverantwoordelijke en zijn wij verwerker op grond van art. 28 AVG. De bijzonderheden staan in de [verwerkersovereenkomst](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Boekt u als gast een accommodatie via onze marktplaats, dan verwerken wij uw boekings- en contactgegevens zowel op eigen naam (exploitatie van de marktplaats, betalingsverwerking) als ten behoeve van het gastgevende bedrijf. Uw accommodatieovereenkomst komt uitsluitend met dat bedrijf tot stand; de privacyverklaring daarvan geldt daarnaast.",
          ],
        },
      ],
    },
    {
      heading: "Bezoek aan deze website",
      unterpunkte: [
        {
          titel: "Serverlogbestanden",
          paragraphs: [
            "Bij elke aanvraag stuurt uw browser technisch noodzakelijke gegevens die onze webserver vastlegt: IP-adres, datum en tijd, opgevraagd adres, hoeveelheid overgedragen gegevens, statuscode, referrer en browserkenmerk. Het doel is het aanbieden van de pagina en het herkennen en afweren van aanvallen en storingen. Rechtsgrond is art. 6, lid 1, onder f, AVG; ons gerechtvaardigd belang is een veilige en stabiele exploitatie. De logbestanden worden slechts zo lang bewaard als voor exploitatie en veiligheid noodzakelijk is en worden niet met andere gegevens samengevoegd.",
          ],
        },
        {
          titel: "Lettertypen",
          paragraphs: [
            "De gebruikte lettertypen zijn lokaal op onze server opgenomen. Er vindt geen verbinding met Google Fonts of een andere lettertypedienst plaats.",
          ],
        },
        {
          titel: "Pictogrammen",
          paragraphs: [
            "De pictogrammen van deze website staan net als de lettertypen bij ons: zij worden op onze server in de pagina geplaatst en niet door een pictogrammendienst nageladen. Er vindt daarbij geen verbinding met een derde plaats en uw IP-adres wordt aan niemand doorgegeven.",
          ],
        },
        {
          titel: "Spambeveiliging van het contactformulier (reCAPTCHA)",
          paragraphs: [
            "Ons contactformulier is met reCAPTCHA Enterprise van Google Ireland Limited beveiligd tegen geautomatiseerde massaberichten. Alleen wanneer u daarmee instemt, laadt uw browser bij het invullen van het formulier een script van www.google.com; daarbij worden uw IP-adres en gegevens over uw interactie met het formulier aan Google doorgegeven en daar geanalyseerd om mens en script te onderscheiden. Rechtsgrond is art. 6, lid 1, onder a, AVG (toestemming); aanvullend geldt de [privacyverklaring van Google](https://policies.google.com/privacy).",
            "Zonder uw toestemming wordt er niets van Google geladen en worden er geen gegevens naar Google verzonden; wij accepteren het formulier dan niet, maar u kunt ons altijd een e-mail sturen. Als u toestemming geeft, plaatst reCAPTCHA een eigen cookie (_GRECAPTCHA, looptijd door Google bepaald, tot zes maanden) dat wordt gebruikt voor risicobeoordeling. U kunt uw toestemming op elk moment wijzigen of intrekken via het cookie-pictogram linksonder op elke pagina; het cookie wordt dan verwijderd.",
          ],
        },
        {
          titel: "Bereikmeting (Google Analytics)",
          paragraphs: [
            "Op deze website meten wij met Google Analytics 4 van Google Ireland Limited hoe onze pagina's worden gebruikt – welke pagina's worden bezocht, waar bezoekers vandaan komen en op welk punt zij afhaken. Het doel is uitsluitend de verbetering van het aanbod en de vindbaarheid.",
            "Het laden gebeurt uitsluitend met uw toestemming. Als u deze geeft, laadt uw browser een script van www.googletagmanager.com en slaat twee cookies op („_ga“ en „_ga_<ID>“, geldig tot twee jaar) met een willekeurig gegenereerde ID; deze ID, de bezochte pagina's, verwijzende bron, geschatte locatie op land- of regioniveau, apparaat en browser, evenals uw IP-adres, dat Google inkort voordat het wordt opgeslagen, worden verzonden. De rechtsgrondslag is art. 6 lid 1 lit. a AVG (toestemming).",
            "Wij hebben de analyse uitdrukkelijk beperkt: Google-signalen en reclamepersonalisatie zijn uitgeschakeld. Er worden daarom geen cross-device profielen en geen doelgroepen voor reclame gecreëerd, en wij geven geen gebruiksgegevens door aan advertentienetwerken. Er vindt geen samenvoeging met uw klantenaccount plaats.",
            "Google verwerkt de gegevens als onze verwerker op basis van een overeenkomst volgens art. 28 AVG (Google Ads Data Processing Terms). De inkorting van uw IP-adres vindt plaats op servers in de EU, voordat gegevens naar de VS worden overgedragen; er wordt dus een pseudonieme dataset overgedragen. De basis voor de overdracht is het adequaatheidsbesluit van de EU-Commissie voor het EU-US Data Privacy Framework (art. 45 AVG), waaronder Google LLC is gecertificeerd; aanvullend heeft Google de standaardcontractbepalingen van de EU-Commissie (art. 46 AVG) opgenomen. Wij wijzen er uitdrukkelijk op dat Amerikaanse autoriteiten volgens Section 702 FISA ook toegang kunnen krijgen tot gegevens van gecertificeerde bedrijven en dat een restrisico daarom niet volledig kan worden uitgesloten. Bovendien geldt de [privacyverklaring van Google](https://policies.google.com/privacy).",
            "Opslagduur: De gebeurtenis- en gebruikersgerelateerde gegevens worden in onze property na 14 maanden automatisch verwijderd; geaggregeerde rapportagegegevens zonder betrekking op individuele bezoekers blijven langer bewaard. Uw toestemming zelf verloopt na zes maanden.",
            "Zonder uw toestemming wordt niets geladen, wordt er geen cookie geplaatst en stromen er geen gegevens naar Google. U kunt uw toestemming te allen tijde intrekken via het cookie-icoon linksonder op elke pagina; de meting stopt dan onmiddellijk en de genoemde cookies worden verwijderd. Na zes maanden vragen wij opnieuw.",
          ],
        },
        {
          titel: "Reclame en succesmeting",
          paragraphs: [
            "Met uw toestemming gebruiken wij marketingcookies om het succes van onze reclame te meten en u passende advertenties op andere platforms te tonen. Betrokken zijn Meta Platforms Ireland (Meta-pixel, cookie _fbp), LinkedIn Ireland (Insight-tag, cookies li_gc en bcookie) en Google Ireland Limited (Google Ads, cookie _gcl_au). De rechtsgrondslag is art. 6 lid 1 lit. a AVG. Zonder uw toestemming wordt geen van deze scripts geladen en geen cookie geplaatst; bij intrekking verwijderen wij ze. Details over elke cookie staan in het [Cookiebeleid](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Klantaccount en gebruik van het platform",
      paragraphs: [
        "Voor de registratie en de exploitatie van een account verwerken wij de gegevens die u of uw bedrijf invoert: naam, handelsnaam en rechtsvorm, adres, e-mailadres, telefoonnummer, rol en bevoegdheden, registergegevens (bijv. handelsregister- of btw-nummer), bankrekening voor uitbetalingen en de inhoud die in het account wordt aangelegd.",
        "Om de toegang te beveiligen verwerken wij bovendien aanmeldlogboeken (tijdstip, IP-adres, apparaat en browser van de aanmelding) en — indien geactiveerd — de gegevens van de tweefactorauthenticatie.",
        "Aanmelden met Google: u kunt zich in plaats van met e-mailadres en wachtwoord ook met een Google-account aanmelden. Kiest u deze weg, dan ontvangen wij van Google Ireland Limited uitsluitend uw e-mailadres, uw naam, uw profielfoto en een kenmerk van uw Google-account (de bereiken “openid”, “email”, “profile”) — uitdrukkelijk geen toegang tot uw e-mails, contacten, bestanden of agenda. Uw Google-wachtwoord komen wij niet te weten. Google verwerkt de aanmeldprocedure daarbij als eigen verwerkingsverantwoordelijke; daarop is de [privacyverklaring van Google](https://policies.google.com/privacy) van toepassing. Rechtsgrond is art. 6, lid 1, onder b, AVG, omdat de aanmelding dient ter uitvoering van de overeenkomst; de keuze voor deze aanmeldweg is vrijwillig en op elk moment te vervangen door de aanmelding met e-mailadres en wachtwoord.",
        "Rechtsgrond is art. 6, lid 1, onder b, AVG (uitvoering van de gebruiksovereenkomst, zie [algemene voorwaarden](" +
          AGB_URL +
          ")), voor de beveiliging van de toegang art. 6, lid 1, onder f, AVG en voor de fiscale en handelsrechtelijke bewaring art. 6, lid 1, onder c, AVG.",
      ],
    },
    {
      heading: "Boekingen, gasten- en objectgegevens",
      paragraphs: [
        "Via het platform worden reserveringen, gastgegevens, berichten, taken en afrekeningen verwerkt. Daartoe horen in het bijzonder naam en contactgegevens van de gast, aankomst en vertrek, aantal reizigers, prijzen en betaalstatus, berichtgeschiedenis en — voor zover het bedrijf die vastlegt — registratiegegevens en bijzondere wensen.",
        "Deze verwerking vindt plaats in opdracht en volgens instructie van het betreffende bedrijf. Wij gebruiken deze gegevens niet voor eigen doeleinden, niet voor reclame en niet voor het trainen van AI-modellen.",
        "Binnen een bedrijf zijn de gegevens per rol gescheiden: schoonmaak- en servicemedewerkers zien geen financiële en verkoopgegevens, eigenaren alleen hun eigen objecten. Tussen verschillende bedrijven zijn de gegevens technisch gescheiden (mandantgebonden toegangsregels in de database).",
      ],
    },
    {
      heading: "Betalingsverwerking",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Kaartbetalingen en uitbetalingen lopen via Stripe Payments Europe, Limited, Ierland. Daarbij worden de voor de betaling noodzakelijke gegevens (bedrag, valuta, betaalmiddel, naam, e-mailadres, boekingsreferentie) en voor de accounts van onze klanten de wettelijk voorgeschreven identificatiegegevens (houder, uiteindelijk belanghebbenden, identiteitsgegevens, bankrekening) aan Stripe doorgegeven. Volledige kaartgegevens bereiken onze systemen niet. Rechtsgronden zijn art. 6, lid 1, onder b, AVG en, voor identificatie- en antiwitwasverplichtingen, art. 6, lid 1, onder c, AVG. De bijzonderheden regelt de [privacyverklaring van Stripe](https://stripe.com/privacy).",
            "Betaallinks voor aanvullende diensten: brengt een bedrijf zijn gast een aanvullende dienst (bijv. schoonmaak of linnengoed) in rekening via een betaallink, dan leidt die link naar een door Stripe geëxploiteerde betaalpagina. Wij geven daarvoor aan Stripe de omschrijving van de dienst, het bedrag, de valuta en een interne referentie naar boeking en bedrijf door; het bedrijfslogo van het bedrijf wordt naar zijn Stripe-account overgedragen, zodat de pagina zijn merk laat zien. Op de betaalpagina zelf verzamelt Stripe de betaal- en apparaatgegevens van de gast onder eigen verantwoordelijkheid. Naar ons terug komen alleen de betaalstatus, het bedrag, de ingehouden bedragen en de kenmerken van de betaling — geen kaartgegevens.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Voor zover het bedrijf PayPal als betaalmethode aanbiedt, worden de betaalgegevens doorgegeven aan PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg. Daarop is de [privacyverklaring van PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full) van toepassing.",
          ],
        },
      ],
    },
    {
      heading: "Verkoopkanalen en portalen",
      paragraphs: [
        "Verkoopt een bedrijf zijn objecten via portalen als Booking.com, Airbnb of Expedia, dan worden beschikbaarheden, prijzen, restricties en boekingsgegevens via onze koppelingsdienstverlener Channex.io Ltd, Verenigd Koninkrijk, met het betreffende portaal uitgewisseld. Uit die richting ontvangen wij de boekings- en gastgegevens van het portaal.",
        "Voor het betreffende portaal gelden de eigen privacyvoorwaarden daarvan; in zoverre is het portaal zelfstandig verantwoordelijk. Rechtsgrond van de doorgifte is art. 6, lid 1, onder b, AVG in samenhang met de opdracht van het bedrijf.",
      ],
    },
    {
      heading: "Communicatie",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "E-mails in het kader van het gebruik (boekingsbevestigingen, systeemberichten, support, bevestigings- en uitnodigingslinks) versturen en ontvangen wij via een eigen mailserver, die wij zelf beheren. Voor deze berichten is geen externe verzenddienst ingeschakeld.",
          ],
        },
        {
          titel: "Nieuwsbrief en vooraanmelding",
          paragraphs: [
            "Op onze website kunt u zich inschrijven voor nieuws over myNextDays (vooraanmelding/nieuwsbrief). Daarbij worden uw e-mailadres, de taal en de plaats waar u zich hebt ingeschreven verwerkt.",
            "De aanmelding verloopt volgens de dubbele-opt-inprocedure: na het inschrijven ontvangt u een e-mail met een bevestigingslink; pas met de klik daarop is de aanmelding werkzaam. Ter onderbouwing van de toestemming bewaren wij het tijdstip van de aanmelding en van de bevestiging, het daarbij gebruikte IP-adres, het browserkenmerk en de tekst waarmee u hebt ingestemd. Deze gegevens dienen uitsluitend als bewijs op grond van art. 7, lid 1, AVG en worden niet voor reclamedoeleinden geanalyseerd.",
            "Rechtsgrond is uw toestemming op grond van art. 6, lid 1, onder a, AVG; de bewaring van het bewijs baseren wij op art. 6, lid 1, onder c, in samenhang met art. 7, lid 1, AVG. U kunt de toestemming op elk moment met werking voor de toekomst intrekken — via de afmeldlink in elke nieuwsbriefmail of eenvoudig per e-mail aan ons. De intrekking laat de rechtmatigheid van de tot dan verrichte verwerking onverlet.",
            "Voor het beheer en de verzending van de nieuwsbrieven maken wij gebruik van Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Frankrijk; Duitse vestiging: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) als verwerker. Doorgegeven worden uw e-mailadres en de genoemde aanvullende gegevens (taal, bron). De gegevens worden verwerkt op servers binnen de Europese Unie (Frankrijk en Duitsland); met Brevo bestaat een verwerkersovereenkomst op grond van art. 28 AVG. Daarop is de [privacyverklaring van Brevo](https://www.brevo.com/legal/privacypolicy/) van toepassing.",
            "Versturen wij een nieuwsbrief, dan meet Brevo in onze opdracht of het bericht is geopend en of op de opgenomen links is geklikt. Deze meting helpt ons inhoud en frequentie aan te passen; zij maakt deel uit van de toestemming en eindigt met uw afmelding. Een samenvoeging met andere gegevensbronnen of een profilering vindt niet plaats.",
            "Zolang de bevestiging uitblijft, wordt uw adres niet aangeschreven en niet aan Brevo doorgegeven; een niet-bevestigde inschrijving verloopt na zeven dagen. Na een afmelding blokkeren wij het adres voor verzending en bewaren wij het bewijs van toestemming en afmelding zolang daaruit aanspraken kunnen worden gemaakt; op verzoek verwijderen wij het volledig.",
          ],
        },
        {
          titel: "Berichten in het platform",
          paragraphs: [
            "Berichten tussen gast en bedrijf worden in het platform opgeslagen, zodat beide zijden de geschiedenis kunnen inzien. Blokkeert een bedrijf een gast, dan wordt het berichtenkanaal gesloten; bestaande berichten blijven ter controleerbaarheid bewaard.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Gebruikt een bedrijf de WhatsApp-koppeling, dan worden de berichtinhoud en de telefoonnummers van de betrokkenen doorgegeven via het WhatsApp Business Platform van Meta Platforms Ireland Limited. Over het gebruik van deze functie beslist het bedrijf; zonder activering vindt geen doorgifte plaats.",
          ],
        },
      ],
    },
    {
      heading: "Geautomatiseerde functies en AI",
      paragraphs: [
        "Voor de hier beschreven functies geldt naast de AVG ook Verordening (EU) 2024/1689 (AI-verordening, “AI Act”), waarvan de transparantieverplichtingen op grond van artikel 50 sinds 2 augustus 2026 van toepassing zijn.",
      ],
      unterpunkte: [
        {
          titel: "Antwoordsuggesties",
          paragraphs: [
            "Voor antwoordsuggesties in de berichtenmap gebruiken wij — voor zover de functie voor het bedrijf is geactiveerd — het taalmodelaanbod van Groq, Inc., VS. Daarbij wordt de betreffende berichtcontext aan de dienst doorgegeven. Suggesties worden niet automatisch verzonden; over de verzending beslist altijd een mens. Geautomatiseerde besluitvorming met rechtsgevolgen in de zin van art. 22 AVG vindt niet plaats.",
            "Het gaat daarmee niet om een AI-systeem dat in de zin van artikel 50, lid 1, van de AI-verordening rechtstreeks met natuurlijke personen interacteert: de verplichting veronderstelt een DIRECTE interactie waarbij de AI zelf met de persoon communiceert en niet via een menselijke tussenschakel. Hier stelt de functie het bedrijf een tekst voor die een medewerker controleert, kan wijzigen en zelf verzendt — de medewerker is die tussenschakel, de gast correspondeert met het bedrijf en niet met een chatbot. Een automatisch antwoordende assistent is niet in gebruik. Naar onze inschatting vervult de functie ook geen van de gevallen voor AI met een hoog risico volgens bijlage III van de AI-verordening.",
            "Berichten aan gasten zijn bovendien geen “tekst over aangelegenheden van algemeen belang” in de zin van artikel 50, lid 4, van de AI-verordening: zij worden niet gepubliceerd, maar individueel aan een bepaalde persoon verzonden, en betreffen de afhandeling van een verblijf. Los daarvan geldt hier de menselijke controle door de verzendende medewerker.",
            "Mocht in de toekomst een functie worden aangeboden die zelfstandig — zonder menselijke goedkeuring — aan gasten antwoordt, dan wordt de gast aan het begin van de dialoog zichtbaar erop gewezen dat hij met een AI-systeem schrijft. Zonder die melding wordt een dergelijke functie niet aangeboden.",
          ],
        },
        {
          titel: "Rollen op grond van de AI-verordening",
          paragraphs: [
            "Voor de in het product ingebouwde AI-functies zijn wij gebruiksverantwoordelijke in de zin van artikel 3, punt 4, van de AI-verordening; aanbieder van de onderliggende taalmodellen zijn de betreffende modelaanbieders. Gebruikt een bedrijf deze functies in het kader van zijn beroepsactiviteit, dan is het daarvoor op zijn beurt gebruiksverantwoordelijke en rust op hem de plicht tot AI-geletterdheid op grond van artikel 4 van de AI-verordening, die sinds 2 februari 2025 onafhankelijk van de bedrijfsgrootte geldt. Sinds 27 juli 2026 geldt zij in de versie van Verordening (EU) 2026/1744: aanbieders en gebruiksverantwoordelijken nemen maatregelen om de ontwikkeling van de AI-geletterdheid van hun personeel te ondersteunen; een bepaald niveau hoeft daarbij uitdrukkelijk niet te worden gegarandeerd. Wij ondersteunen met aanwijzingen in de toepassing en in ons helpcentrum; de opleiding van de eigen medewerkers blijft de taak van het bedrijf.",
            "Verbindt een bedrijf zijn account met een eigen AI-assistent (zie het volgende punt), dan is het ook daarvoor gebruiksverantwoordelijke in de zin van de AI-verordening — het beslist over het gebruik en formuleert de opdrachten. De koppeling zelf is geen AI-systeem: zij leest gegevens uit de database en geeft die weer, zonder gevolgtrekkingen te maken; overweging 12 van de AI-verordening bakent dergelijke systemen uitdrukkelijk af van AI.",
          ],
        },
        {
          titel: "Verbinding met een eigen AI-assistent",
          paragraphs: [
            "Een bedrijf kan zijn account via een koppeling verbinden met een AI-assistent die het zelf heeft gekozen en waarmee het een eigen overeenkomst heeft — bijvoorbeeld Claude van Anthropic PBC, VS. Is een dergelijke verbinding gegeven, dan kan de assistent op verzoek van het bedrijf lezend opvragen: bezetting, beschikbaarheid en dagprijzen; boekingen met gastnaam, verblijfsperiode, object, boekingskanaal, status en bedrag en valuta, voor zover de rol van het opvragende account bedragen mag zien; en het overzicht van de gesprekken in de berichtenmap. Zonder een gegeven verbinding vindt geen doorgifte plaats.",
            "Niet doorgegeven worden daarbij e-mailadres en telefoonnummer van de gasten, kaartgegevens, bankrekeningen en betaalbewijzen, toegangscodes en objectdossiers. Boekingsnotities en de inhoud van gastberichten zijn standaard uitgesloten, omdat zij gegevens over de gezondheid of andere bijzondere categorieën op grond van art. 9 AVG kunnen bevatten; het bedrijf moet ze bij het geven van de verbinding uitdrukkelijk en afzonderlijk vrijgeven.",
            "De verbinding kan alleen een account met de rol “beheerder” geven, niet elk account met toegang. Elke opvraging wordt vastgelegd en is voor het bedrijf onder “Account → Verbindingen” in te zien; het kan de verbinding daar op elk moment verbreken, en de toegang eindigt daarmee onmiddellijk.",
            "Juridisch is deze doorgifte een instructie van het bedrijf aan ons (art. 28, lid 3, onder a, AVG). De aanbieder van de assistent is geen subverwerker van ons — wij geven hem geen opdracht en geven hem geen instructies; hij verwerkt de gegevens op grond van de overeenkomst die het bedrijf zelf met hem heeft gesloten. Voor de rechtsgrond van deze verwerking, voor de informatie aan zijn gasten en voor de waarborgen van een doorgifte naar een derde land is daarom het bedrijf verantwoordelijk.",
          ],
        },
        {
          titel: "Vertalingen",
          paragraphs: [
            "Object- en inhoudsteksten kunnen via de Cloud Translation API van Google Ireland Limited worden vertaald. Doorgegeven worden daarbij de te vertalen teksten; persoonsgegevens alleen voor zover die in deze teksten zijn opgenomen.",
          ],
        },
        {
          titel: "Prijsadviezen",
          paragraphs: [
            "Voor prijsadviezen maken wij gebruik van markt-, weer- en wisselkoersgegevens van externe bronnen. Deze opvragingen bevatten geen persoonsgegevens, maar alleen plaats, periode en objectkenmerken.",
          ],
        },
      ],
    },
    {
      heading: "Websites en domeinen van onze klanten",
      paragraphs: [
        "Maakt een bedrijf via de websitebouwer een eigen website met eigen domein, dan beheren wij de daarvoor benodigde DNS-records via Cloudflare, Inc. Daarbij worden domein- en configuratiegegevens doorgegeven; bezoekersgegevens van de klantwebsite verwerken wij zoals in deze verklaring beschreven.",
        "Voor inhoud, colofon en privacyverklaring van de klantwebsite is het betreffende bedrijf verantwoordelijk.",
      ],
    },
    {
      heading: "Partnerprogramma",
      paragraphs: [
        "Wij exploiteren een partnerprogramma waarmee partners (influencers, consultants, bureaus, klanten) bedrijven kunnen aanbevelen aan myNextDays en daarvoor een commissie ontvangen. Daarbij verwerken wij gegevens van partners en – in beperkte mate – van aanbevolen bedrijven.",
      ],
      unterpunkte: [
        {
          titel: "Gegevens van de partners",
          paragraphs: [
            "Bij de aanmelding verwerken wij naam, bedrijf, rechtsvorm, land, e-mailadres, taal, socialemedia-accounts (platform, adres, handle, zelf opgegeven bereik), btw-identificatienummer (controle via het EU-systeem VIES), uitbetalingsgegevens (IBAN, Wise- of PayPal-adres) en de instemming met de deelnamevoorwaarden met versie en tijdstip. De rechtsgrondslag is de uitvoering van de partnerovereenkomst (artikel 6 lid 1 sub b AVG); voor tegoeden en bewaring gelden de fiscale en handelsrechtelijke verplichtingen (artikel 6 lid 1 sub c AVG).",
            "Als een partner een team leidt, ziet hij van zijn team-partners naam of bedrijf, rang, aantal betalende klanten en de daaruit voortvloeiende teamcommissie. Berichten tussen sponsor en team-partner worden op het platform opgeslagen, zodat beiden het verloop kunnen zien.",
          ],
        },
        {
          titel: "Kliks op partnerlinks",
          paragraphs: [
            "Als een bezoeker een partnerlink (mynextdays.com/p/CODE) oproept, slaan wij de code, het tijdstip, de opgeroepen pagina, de verwijzende pagina en eventuele campagneparameters, evenals het IP-adres en de browseridentificatie uitsluitend op als verkorte controlesommen (hash) – voor misbruikdetectie (opeenhopingen), niet voor herkenning. Er wordt geen trackingcookie geplaatst. Klikgegevens verwijderen wij na 90 dagen. De rechtsgrondslag is ons gerechtvaardigd belang bij een fraudebestendige afrekening van het programma (artikel 6 lid 1 sub f AVG).",
          ],
        },
        {
          titel: "Gekoppelde socialemedia-accounts en berichten",
          paragraphs: [
            "Partners kunnen hun accounts bij YouTube (Google), Instagram en Facebook (Meta) en TikTok vrijwillig koppelen aan het partnerdashboard. Daarbij geven zij het betreffende platform een leesvrijgave (OAuth); wij schrijven niets naar deze accounts. Wij slaan de identificatie en de naam van het account, het versleutelde toegangstoken, het tijdstip van de koppeling en dagelijks een meetwaarde per account op: aantal volgers of abonnees, weergaven van de laatste 28 dagen, interactiepercentage en aantal berichten, telkens met het tijdstip van de platformreactie. Voor berichten die de partner in het dashboard aanmaakt (titel, platform, adres, publicatiedatum), slaan wij bovendien weergaven, likes, reacties, deelacties en opslagacties van het platform op.",
            "Het doel is het controleren van het door de partner opgegeven bereik en het toewijzen van klikken en klanten aan individuele bijdragen; niet-geverifieerde gegevens worden minder zwaar gewogen bij de vrijgave. Aanwijzingen voor inconsistenties (zoals een plotselinge toename van volgers zonder passende weergaven) dienen uitsluitend voor handmatige controle door ons en leiden niet tot een geautomatiseerde beslissing. De rechtsgrondslag is de toestemming van de partner (artikel 6, lid 1, onder a, AVG), die hij geeft door de verbinding tot stand te brengen en op elk moment kan intrekken in het dashboard onder „Verbinding verbreken”; bij het verbreken verwijderen wij het toegangstoken onmiddellijk, opgeslagen meetwaarden blijven als geschiedenis behouden en worden verwijderd met het partneraccount. Wij gebruiken uitsluitend de officiële interfaces van de platforms; voor de verwerking door Google, Meta en TikTok gelden hun eigen privacyverklaringen.",
          ],
        },
        {
          titel: "Aanbevolen bedrijven",
          paragraphs: [
            "Als een bedrijf zich registreert met een partnercode, slaan we de toewijzing van het bedrijf aan de partner op, evenals het tijdstip, de manier (link of code) en de status. De partner ziet het bedrijf uitsluitend pseudoniem (volgnummer, land, status, bedragen) — nooit naam, e-mailadres of boekingsgegevens. Alleen als het bedrijf bij de registratie uitdrukkelijk toestemt, mag de partner contact met hem opnemen via het platform. Voor de provisieafrekening verwerken we de netto-abonnementsbedragen van de betaalde facturen van het bedrijf; de rechtsgrondslag is de uitvoering van de partner- en de gebruiksovereenkomst (artikel 6, lid 1, onder b, AVG).",
          ],
        },
      ],
    },
    {
      heading: "Hosting en opslag",
      paragraphs: [
        "Het platform, de database, de media en de mailserver draaien op servers van Hetzner Online GmbH, Duitsland, in het datacentrum Helsinki (Finland) — dus binnen de Europese Unie. Met Hetzner bestaat een verwerkersovereenkomst.",
        "Back-ups worden versleuteld aangemaakt en versleuteld bewaard bij een opslagaanbieder binnen de EU.",
      ],
    },
    {
      heading: "Ontvangers in één overzicht",
      paragraphs: [
        "Behalve aan de genoemde dienstverleners geven wij persoonsgegevens alleen door wanneer wij daartoe wettelijk verplicht zijn (bijv. belastingdienst, strafvervolging) of wanneer u respectievelijk het verantwoordelijke bedrijf daarom vraagt.",
      ],
      list: [
        "Hetzner Online GmbH (Duitsland/Finland) — hosting, database, media, mailserver",
        "Stripe Payments Europe, Limited (Ierland) — betalingen, uitbetalingen, identiteitscontrole",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) — betalingen, voor zover geactiveerd",
        "Channex.io Ltd (Verenigd Koninkrijk) — koppeling met boekingsportalen",
        "Meta Platforms Ireland Limited (Ierland) — WhatsApp-berichten, voor zover geactiveerd",
        "Sendinblue SAS / Brevo (Frankrijk, Duitsland) — beheer en verzending van de nieuwsbrief, alleen bij toestemming",
        "Google Ireland Limited (Ierland) — vertalingen; spambeveiliging van het contactformulier (reCAPTCHA Enterprise), alleen bij toestemming; aanmelden met Google, voor zover gebruikt; Bereikmeting (Google Analytics 4), alleen met toestemming",
        "Groq, Inc. (VS) — antwoordsuggesties, voor zover geactiveerd",
        "Cloudflare, Inc. (VS) — DNS-beheer voor klantdomeinen",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Niet in deze lijst staan diensten die een bedrijf zelf met een derde overeenkomt en via de koppeling met zijn account verbindt — bijvoorbeeld een AI-assistent als Claude van Anthropic PBC, VS. Dat zijn geen door ons ingeschakelde dienstverleners, maar ontvangers op instructie van het betreffende bedrijf; zonder die verbinding vloeien daarheen geen gegevens. Anthropic is volgens de officiële deelnemerslijst van het Amerikaanse ministerie van Handel niet gecertificeerd onder het EU-US Data Privacy Framework; een doorgifte baseert zich daarom op de standaardcontractbepalingen, waarvoor het betreffende bedrijf als verwerkingsverantwoordelijke moet instaan.",
          ],
        },
      ],
    },
    {
      heading: "Doorgifte naar derde landen",
      paragraphs: [
        "De verwerking vindt in beginsel binnen de EU plaats. Bij de hierboven genoemde diensten met een vestiging buiten de EU kan het tot een doorgifte naar een derde land komen.",
        "Voor Groq, Inc. en Cloudflare, Inc. (VS) baseren wij de doorgifte op de standaardcontractbepalingen van de Europese Commissie op grond van art. 46, lid 2, onder c, AVG, voor zover de ontvanger zich niet op een adequaatheidsbesluit (EU-US Data Privacy Framework) kan beroepen.",
        "Contractpartner van de betalingsverwerking is Stripe Payments Europe, Limited (Ierland). Voor zover Stripe daarbij gebruikmaakt van Stripe, LLC (VS), is deze gecertificeerd onder het EU-US Data Privacy Framework; de doorgifte baseert zich in zoverre op het adequaatheidsbesluit van de Europese Commissie op grond van art. 45 AVG. Aanvullend gelden de standaardcontractbepalingen uit de [verwerkersovereenkomst van Stripe](https://stripe.com/legal/dpa).",
        "Voor Channex.io Ltd (Verenigd Koninkrijk) geldt het adequaatheidsbesluit van de Europese Commissie voor het Verenigd Koninkrijk; vervalt dat, dan gelden de standaardcontractbepalingen.",
      ],
    },
    {
      heading: "Toegang door autoriteiten van derde staten (US CLOUD Act)",
      paragraphs: [
        "Aanbieders die onder Amerikaanse rechtsmacht vallen, kunnen op grond van de Amerikaanse CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) worden verplicht gegevens aan Amerikaanse autoriteiten te verstrekken — ook wanneer die gegevens op servers binnen de Europese Unie staan. Een dergelijke toegang kan in strijd zijn met de AVG, en de aanbieder kan er juridisch van worden weerhouden ons of u daarover te informeren. Noch het adequaatheidsbesluit over het EU-US Data Privacy Framework noch de standaardcontractbepalingen sluiten dit risico uit.",
        "Wij beperken dit risico doordat de dragende systemen — platform, database, media, mailserver en back-ups — bij Europese aanbieders binnen de EU worden geëxploiteerd en daar geen Amerikaanse rechtsmacht geldt.",
      ],
      unterpunkte: [
        {
          titel: "Betrokken diensten",
          paragraphs: [
            "Amerikaanse rechtsmacht komt uitsluitend in aanmerking bij de volgende, duidelijk afgebakende aanvullende diensten:",
          ],
          list: [
            "Groq, Inc. (VS) — antwoordsuggesties in de berichtenmap, alleen wanneer het bedrijf de functie activeert. Doorgegeven wordt de betreffende berichtcontext.",
            "Cloudflare, Inc. (VS) — DNS-beheer voor klantdomeinen. Doorgegeven worden domein- en configuratiegegevens, geen gastgegevens.",
            "Google LLC (VS) — bij aanmelding met Google, bij vertalingen en bij bereikmeting (Google Analytics 4, alleen met toestemming); contractpartner is Google Ireland Limited, toegang door het Amerikaanse moederbedrijf is echter niet uitgesloten.",
          ],
        },
        {
          titel: "Vermijdbaarheid",
          paragraphs: [
            "Het gebruik van het platform is zonder deze diensten mogelijk: de antwoordsuggesties zijn uit te schakelen, het DNS-beheer betreft alleen klanten met een eigen domein, en het aanmelden met Google is een vrijwillig alternatief voor de aanmelding met e-mailadres en wachtwoord.",
          ],
        },
        {
          titel: "Afbakening ten opzichte van Europees recht",
          paragraphs: [
            "De CLOUD Act is Amerikaans recht, geen recht van de Europese Unie. Hij moet worden onderscheiden van de EU Data Act (Verordening (EU) 2023/2854), die overstap en portabiliteit bij gegevensverwerkingsdiensten regelt, en van de Cloud and AI Development Act, die zich op het moment van deze verklaring in de Europese wetgevingsprocedure bevindt.",
          ],
        },
      ],
    },
    {
      heading: "Bewaartermijnen",
      list: [
        "Accountgegevens: voor de duur van de zakelijke relatie; daarna verwijdering, voor zover geen bewaarplicht bestaat.",
        "Boekings-, factuur- en betaalgegevens: op grond van de Deense boekhoudwet vijf jaar na het einde van het boekjaar waaraan zij zijn toe te rekenen; bij klanten met een vestiging in Duitsland kunnen langere handels- en fiscaalrechtelijke termijnen gelden.",
        "Berichten en gastgegevens in het platform: volgens instructie van het verantwoordelijke bedrijf, uiterlijk tot de verwijdering door dat bedrijf respectievelijk tot het einde van de overeenkomst.",
        "Nieuwsbrief: tot de intrekking van de toestemming; onbevestigde aanmeldingen verlopen na zeven dagen. Het bewijs van toestemming en afmelding blijft daarnaast bewaard zolang het als bewijs nodig is.",
        "Aanmeldlogboeken en veiligheidsgebeurtenissen: kortlopend voor de herkenning van aanvallen.",
        "Serverlogbestanden: slechts zo lang als voor exploitatie en veiligheid noodzakelijk is.",
        "Back-ups: roulerend, tot zij door nieuwere back-ups worden vervangen.",
      ],
    },
    {
      heading: "Uw rechten",
      paragraphs: [
        "U hebt het recht op inzage (art. 15), rectificatie (art. 16), verwijdering (art. 17), beperking van de verwerking (art. 18), gegevensoverdraagbaarheid (art. 20) en bezwaar tegen verwerkingen op grond van gerechtvaardigde belangen (art. 21 AVG). Een gegeven toestemming kunt u op elk moment met werking voor de toekomst intrekken.",
        `Wend u daarvoor tot [${ANBIETER.email}](mailto:${ANBIETER.email}). Betreffen uw gegevens het gebruik van het platform door een bedrijf, dan leiden wij uw verzoek door naar het verantwoordelijke bedrijf of ondersteunen wij dat bedrijf bij de beantwoording.`,
        `U kunt ook een klacht indienen bij een toezichthoudende autoriteit voor gegevensbescherming — voor ons is ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}) bevoegd. U kunt zich ook wenden tot de toezichthoudende autoriteit van uw woonplaats.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Nicht mit „Ihre Rechte" zusammenlegen.
      heading: "Account en app-gegevens verwijderen",
      paragraphs: [
        "De verwijdering van uw account kunt u op elk moment zelf aanvragen — in de app onder ‘Profiel → Account’ of via ons formulier op het web:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "De weg via het web werkt bewust ook wanneer u de app niet meer hebt geïnstalleerd of zich niet meer kunt aanmelden. Ter bescherming tegen misbruik gebeurt dat in twee stappen: u vult het e-mailadres van uw account in en ontvangt op precies dat adres een bevestigingslink. Pas het aanroepen daarvan maakt de aanvraag geldig — een ingevuld adres alleen bewerkstelligt niets. Wij behandelen de aanvraag binnen 30 dagen en antwoorden per e-mail.",
        "Met het account verwijderen wij uw toegangsgegevens, uw profiel, uw object- en agendagegevens en uw berichten. Niet verwijderd worden stukken waarvoor een wettelijke bewaarplicht bestaat — in het bijzonder facturen en boekingsbewijzen van afgerekende periodes (boekhoudplicht naar Deens recht, in de regel vijf jaar). Deze stukken worden voor de duur van de termijn geblokkeerd, dus uitsluitend ter nakoming van die plicht bewaard en daarna verwijderd.",
      ],
    },
    {
      heading: "Beveiliging van de verwerking",
      paragraphs: [
        "Wij beveiligen de verwerking met technische en organisatorische maatregelen op grond van art. 32 AVG, in het bijzonder: doorlopende transportversleuteling (TLS), mandantgebonden toegangsregels direct in de database, rolgebaseerde bevoegdheden met scheiding van financiële en servicegegevens, optionele tweefactorauthenticatie, begrenzing van aanmeldpogingen, versleutelde back-ups met regelmatige hersteltest en het vastleggen van veiligheidsrelevante gebeurtenissen.",
      ],
    },
    {
      heading: "Verplichting tot verstrekking",
      paragraphs: [
        "De gegevens die wij voor het sluiten van de overeenkomst, de afrekening en wettelijke verplichtingen nodig hebben, zijn noodzakelijk — zonder die gegevens kunnen wij het platform niet aanbieden. Alle overige gegevens zijn vrijwillig.",
      ],
    },
    {
      heading: "Wijzigingen van deze verklaring",
      paragraphs: [
        "Wij passen deze verklaring aan wanneer de verwerking, de ingeschakelde dienstverleners of de rechtssituatie veranderen. Telkens geldt de hier gepubliceerde versie; de datum bovenaan geeft de stand weer.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte Export
// bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
