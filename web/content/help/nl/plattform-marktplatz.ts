import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platform (marktplaats)",
  description: "Verkopen op de myNextDays-marktplaats.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marktplaats",
      articles: [
        {
          slug: "der-marktplatz",
          title: "De myNextDays-marktplaats",
          excerpt: "De wereldwijde myNextDays-marktplaats is een eigen boekingskanaal naast portalen en website.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De myNextDays-marktplaats (/plattform) is het wereldwijde boekingskanaal van myNextDays zelf — vergelijkbaar met Booking of Airbnb, maar onderdeel van hetzelfde platform. Gasten doorzoeken daar objecten van alle aangesloten bedrijven en boeken rechtstreeks.",
            },
            { type: "h2", text: "Geen “direct”, maar een gelijkwaardig kanaal" },
            {
              type: "p",
              text: "De marktplaats vervangt geen directe boeking via uw eigen website. Het is een zelfstandige, derde verkoopweg met een eigen zichtbaarheidsas, eigen gastenbestand en eigen commissie — net als een portaal, alleen wordt deze door myNextDays zelf beheerd.",
            },
            { type: "h2", text: "Hoe objecten op de marktplaats komen" },
            {
              type: "ul",
              items: [
                "Het object moet actief zijn (objectstatus staat verkoop toe).",
                "De marktplaatszichtbaarheid moet ingeschakeld zijn — los van portalen en website.",
                "Voor de gewenste periode moet er beschikbaarheid in de kalender zijn.",
              ],
            },
            { type: "h2", text: "Boekingen vanuit de marktplaats" },
            {
              type: "p",
              text: "Een marktplaatsboeking blokkeert de betreffende nachten onmiddellijk op alle andere kanalen — net als een portaal- of websiteboeking. Ze verschijnt in uw kalender en in de reserveringen zoals elke andere boeking, gemarkeerd met het kanaal “Platform”.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stopverkoop en een inactieve objectstatus werken kanaalbreed en blokkeren ook de marktplaats — ongeacht de marktplaatszichtbaarheidsschakelaar.",
            },
            {
              type: "p",
              text: "Hoe u een object voor de marktplaats vrijgeeft, leest u onder [Object op de marktplaats plaatsen](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Object op de marktplaats plaatsen",
          excerpt: "Marktplaatszichtbaarheid is een aparte schakelaar, los van portalen en website.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De zichtbaarheid op de marktplaats regelt u via een aparte schakelaar bij het object — ongeacht of hetzelfde object ook op portalen of uw website zichtbaar is.",
            },
            { type: "h2", text: "Zo plaatst u een object" },
            {
              type: "steps",
              items: [
                "Open het object onder Objecten.",
                "Ga naar het tabblad Zichtbaarheid.",
                "Schakel de schakelaar Platform-marktplaats in.",
                "Controleer of de objectstatus actief is en er kalenderbeschikbaarheid is.",
              ],
            },
            { type: "h2", text: "Vereiste: volledig profiel" },
            {
              type: "p",
              text: "De marktplaats toont alleen objecten met volledige gegevens — titelfoto, beschrijving, voorzieningen en basisprijs moeten zijn ingevuld. Ontbreken verplichte gegevens, dan blijft het object ondanks de ingeschakelde schakelaar onzichtbaar.",
            },
            {
              type: "ul",
              items: [
                "Minstens één titelfoto en een beschrijving",
                "Voorzieningen uit de categorielijst",
                "Bezetting en basisprijs in de vastgelegde objectvaluta",
                "Kalenderbeschikbaarheid voor de gewenste periode",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Klikt u op Publiceren, dan schakelt myNextDays normaliter marktplaats, portalen en website gezamenlijk vrij — u kunt de marktplaatsschakelaar daarna altijd afzonderlijk weer uitschakelen.",
            },
            { type: "h2", text: "Zichtbaarheid weer verwijderen" },
            {
              type: "p",
              text: "Schakelt u de schakelaar Platform-marktplaats uit, dan verdwijnt het object uit de marktplaatszoekresultaten. Reeds bevestigde boekingen blijven hierdoor onaangetast en lopen gewoon door, zie [Marktplaatscommissie](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Marktplaatscommissie",
          excerpt: "Voor elke via de marktplaats tot stand gekomen boeking geldt de in het tarief vastgelegde commissie.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Zoals bij elk boekingsportaal geldt voor boekingen die via de myNextDays-marktplaats tot stand komen een commissie. Deze wordt per boeking berekend en staat los van eventuele commissies voor portalen.",
            },
            { type: "h2", text: "Hoe de commissie wordt berekend" },
            {
              type: "p",
              text: "De hoogte is afhankelijk van de in het tarief van uw bedrijf vastgelegde commissie. U vindt het actuele percentage altijd onder Account in het gedeelte Facturering — daar wordt geen standaardwaarde aangenomen, maar het percentage getoond dat daadwerkelijk voor uw tarief geldt.",
            },
            { type: "h2", text: "Waar u de commissie inziet" },
            {
              type: "steps",
              items: [
                "Open in het menu Account.",
                "Ga naar het gedeelte Facturering.",
                "Open een marktplaatsboeking om omzet en commissie in detail te bekijken.",
                "Controleer het overzicht van de commissies voor de lopende factureringsperiode.",
              ],
            },
            { type: "h2", text: "Onderscheid met portaalcommissies" },
            {
              type: "ul",
              items: [
                "Marktplaatscommissie geldt uitsluitend voor boekingen via de myNextDays-marktplaats.",
                "Portaalboekingen (Booking, Airbnb & co.) vallen onder de voorwaarden van het betreffende portaal.",
                "Websiteboekingen vallen onder de voor uw tarief vastgelegde voorwaarden, zonder marktplaatscommissie.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "De commissie wordt automatisch uit uw tarief afgeleid. Een ontbrekend of onduidelijk tarief leidt tot een duidelijke foutmelding in plaats van een geschatte waarde.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Gastprofiel & beoordelingen",
          excerpt: "Marktplaatsgasten hebben een profiel met boekingsgeschiedenis en kunnen beoordelingen achterlaten.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Gasten die via de myNextDays-marktplaats boeken, maken een eigen gastprofiel aan. Daarin verzamelen zich hun boekingen, berichten met bedrijven en geplaatste beoordelingen — vergelijkbaar met een portaalgastaccount.",
            },
            { type: "h2", text: "Wat u als bedrijf ziet" },
            {
              type: "p",
              text: "In de reserveringsdetails van een marktplaatsboeking vindt u het gastprofiel met eerdere verblijven bij uw bedrijf en, indien door de gast vrijgegeven, openbaar zichtbare beoordelingen van andere accommodaties.",
            },
            { type: "h2", text: "Beoordelingen na het verblijf" },
            {
              type: "steps",
              items: [
                "Na het uitchecken ontvangt de gast een verzoek om een beoordeling.",
                "De beoordeling verschijnt na een korte controle op de objectpagina in de marktplaats.",
                "U kunt als bedrijf openbaar op elke beoordeling reageren.",
                "Onterechte of misbruikte beoordelingen kunt u via Melden ter controle indienen.",
              ],
            },
            {
              type: "ul",
              items: [
                "Beoordelingen zijn gekoppeld aan een daadwerkelijke boeking — geen beoordeling zonder verblijf.",
                "De gast beoordeelt netheid, communicatie, ligging en prijs-kwaliteitverhouding.",
                "Uw reactie is zichtbaar voor alle bezoekers van de marktplaats.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Goede beoordelingen hebben direct invloed op de plaatsing van uw object in de marktplaatszoekresultaten — reageer tijdig en zakelijk op kritiek.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Geblokkeerde personen",
          excerpt: "Een bedrijf kan een gast blokkeren, waardoor berichten en boekingen worden verhinderd.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Ontstaan er problemen met een gast, dan kunt u deze als bedrijf blokkeren. Een geblokkeerde persoon kan u geen berichten meer sturen en geen nieuwe boeking meer aanmaken bij uw bedrijf.",
            },
            { type: "h2", text: "Een persoon blokkeren" },
            {
              type: "steps",
              items: [
                "Open de berichtengeschiedenis of de reservering met de betreffende gast.",
                "Klik op Gast blokkeren.",
                "Bevestig het dialoogvenster — de blokkering geldt onmiddellijk.",
                "De geblokkeerde persoon verschijnt vervolgens in Account onder Geblokkeerde personen.",
              ],
            },
            { type: "h2", text: "Wat de blokkering doet" },
            {
              type: "ul",
              items: [
                "De gast kan geen nieuwe berichten meer naar uw bedrijf sturen.",
                "De gast kan geen nieuwe boeking meer aanmaken bij uw bedrijf.",
                "Een lopende boeking met een reeds bevestigde aankomst binnen de komende twee weken blijft door de blokkering onaangetast, zodat het verblijf ordelijk kan worden afgehandeld.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "De blokkering geldt uitsluitend voor uw bedrijf. Andere bedrijven op de marktplaats zien de blokkering niet en worden er niet door beïnvloed.",
            },
            { type: "h2", text: "Blokkering weer opheffen" },
            {
              type: "p",
              text: "Open Account en daar Geblokkeerde personen. Selecteer de vermelding en klik op Blokkering opheffen — de gast kan daarna weer berichten sturen en boeken.",
            },
          ],
        },
      ],
    },
  ],
};
