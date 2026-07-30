import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Website",
  description: "Uw website optimaal gebruiken.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Website",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Uw website live zetten",
          excerpt: "Zo publiceert u uw eigen website als zelfstandig verkoopkanaal.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Uw website is een eigen verkoopkanaal naast portalen en het platform. U bouwt de pagina's op in de editor, maar pas na publicatie wordt de website zichtbaar voor gasten en verschijnen uw objecten daar boekbaar.",
            },
            {
              type: "steps",
              items: [
                "Open de website-editor en controleer dat alle gewenste pagina's van inhoud zijn voorzien.",
                "Kies in het objecttabblad per object of het zichtbaar moet zijn op de website — deze zichtbaarheid staat los van portalen en platform.",
                "Controleer de voorvertoning op desktop- en mobiele weergave voordat u live gaat.",
                "Klik op Publiceren om de website vrij te geven voor gasten.",
                "Controleer na publicatie de openbare URL en test een voorbeeldboeking via de website.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De websitezichtbaarheid van een object is een eigen as — een object kan actief zijn op portalen maar verborgen op de website, en omgekeerd. Details onder [Een eigen domein instellen](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Een eigen domein instellen",
          excerpt: "Zo koppelt u uw eigen domein aan uw myNextDays-website.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Een eigen domein zoals www.uwbedrijf.nl oogt professioneler dan een standaardadres en versterkt uw merk bij gasten die rechtstreeks bij u willen boeken.",
            },
            {
              type: "steps",
              items: [
                "Open in de website-editor het onderdeel Domein en voer uw gewenste eigen domein in.",
                "Stel bij de aanbieder van uw domein de weergegeven DNS-records in (doorgaans CNAME of A-record).",
                "Wacht tot het domein als gekoppeld en het SSL-certificaat als actief wordt weergegeven — dit kan afhankelijk van de aanbieder enkele uren duren.",
                "Test het openen van het eigen domein in een privévenster van de browser om oude, gecachte gegevens uit te sluiten.",
                "Controleer dat oude standaardadressen blijven doorverwijzen naar het nieuwe domein, zodat bestaande links niet in het niets uitkomen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Wijzig DNS-records alleen zoals weergegeven — onjuiste waarden kunnen bestaande e-mailinstellingen van uw domein verstoren. Overleg bij twijfel met uw domeinaanbieder voordat u bestaande records overschrijft.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Directe boekingen verhogen",
          excerpt: "Zo leidt u meer gasten naar uw eigen website in plaats van naar portalen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie",
            },
            {
              type: "p",
              text: "Boekingen via de eigen website zijn voor uw bedrijf meestal voordeliger dan via portalen, omdat hier geen portaalprovisie geldt. Met een paar gerichte maatregelen verhoogt u het aandeel directe boekingen via uw website als zelfstandig kanaal.",
            },
            {
              type: "steps",
              items: [
                "Zorg dat alle boekbare objecten zichtbaar zijn op de website en zijn voorzien van actuele foto's en beschrijvingen.",
                "Stel een website-exclusieve korting of voordeel in, bijvoorbeeld een kleine prijsverlaging ten opzichte van portalen.",
                "Vermeld uw eigen domein in boekingsbevestigingen en de communicatie met gasten die al eerder hebben geboekt.",
                "Controleer regelmatig de boekingsstatistiek om het aandeel van de website in alle boekingen in de tijd te volgen.",
                "Optimaliseer laadtijd en mobiele weergave van de website, aangezien een groot deel van de gasten via de smartphone boekt.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Een website-exclusief voordeel werkt alleen als gasten de website ook daadwerkelijk vinden — verwijs er actief naar, in plaats van alleen op portalen te vertrouwen. Voor publicatie zie [Uw website live zetten](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
