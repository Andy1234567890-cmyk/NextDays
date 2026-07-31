import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Betalingen & facturen",
  description: "Betalingsproviders, betaalregels en facturen.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Betalingen",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Betalingsprovider koppelen",
          excerpt:
            "Zo koppelt u Stripe of PayPal aan myNextDays om betalingen automatisch af te handelen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Beschikbare providers" },
            {
              type: "p",
              text: "myNextDays handelt betalingen af via gekoppelde betalingsproviders. Momenteel worden Stripe en PayPal ondersteund — u kunt één of beide providers tegelijk koppelen en afhankelijk van object of gastvoorkeur gebruiken.",
            },
            {
              type: "steps",
              items: [
                "Open Account en ga naar het onderdeel “Betalingen”.",
                "Kies de gewenste provider — Stripe of PayPal.",
                "Volg de koppelingsdialoog en meld u aan bij de provider of maak een nieuw account aan.",
                "Bevestig de koppeling — de status wisselt naar “gekoppeld”.",
              ],
            },
            { type: "h2", text: "Wat er daarna gebeurt" },
            {
              type: "p",
              text: "Zodra een provider is gekoppeld, kunt u betaallinks versturen, aanbetalingen innen en terugbetalingen direct vanuit de boeking starten. Alle bedragen worden verwerkt in de bij het betreffende object vastgelegde valuta.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder gekoppelde provider kunt u betalingen alleen handmatig als ontvangen markeren — een automatische incasso is dan niet mogelijk.",
            },
            { type: "h2", text: "Meerdere objecten, één provider" },
            {
              type: "p",
              text: "Een eenmaal tot stand gebrachte koppeling geldt accountbreed voor al uw objecten. Hoe de incasso in detail verloopt, legt u vast via [Betaalregels](/hilfe/zahlungen/zahlungsregeln). Uitbetalingen aan u verlopen vervolgens via de betreffende provider, zie [Uitbetalingen](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe is geschikt voor kaartbetalingen en veel lokale betaalmethoden",
                "PayPal biedt gasten een vertrouwd alternatief",
                "Beide providers zijn onafhankelijk van elkaar te ontkoppelen en opnieuw te koppelen",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Betaalregels",
          excerpt: "Bepaal wanneer de aanbetaling en restbetaling van een boeking verschuldigd zijn.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Aanbetaling en restbetaling" },
            {
              type: "p",
              text: "Betaalregels bepalen hoe een boeking financieel wordt afgehandeld — bijvoorbeeld een aanbetaling bij het boeken en een restbetaling vóór aankomst, of de volledige betaling direct. De regels gelden per object en zijn op elk moment aan te passen.",
            },
            {
              type: "steps",
              items: [
                "Open het object en ga naar het onderdeel “Betaalregels”.",
                "Kies of een aanbetaling wordt geïnd en bepaal het aandeel.",
                "Bepaal wanneer de restbetaling verschuldigd wordt, bijvoorbeeld een bepaald aantal dagen vóór aankomst.",
                "Sla de instellingen op.",
              ],
            },
            { type: "h2", text: "Automatische incasso" },
            {
              type: "p",
              text: "Is een betalingsprovider gekoppeld, dan int myNextDays aanbetaling en restbetaling automatisch op het vastgelegde moment en informeert de gast vooraf per bericht.",
            },
            {
              type: "note",
              variant: "info",
              text: "Betaalregels werken alleen bij boekingen met een gekoppelde betalingsprovider. Zonder provider markeert u betalingen handmatig in de boeking.",
            },
            { type: "h2", text: "Verschillen per kanaal" },
            {
              type: "p",
              text: "Op portalen kan afwijkend hun eigen betalingsafhandeling gelden — controleer in dat geval de betreffende portaalvoorwaarden. Voor boekingen via het eigen platform of de website gelden altijd uw hier vastgelegde regels. Details over de providerkoppeling vindt u onder [Betalingsprovider koppelen](/hilfe/zahlungen/zahlungsanbieter-verbinden), over facturering onder [Facturen aanmaken](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Aanbetaling als vast bedrag of percentage mogelijk",
                "Termijn voor de restbetaling vrij te kiezen",
                "Wijzigingen werken alleen door op nieuwe boekingen, niet met terugwerkende kracht",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Facturen aanmaken",
          excerpt: "Zo maakt u voor een boeking een factuur aan met correct factuuradres.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Factuur aanmaken" },
            {
              type: "p",
              text: "Voor elke boeking kan een factuur worden aangemaakt — voor de gast zelf of voor een afwijkend bedrijf, wanneer de boeking zakelijk plaatsvindt.",
            },
            {
              type: "steps",
              items: [
                "Open de boeking in Reserveringen.",
                "Kies “Factuur aanmaken”.",
                "Controleer of vul het factuuradres aan.",
                "Controleer de vermelde posten — overnachting, add-ons, kosten.",
                "Maak de factuur aan en verstuur deze naar de gast.",
              ],
            },
            { type: "h2", text: "Factuuradres beheren" },
            {
              type: "p",
              text: "Het factuuradres kunt u direct in de boeking vastleggen of door de gast via de boekingsbevestiging laten aanvullen. Zonder volledig adres kan in bepaalde landen geen rechtsgeldige factuur worden uitgereikt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Controleer bij zakelijke klanten in het bijzonder bedrijfsnaam en adres — correcties achteraf vereisen een creditfactuur.",
            },
            { type: "h2", text: "Bedragen en valuta" },
            {
              type: "p",
              text: "Alle posten worden weergegeven in de voor het object vastgelegde valuta. Reeds ontvangen betalingen worden op de factuur als betalingsontvangst vermeld. Hoe aanbetaling en restbetaling tot stand komen, leest u onder [Betaalregels](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Facturen zijn als PDF te downloaden",
                "Creditfacturen zijn bij wijzigingen op elk moment mogelijk",
                "Add-ons verschijnen als aparte post",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Terugbetalingen",
          excerpt:
            "Zo betaalt u een betaling geheel of gedeeltelijk terug wanneer een boeking wordt geannuleerd of gewijzigd.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Wanneer een terugbetaling nodig is" },
            {
              type: "p",
              text: "Een terugbetaling komt doorgaans voor bij een annulering, maar kan ook nodig zijn bij een latere prijsaanpassing of een geannuleerde add-on.",
            },
            {
              type: "steps",
              items: [
                "Open de betreffende boeking in Reserveringen.",
                "Kies “Terugbetaling” in het betalingsonderdeel van de boeking.",
                "Voer het terug te betalen bedrag in — volledig of gedeeltelijk.",
                "Bevestig de terugbetaling.",
              ],
            },
            { type: "h2", text: "Verloop via de betalingsprovider" },
            {
              type: "p",
              text: "De terugbetaling wordt uitgevoerd via de bij de betaling gebruikte provider — Stripe of PayPal — en direct teruggestort op het oorspronkelijke betaalmiddel van de gast. Het proces wordt automatisch vermeld in de boekingstijdlijn.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder gekoppelde betalingsprovider kan een terugbetaling niet automatisch worden gestart — regel de terugbetaling in dat geval rechtstreeks met de gast.",
            },
            { type: "h2", text: "Gevolgen voor provisies" },
            {
              type: "p",
              text: "Reeds afgerekende platform-marktplaats- of portaalprovisies worden bij een terugbetaling naar rato aangepast. Meer hierover onder [Provisies begrijpen](/hilfe/zahlungen/provisionen-verstehen). Details over de annulering zelf vindt u onder [Annulering & terugbetaling](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Gedeeltelijke terugbetalingen zijn mogelijk voor afzonderlijke posten",
                "De verwerkingsstatus is altijd zichtbaar in de boeking",
                "Terugbetalingen verlopen uitsluitend via de oorspronkelijk gebruikte provider",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Uitbetalingen",
          excerpt:
            "Zo ontvangt u de opbrengsten van uw boekingen uitbetaald door de gekoppelde betalingsproviders.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Hoe uitbetalingen werken" },
            {
              type: "p",
              text: "Binnenkomende betalingen komen eerst samen bij de gekoppelde betalingsprovider. Van daaruit vindt de uitbetaling plaats naar uw vastgelegde bankrekening volgens het gebruikelijke ritme van de provider.",
            },
            {
              type: "steps",
              items: [
                "Open Account en ga naar het onderdeel “Betalingen”.",
                "Controleer onder “Uitbetalingen” de status van de betreffende provider.",
                "Open indien gewenst de detailweergave van de provider voor de volledige uitbetalingshistorie.",
              ],
            },
            { type: "h2", text: "Wat vóór de uitbetaling wordt afgetrokken" },
            {
              type: "p",
              text: "Vóór de uitbetaling worden geldende platform-marktplaats- en portaalprovisies, evenals providerkosten, verrekend. Het uitbetaalde bedrag komt dus niet noodzakelijk overeen met het oorspronkelijke boekingsbedrag.",
            },
            {
              type: "note",
              variant: "info",
              text: "De precieze opbouw van de aftrekposten wordt uitgelegd in [Provisies begrijpen](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Meerdere objecten en eigenaren" },
            {
              type: "p",
              text: "Beheert u objecten voor verschillende eigenaren, dan worden uitbetalingen toegewezen aan de vastgelegde eigenaarsafrekeningen. Controleer bij afwijkingen eerst de status van de onderliggende boekingen in Reserveringen.",
            },
            {
              type: "ul",
              items: [
                "Uitbetalingsritme en -methode worden door de betreffende provider bepaald",
                "Ingehouden bedragen, bijvoorbeeld bij lopende terugbetalingen, zijn gemarkeerd",
                "De volledige historie is rechtstreeks bij de provider te raadplegen",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Provisies begrijpen",
          excerpt:
            "Een overzicht van hoe platform-marktplaats- en portaalprovisies zijn opgebouwd en waar ze worden afgerekend.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Twee soorten provisies" },
            {
              type: "p",
              text: "Bij boekingen via myNextDays kunnen twee verschillende provisies ontstaan: de platform-marktplaatsprovisie voor boekingen via het eigen platform, en portaalprovisies voor boekingen die via gekoppelde portalen zoals Booking of Airbnb binnenkomen. Beide staan los van elkaar en kunnen, afhankelijk van het verkoopkanaal van een boeking, verschillend uitvallen.",
            },
            {
              type: "ul",
              items: [
                "Platform-marktplaatsprovisie: geldt bij boekingen via het myBestDays-platform",
                "Portaalprovisie: wordt door het betreffende portaal volgens diens eigen voorwaarden berekend",
                "Directe boekingen via uw eigen website staan hier los van",
              ],
            },
            { type: "h2", text: "Waar provisies zichtbaar zijn" },
            {
              type: "steps",
              items: [
                "Open Account en ga naar het onderdeel “Afrekening”.",
                "Kies de gewenste maand.",
                "Controleer het overzicht per boeking met bijbehorende provisie.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Via welk kanaal een boeking binnenkwam, ziet u direct bij de boeking zelf — dat verklaart welke provisie telkens is toegepast.",
            },
            { type: "h2", text: "Verband met uitbetalingen" },
            {
              type: "p",
              text: "Provisies worden vóór de uitbetaling van het boekingsbedrag afgetrokken. Details over het uitbetalingsproces vindt u onder [Uitbetalingen](/hilfe/zahlungen/auszahlungen). Bij een terugbetaling wordt de bijbehorende provisie naar rato gecorrigeerd — het volledige verloop van een boeking toont de [boekingstijdlijn](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
