import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Aan de slag",
  description: "Account instellen en binnen enkele minuten beginnen.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Instellen",
      articles: [
        {
          slug: "willkommen",
          title: "Welkom bij myNextDays",
          excerpt: "Een overzicht van PMS, kanaalbeheer, marktplaats en app.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays is uw centrale platform voor vakantieobjecten en hotels. In plaats van meerdere losse oplossingen beheert u beschikbaarheid, prijzen, reserveringen en gastcommunicatie op één plek — of u nu één vakantiehuis of meerdere hotelkamers exploiteert.",
            },
            { type: "h2", text: "De vier bouwstenen" },
            {
              type: "ul",
              items: [
                "PMS (property management system): objecten, kalender, prijzen, reserveringen, taken en betalingen.",
                "Kanaalbeheer: koppeling met portalen zoals Booking, Airbnb & Co. — één invoer, veel portalen synchroon.",
                "Platform-marktplaats: de eigen myNextDays-marktplaats, een gelijkwaardig boekingskanaal naast de portalen.",
                "App: de mobiele applicatie voor gasten, eigenaren en medewerkers met dezelfde gegevens als op het web.",
              ],
            },
            { type: "h2", text: "Hoe de bouwstenen samenwerken" },
            {
              type: "p",
              text: "U onderhoudt object, prijzen en beschikbaarheid één keer centraal in het PMS. Van daaruit verdeelt myNextDays de gegevens automatisch naar alle actieve kanalen. Een boeking — via welk kanaal dan ook — blokkeert direct de bijbehorende nachten overal, zodat dubbele boekingen uitgesloten zijn.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Begin met Account & bedrijf instellen, daarna uw eerste object aanmaken — deze volgorde bespaart u later correcties.",
            },
            { type: "h2", text: "Volgende stappen" },
            {
              type: "steps",
              items: [
                "Open in het menu Account en vul uw bedrijfsgegevens aan.",
                "Maak onder Objecten uw eerste object aan.",
                "Controleer voorzieningen, foto's en prijzen op volledigheid.",
                "Klik op Publiceren om het object op alle kanalen zichtbaar te maken.",
              ],
            },
            {
              type: "p",
              text: "Meer over de afzonderlijke stappen vindt u onder [Account & bedrijf instellen](/hilfe/erste-schritte/konto-einrichten) en [Uw eerste object aanmaken](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Account & bedrijf instellen",
          excerpt: "Bedrijfsgegevens, factuuradres en valuta correct vastleggen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Voordat u objecten aanmaakt, stelt u uw bedrijf in bij het account. Deze gegevens zijn nodig voor facturen, portalen en de afrekening met myNextDays en moeten daarom volledig en correct zijn.",
            },
            { type: "h2", text: "Bedrijfsgegevens vastleggen" },
            {
              type: "steps",
              items: [
                "Open in het menu Account.",
                "Vul onder Bedrijfsgegevens de bedrijfsnaam respectievelijk de naam van de eenmanszaak, het adres en de contactgegevens in.",
                "Leg het factuuradres vast — dit verschijnt op alle uitgereikte facturen.",
                "Kies uw basisvaluta. Deze geldt voor alle prijzen, tot u deze gericht per object wijzigt.",
              ],
            },
            { type: "h2", text: "Waarom de valuta belangrijk is" },
            {
              type: "p",
              text: "De valuta wordt niet geraden of automatisch aangevuld: ontbreekt deze, dan kan geen enkele prijs correct worden weergegeven of afgerekend. Daarom vraagt myNextDays bij het instellen om een bewuste keuze, in plaats van een standaardwaarde in te vullen.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Wijzigt u achteraf de valuta van een object, dan worden alle daaraan gekoppelde prijsplannen mee omgezet. Controleer daarna eenmalig de prijzen.",
            },
            { type: "h2", text: "Factuuradres & afrekening" },
            {
              type: "p",
              text: "Onder Afrekening in het account ziet u uw lopende facturen en het vastgelegde factuuradres. Houd dit actueel, vooral bij een wijziging van de rechtsvorm of het adres, zodat facturen correct worden uitgereikt.",
            },
            {
              type: "ul",
              items: [
                "Bedrijfsnaam respectievelijk naam van de eenmanszaak",
                "Factuuradres met land",
                "Btw-nummer, indien van toepassing",
                "Basisvaluta voor nieuwe objecten",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Uw eerste object aanmaken",
          excerpt: "Zo maakt u stap voor stap uw eerste boekbare object aan.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Een object in myNextDays is altijd precies één boekbare eenheid: ofwel één afzonderlijke kamer in een hotel, ofwel een compleet vakantieobject. Exploiteert u een hotel met meerdere kamers, maak dan voor elke kamer een eigen object aan.",
            },
            { type: "h2", text: "Object aanmaken" },
            {
              type: "steps",
              items: [
                "Open in het menu Objecten.",
                "Klik op Object toevoegen.",
                "Kies het objecttype: categorie, vastgoedtype en aanbodsoort.",
                "Vul adres, bezetting en basisprijs in uw vastgelegde valuta aan.",
                "Sla het object op als concept om het later te voltooien.",
              ],
            },
            { type: "h2", text: "Wat daarna nog ontbreekt" },
            {
              type: "p",
              text: "Een nieuw aangemaakt object is aanvankelijk een concept en op geen enkel kanaal zichtbaar. Vul voorzieningen, foto's, beschrijving en kalenderbeschikbaarheid aan voordat u het publiceert — alleen een volledig object is betrouwbaar te vermarkten.",
            },
            {
              type: "ul",
              items: [
                "Voorzieningskenmerken uit de categorielijst selecteren",
                "Minstens één titelfoto en een beschrijving vastleggen",
                "Bezetting (volwassenen, kinderen, bedden) correct invullen",
                "Basisprijs en kalenderbeschikbaarheid controleren",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Exploiteert u meerdere kamertypes, herhaal dan dit proces voor elke afzonderlijke kamer — er is geen overkoepelend gebouwniveau met kamers daaronder.",
            },
            {
              type: "p",
              text: "Zijn alle verplichte velden ingevuld, dan kunt u het object publiceren, zie [Een object publiceren](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Een object publiceren",
          excerpt: "Eén klik schakelt platform-marktplaats, portalen en website gezamenlijk vrij.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Publiceren maakt een object zichtbaar en boekbaar. Normaal gesproken volstaat één klik om alle drie de verkoopkanalen tegelijk te activeren — u kunt de zichtbaarheid per kanaal echter altijd afzonderlijk aanpassen.",
            },
            { type: "h2", text: "Zo publiceert u" },
            {
              type: "steps",
              items: [
                "Open het object onder Objecten.",
                "Controleer in het tabblad Overzicht of alle verplichte gegevens groen zijn gemarkeerd.",
                "Klik op Publiceren.",
                "Bevestig het dialoogvenster — platform-marktplaats, portalen en website worden geactiveerd.",
              ],
            },
            { type: "h2", text: "Kanalen afzonderlijk aansturen" },
            {
              type: "p",
              text: "Na publicatie vindt u in het tabblad Zichtbaarheid drie afzonderlijke schakelaars: website, platform-marktplaats en portalen. Wilt u een object bijvoorbeeld alleen op uw eigen website aanbieden, maar niet via portalen, zet dan gewoon de betreffende schakelaar uit.",
            },
            {
              type: "ul",
              items: [
                "Website: zichtbaarheid op uw eigen myNextDays-website",
                "Platform-marktplaats: zichtbaarheid op de wereldwijde myNextDays-marktplaats",
                "Portalen: zichtbaarheid op Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Deze drie schakelaars staan los van de objectstatus (actief/inactief). Een actief object kan toch op afzonderlijke kanalen onzichtbaar zijn.",
            },
            { type: "h2", text: "Object tijdelijk blokkeren" },
            {
              type: "p",
              text: "Wilt u een afzonderlijke dag in plaats van het hele object blokkeren, gebruik dan stopverkoop in de kalender — dit blokkeert de dag op alle kanalen tegelijk, los van de zichtbaarheidsschakelaars.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "De drie verkoopkanalen begrijpen",
          excerpt: "Portalen, platform-marktplaats en app in overzicht.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays vermarkt elk object tegelijk via meerdere gelijkwaardige wegen. Begrijpen hoe deze samenwerken helpt u om zichtbaarheid en prijzen gericht te sturen.",
            },
            { type: "h2", text: "Portalen" },
            {
              type: "p",
              text: "Via het kanaalbeheer koppelt u uw object aan grote boekingsportalen zoals Booking, Airbnb & Co. Beschikbaarheid en prijzen worden automatisch gesynchroniseerd, zodat u niet meerdere portaalkalenders handmatig hoeft bij te houden.",
            },
            { type: "h2", text: "Platform-marktplaats" },
            {
              type: "p",
              text: "De myNextDays-marktplaats is een eigen, wereldwijd boekingskanaal — vergelijkbaar met Booking of Airbnb, maar onderdeel van hetzelfde platform. Het is geen vervanging voor “directe boeking”, maar een gelijkwaardig kanaal met een eigen zichtbaarheidsas.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "De mobiele app biedt gasten, eigenaren en medewerkers toegang tot dezelfde gegevens als het web — zoals boekingsdetails, berichten of taken, afhankelijk van de betreffende rol.",
            },
            { type: "h2", text: "Drie afzonderlijke zichtbaarheidsassen" },
            {
              type: "ul",
              items: [
                "Website — uw eigen myNextDays-website",
                "Platform-marktplaats — de wereldwijde myNextDays-marktplaats",
                "Portalen — Booking, Airbnb & Co. via het kanaalbeheer",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Alle drie de assen zijn onafhankelijk van elkaar te schakelen. Stopverkoop en de objectstatus werken daarentegen kanaaloverstijgend op alle drie tegelijk.",
            },
          ],
        },
      ],
    },
  ],
};
