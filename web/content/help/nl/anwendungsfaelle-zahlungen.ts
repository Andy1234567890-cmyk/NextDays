import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Betalingen",
  description: "Betalingen correct afhandelen.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Betalingen",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Een aanbetaling instellen",
          excerpt: "Zo vraagt u bij het boeken slechts een deelbedrag in plaats van het volledige bedrag.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "In plaats van het volledige boekingsbedrag meteen te innen, kunt u een aanbetaling als betaalregel vastleggen. De gast betaalt bij het boeken slechts een deelbedrag via Stripe of PayPal, de rest later via een restbetaling.",
            },
            {
              type: "steps",
              items: [
                "Open in het object het onderdeel “Betaalregels”.",
                "Maak een nieuwe regel aan van het type “Aanbetaling”.",
                "Bepaal het aanbetalingsbedrag als percentage of vast bedrag van de totaalsom.",
                "Bepaal wanneer de aanbetaling verschuldigd is, doorgaans direct bij het boeken.",
                "Sla de regel op en test deze met een proefboeking.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De aanbetaling wordt afgehandeld via de bij het object vastgelegde betalingsprovider. Het bijpassende bedrag voor de restsom richt u in onder [De restbetaling automatiseren](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "De restbetaling automatiseren",
          excerpt: "Zo wordt het openstaande restbedrag automatisch vóór de aankomst geïnd.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Na een aanbetaling blijft een restbedrag openstaan. In plaats van dit handmatig op te volgen, richt u een betaalregel in die de restbetaling automatisch op een vast moment vóór de aankomst via Stripe of PayPal int.",
            },
            {
              type: "steps",
              items: [
                "Open in het object het onderdeel “Betaalregels”.",
                "Maak een nieuwe regel aan van het type “Restbetaling”, mits er al een aanbetalingsregel bestaat.",
                "Bepaal hoeveel dagen vóór de aankomst de restbetaling verschuldigd wordt.",
                "Activeer de automatische incasso, zodat de vastgelegde betalingsprovider het bedrag zelfstandig afschrijft.",
                "Controleer de status van de restbetaling vervolgens in de boekings-tijdlijn van de betreffende reservering.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mislukt de automatische incasso, bijvoorbeeld door een verlopen kaart, dan wordt de boeking niet automatisch geannuleerd. Controleer mislukte restbetalingen tijdig en neem rechtstreeks contact op met de gast.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Een terugbetaling uitvoeren",
          excerpt: "Zo betaalt u een gast een bedrag geheel of gedeeltelijk terug.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Bij een annulering of klacht kunt u een gast het betaalde bedrag geheel of gedeeltelijk terugbetalen. De terugbetaling loopt via dezelfde betalingsprovider waarmee oorspronkelijk is betaald — Stripe of PayPal.",
            },
            {
              type: "steps",
              items: [
                "Open de betreffende boeking in de boekings-tijdlijn.",
                "Kies in het onderdeel “Betalingen” de oorspronkelijke betaling die terugbetaald moet worden.",
                "Kies tussen volledige of gedeeltelijke terugbetaling.",
                "Voer bij een gedeeltelijke terugbetaling het gewenste bedrag in.",
                "Bevestig de terugbetaling en controleer de bijgewerkte betaalstatus in de tijdlijn.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Een terugbetaling verandert niets automatisch aan de boekingsstatus of aan de belegde kalendernachten. Controleer bij een annulering bovendien of de betrokken nachten in het belegingsschema weer vrijgegeven moeten worden.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Een borgsom beheren",
          excerpt: "Zo stelt u een borgsom in en geeft u deze na het verblijf weer vrij.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Een borgsom beschermt u tegen schade tijdens het verblijf. Ze wordt als aparte betaalregel vastgelegd en via Stripe of PayPal vooraf geautoriseerd of geïnd, afhankelijk van de configuratie van het object.",
            },
            {
              type: "steps",
              items: [
                "Open in het object het onderdeel “Betaalregels” en maak een regel aan van het type “Borgsom”.",
                "Bepaal het borgbedrag en het moment van autorisatie, doorgaans kort vóór de aankomst.",
                "Controleer na de check-out de staat van het object.",
                "Geef de borgsom bij een onberispelijke staat volledig vrij via de boeking.",
                "Betaal bij schade alleen het niet-benodigde deel terug en documenteer de reden voor het inhouden.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een geautoriseerde maar niet geïnde borgsom vervalt, afhankelijk van de betalingsprovider, na een bepaalde termijn automatisch. Geef de borgsom tijdig na de check-out vrij of int het benodigde bedrag op tijd.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Een factuur corrigeren",
          excerpt: "Zo corrigeert u een al uitgereikte factuur achteraf.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Bevat een al uitgereikte factuur een fout, bijvoorbeeld in het factuuradres of een regel, corrigeer deze dan via de boeking, in plaats van de oorspronkelijke factuur simpelweg te verwijderen.",
            },
            {
              type: "steps",
              items: [
                "Open de betreffende boeking in de boekings-tijdlijn en ga naar het onderdeel “Facturen”.",
                "Kies de foutieve factuur.",
                "Maak een correctie- oftewel creditfactuur aan bij de oorspronkelijke factuur.",
                "Maak vervolgens een nieuwe, gecorrigeerde factuur aan met de juiste gegevens.",
                "Verstuur de gecorrigeerde factuur opnieuw naar de gast of het factuuradres.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Een al verzonden factuur mag omwille van de traceerbaarheid niet direct overschreven worden. De correctie via een creditfactuur behoudt het oorspronkelijke document en maakt de wijziging traceerbaar.",
            },
          ],
        },
      ],
    },
  ],
};
