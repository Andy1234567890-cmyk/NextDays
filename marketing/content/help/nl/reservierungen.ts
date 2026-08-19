import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Reserveringen & boekingen",
  description: "Boekingen beheren, verplaatsen en annuleren.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Boekingen",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Een boeking handmatig vastleggen",
          excerpt:
            "Zo legt u een telefonisch of per e-mail binnengekomen boeking direct vast in myNextDays.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Wanneer u handmatig vastlegt" },
            {
              type: "p",
              text: "Niet elke boeking komt binnen via een portaal of uw eigen platform — aanvragen per telefoon, e-mail of ter plaatse moet u zelf aanmaken, zodat het object in myNextDays correct wordt geblokkeerd en er geen dubbele boeking ontstaat.",
            },
            {
              type: "steps",
              items: [
                "Open Reserveringen en klik op “Nieuwe boeking”.",
                "Kies het object — elk object in myNextDays is één afzonderlijke boekbare eenheid, dus een bepaalde kamer of vakantiewoning.",
                "Bepaal aankomst en vertrek en het aantal gasten.",
                "Leg de gastgegevens vast (naam, contactgegevens, eventueel adres voor de factuur).",
                "Controleer de voorgestelde prijs en pas deze zo nodig aan.",
                "Sla de boeking op — de nachten worden meteen geblokkeerd in de kalender.",
              ],
            },
            { type: "h2", text: "Betaling en bevestiging" },
            {
              type: "p",
              text: "Na het opslaan gelden dezelfde betaalregels als bij online boekingen. Is er een betalingsprovider gekoppeld, dan kunt u direct een betaallink naar de gast sturen of de betaling handmatig als ontvangen markeren.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Noteer bijzondere wensen (vroege aankomst, extra bedden) meteen in de notities — het team ziet deze in de boekingstijdlijn.",
            },
            { type: "h2", text: "Na het aanmaken" },
            {
              type: "p",
              text: "De nieuwe boeking verschijnt meteen in [De boekingstijdlijn](/hilfe/reservierungen/buchungs-zeitleiste), met alle verdere stappen zoals berichten, taken en betalingen op één plek.",
            },
            {
              type: "ul",
              items: [
                "Kalender en portalen worden automatisch gesynchroniseerd zodra u opslaat.",
                "De gast ontvangt indien gewenst een automatisch bevestigingsbericht.",
                "Wijzigingen in data legt u vast via “Boeking verplaatsen”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "De boekingstijdlijn",
          excerpt:
            "De boekingstijdlijn bundelt het volledige verloop van een reservering op één plek.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Wat de tijdlijn toont" },
            {
              type: "p",
              text: "Elke reservering heeft een eigen tijdlijn die het volledige verloop chronologisch weergeeft — van de boekingsaanvraag of de portaalimport tot de check-out. Zo ziet u in één oogopslag wat al is gebeurd en wat er als volgende stap aankomt.",
            },
            {
              type: "ul",
              items: [
                "Berichten met de gast",
                "Taken, bijvoorbeeld schoonmaak of voorbereiding",
                "Betalingen en facturen",
                "Geboekte add-ons en extra diensten",
                "Verplaatsingen (move) en annuleringen",
              ],
            },
            { type: "h2", text: "De tijdlijn dagelijks gebruiken" },
            {
              type: "steps",
              items: [
                "Open Reserveringen en kies de gewenste boeking.",
                "Ga naar het tabblad “Tijdlijn”.",
                "Scrol chronologisch door alle gebeurtenissen.",
                "Gebruik de snelacties om direct een bericht te versturen of een taak aan te maken.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Wordt een boeking verplaatst of geannuleerd, dan verschijnt deze stap ook in de tijdlijn — inclusief de in de kalender vrijgegeven nachten.",
            },
            { type: "h2", text: "Waarom dit belangrijk is" },
            {
              type: "p",
              text: "Omdat team, eigenaar en support dezelfde tijdlijn zien, ontstaan er geen informatiegaten tussen berichten, taken en betalingen. Details over terugbetalingen vindt u onder [Terugbetalingen](/hilfe/zahlungen/rueckerstattungen), over extra diensten onder [Add-ons & extra diensten](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Een boeking verplaatsen",
          excerpt:
            "Zo verplaatst u een bestaande boeking naar een nieuwe periode, zonder de kalender in de war te brengen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Controleren vóór het verplaatsen" },
            {
              type: "p",
              text: "Voordat u een boeking verplaatst, controleert u de beschikbaarheid in de nieuwe periode voor het geboekte object. myNextDays geeft de oorspronkelijk gereserveerde nachten pas vrij zodra de nieuwe periode is bevestigd — zo ontstaat er geen gat waarin het object ten onrechte als vrij of dubbel bezet geldt.",
            },
            {
              type: "steps",
              items: [
                "Open de boeking in Reserveringen.",
                "Kies “Verplaatsen” en voer de nieuwe periode in.",
                "Controleer de weergegeven beschikbaarheid voor de nieuwe data.",
                "Bevestig de verplaatsing.",
                "Controleer of de prijs verandert door het nieuwe aantal nachten en pas deze zo nodig aan.",
              ],
            },
            { type: "h2", text: "Wat er automatisch gebeurt" },
            {
              type: "p",
              text: "Na de bevestiging worden de oude nachten correct vrijgegeven in de kalender en de nieuwe nachten geblokkeerd; gekoppelde portalen worden bijgewerkt. Het proces wordt vastgelegd in de boekingstijdlijn.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Is de boeking via een portaal binnengekomen, dan kan een verplaatsing daar aan eigen regels onderhevig zijn — controleer de portaalvoorwaarden voordat u grotere wijzigingen doorvoert.",
            },
            { type: "h2", text: "Betalingsverschillen" },
            {
              type: "p",
              text: "Verandert de prijs door de verplaatsing, pas dan de betaalregels dienovereenkomstig aan — zie [Betaalregels](/hilfe/zahlungen/zahlungsregeln). Meer over het volledige verloop van een boeking vindt u onder [De boekingstijdlijn](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Annulering & terugbetaling",
          excerpt:
            "Zo annuleert u een boeking correct en start u indien nodig een terugbetaling.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Boeking annuleren" },
            {
              type: "p",
              text: "Een annulering geeft het object voor de geboekte periode meteen weer vrij — zowel in uw kalender als op alle gekoppelde portalen. Controleer vóór de annulering welke annuleringsvoorwaarden voor deze boeking gelden.",
            },
            {
              type: "steps",
              items: [
                "Open de boeking in Reserveringen.",
                "Kies “Annuleren” en geef een reden op.",
                "Controleer het voorgestelde terugbetalingsbedrag.",
                "Bevestig de annulering.",
              ],
            },
            { type: "h2", text: "Terugbetaling starten" },
            {
              type: "p",
              text: "Is de betaling via een gekoppelde betalingsprovider afgehandeld, dan kunt u de terugbetaling direct vanuit de boeking starten. Het bedrag wordt weergegeven in de bij dit object vastgelegde valuta. Details over het verloop vindt u onder [Terugbetalingen](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Volledige of gedeeltelijke terugbetaling mogelijk",
                "Het proces verschijnt in de boekingstijdlijn",
                "Bij portaalboekingen gelden bovendien de regels van het betreffende portaal",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een annulering kan niet ongedaan worden gemaakt. Controleer periode en gast zorgvuldig voordat u bevestigt.",
            },
            { type: "h2", text: "Na de annulering" },
            {
              type: "p",
              text: "Het object is vanaf nu weer boekbaar, openstaande taken bij de boeking — zoals de voorbereiding — worden automatisch als niet meer nodig gemarkeerd. Het volledige proces blijft traceerbaar in de [boekingstijdlijn](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in & check-out",
          excerpt: "Zo documenteert u de aankomst en het vertrek van een gast in myNextDays.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Check-in vastleggen" },
            {
              type: "p",
              text: "De check-in markeert het begin van het verblijf en is vooral nuttig bij zelfstandige check-in of sleuteloverdracht door het team, om de status van elke boeking actueel te houden.",
            },
            {
              type: "steps",
              items: [
                "Open de boeking in Reserveringen.",
                "Kies “Check-in” op de aankomstdag.",
                "Leg indien nodig een notitie vast, bijvoorbeeld tijdstip of bijzonderheden.",
              ],
            },
            { type: "h2", text: "Check-out en overdracht" },
            {
              type: "p",
              text: "Bij de check-out markeert u het verblijf als afgerond. Dit activeert in veel gevallen automatisch een schoonmaaktaak voor het object, zodat het wordt voorbereid voor de volgende boeking.",
            },
            {
              type: "ul",
              items: [
                "Check-in en check-out maken deel uit van de boekingstijdlijn",
                "Tijden zijn per object te bepalen in de objectinstellingen",
                "Bij mobiele toegang kan het team check-in en check-out direct ter plaatse vastleggen",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Een gemiste check-out blokkeert volgende taken niet automatisch — controleer achterstallige statussen regelmatig in Reserveringen.",
            },
            { type: "h2", text: "Verband met taken" },
            {
              type: "p",
              text: "Check-in en check-out zijn nauw verbonden met taken en de tijdlijn. Meer over het volledige verloop leest u onder [De boekingstijdlijn](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-ons & extra diensten",
          excerpt:
            "Zo biedt u gasten boekbare extra diensten aan, zoals ontbijt of transfer, en legt u deze vast in de reservering.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Wat add-ons zijn" },
            {
              type: "p",
              text: "Add-ons zijn optionele extra diensten bij een boeking — bijvoorbeeld ontbijt, vroege aankomst, transfer of een late check-out. Ze worden per object vastgelegd en kunnen door de gast zelf of door uw team aan de boeking worden toegevoegd.",
            },
            {
              type: "steps",
              items: [
                "Open het object en maak onder “Add-ons” de gewenste extra diensten met prijs aan.",
                "Open een bestaande boeking in Reserveringen.",
                "Kies “Add-on toevoegen” en selecteer de gewenste dienst.",
                "Bevestig hoeveelheid en tijdstip van de dienst.",
              ],
            },
            { type: "h2", text: "Facturering" },
            {
              type: "p",
              text: "Add-ons worden gefactureerd in de valuta van het betreffende object en verschijnen als aparte post op de factuur. Al betaalde add-ons kunnen bij een annulering naar rato worden terugbetaald.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Leg populaire add-ons eenmalig centraal bij het object vast — zo zijn ze bij elke nieuwe boeking met een paar klikken toe te voegen.",
            },
            { type: "h2", text: "Zichtbaarheid voor de gast" },
            {
              type: "p",
              text: "Is het platform of de eigen website actief, dan kunnen gasten passende add-ons vaak al tijdens het boeken zelf selecteren. Elke toevoeging verschijnt vervolgens in de [boekingstijdlijn](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Add-ons zijn per object afzonderlijk te benoemen en te prijzen",
                "Achteraf toevoegen is altijd mogelijk via de boeking",
                "Geannuleerde add-ons worden naar rato terugbetaald",
              ],
            },
          ],
        },
      ],
    },
  ],
};
