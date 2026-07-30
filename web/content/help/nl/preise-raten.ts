import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Prijzen & tarieven",
  description: "Tariefplannen, seizoensprijzen en dynamische prijzen.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Prijsbepaling",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Basisprijs & valuta",
          excerpt: "Zo stelt u de basisprijs vast en wijst u uw object de juiste valuta toe.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Elk object in myNextDays is precies één boekbare eenheid — een afzonderlijke kamer of een vakantieobject. Voor deze eenheid legt u een basisprijs vast, evenals een centrale valuta die voor het hele object geldt.",
            },
            { type: "h2", text: "Valuta centraal vastleggen" },
            {
              type: "p",
              text: "De objectvaluta wordt eenmaal per object ingesteld en geldt automatisch voor alle tariefplannen die u voor dit object aanmaakt. Er is geen aparte valuta-terugval — ontbreekt de valuta, dan kunt u geen prijzen opslaan.",
            },
            {
              type: "steps",
              items: [
                "Open uw object onder “Objecten”.",
                "Ga naar het tabblad “Prijzen”.",
                "Kies onder “Objectvaluta” de passende valuta.",
                "Vul de basisprijs voor de standaardbezetting in.",
                "Sla de wijzigingen op.",
              ],
            },
            { type: "h2", text: "Wat er gebeurt bij een valutawijziging" },
            {
              type: "p",
              text: "Wijzigt u de objectvaluta achteraf, dan werkt dit door op alle bestaande tariefplannen van dit object, omdat deze altijd in de objectvaluta worden gevoerd. Controleer daarna uw prijzen voordat u ze opnieuw doorgeeft aan de portalen.",
            },
            {
              type: "ul",
              items: [
                "Een object heeft precies één valuta — niet meerdere per tariefplan.",
                "De basisprijs is de uitgangswaarde voor afgeleide tarieven.",
                "Bedragen worden altijd weergegeven in de vastgelegde objectvaluta.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder vastgelegde valuta kan geen prijs worden opgeslagen en geen tarief naar portalen worden doorgegeven. Controleer dit als eerste wanneer een prijswijziging mislukt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Meer over afgeleide prijzen vindt u onder [Afgeleide tarieven](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Tariefplannen aanmaken",
          excerpt: "Tariefplannen bundelen prijs, annuleringsvoorwaarden en verzorging voor een object.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Een tariefplan bepaalt onder welke voorwaarden een object kan worden geboekt: prijs, annuleringsregels, verzorging en minimumverblijf. Een object kan meerdere tariefplannen tegelijk aanbieden, bijvoorbeeld een flexibel en een niet-annuleerbaar plan.",
            },
            { type: "h2", text: "Nieuw tariefplan aanmaken" },
            {
              type: "steps",
              items: [
                "Open het object en ga naar het tabblad “Prijzen”.",
                "Klik op “Nieuw tariefplan aanmaken”.",
                "Geef een duidelijke naam, bijvoorbeeld “Flexibel” of “Niet-annuleerbaar”.",
                "Bepaal of het plan een basistarief of een afgeleid tarief is.",
                "Leg annuleringsvoorwaarden en verzorging vast.",
                "Sla het tariefplan op en activeer het.",
              ],
            },
            { type: "h2", text: "Basistarief versus overige tariefplannen" },
            {
              type: "p",
              text: "Maak eerst uw basistarief aan (vaak aangeduid als “BAR”, Best Available Rate). Alle overige tariefplannen kunnen ofwel zelfstandig worden onderhouden, ofwel worden afgeleid van dit basistarief.",
            },
            {
              type: "ul",
              items: [
                "Basistarief: handmatig onderhouden basisprijs per nacht.",
                "Overige tariefplannen: zelfstandig of als toeslag/korting op het basistarief.",
                "Elk tariefplan kan afzonderlijk naar portalen worden doorgegeven.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Houd het aantal tariefplannen per object overzichtelijk — te veel varianten bemoeilijken de vergelijking voor gasten en verhogen de onderhoudsinspanning.",
            },
            {
              type: "note",
              variant: "info",
              text: "Details over toeslagen en kortingen vindt u onder [Afgeleide tarieven](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Afgeleide tarieven",
          excerpt: "Afgeleide tariefplannen worden automatisch berekend uit een basistarief.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Een afgeleid tarief is een tariefplan waarvan de prijs niet handmatig wordt onderhouden, maar automatisch wordt berekend uit een basistarief — als vaste toeslag, korting of percentage. Dit bespaart onderhoudsinspanning, omdat een prijswijziging aan het basistarief automatisch alle afgeleide plannen bijwerkt.",
            },
            { type: "h2", text: "Typisch voorbeeld" },
            {
              type: "p",
              text: "Een veelvoorkomend patroon is een plan met ontbijt, dat wordt afgeleid van het basistarief zonder verzorging: de ontbijtprijs wordt gedefinieerd als toeslag per nacht en persoon op het basistarief. Wijzigt u het basistarief, dan past de ontbijtprijs zich automatisch aan.",
            },
            { type: "h2", text: "Afgeleid tarief instellen" },
            {
              type: "steps",
              items: [
                "Open het gewenste tariefplan in het tabblad “Prijzen”.",
                "Kies als prijsbron “Afgeleid van …” en het bijbehorende basistarief.",
                "Bepaal of het verschil als vast bedrag of als percentage geldt.",
                "Leg vast of het om een toeslag of een korting gaat.",
                "Sla de koppeling op.",
              ],
            },
            {
              type: "ul",
              items: [
                "Toeslag: bijvoorbeeld verzorging, latere annuleerbaarheid.",
                "Korting: bijvoorbeeld niet-annuleerbaar plan met prijsvoordeel.",
                "Het basistarief blijft de enige handmatig onderhouden bron.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een afgeleid tarief kan niet tegelijkertijd handmatig worden overschreven. Ontkoppel eerst de afleiding wanneer u een afwijkende individuele prijs wilt instellen.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Seizoens- & weekendprijzen",
          excerpt: "Prijzen voor seizoensperiodes en weekenden gericht aanpassen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De vraag schommelt gedurende het jaar en binnen de week. Met seizoens- en weekendprijzen past u de basisprijs aan voor bepaalde periodes of weekdagen, zonder voor elke dag afzonderlijk de kalender in te gaan.",
            },
            { type: "h2", text: "Seizoensperiode aanmaken" },
            {
              type: "steps",
              items: [
                "Open in het object het tabblad “Prijzen” en het onderdeel “Seizoensprijzen”.",
                "Maak een nieuwe periode aan met begin- en einddatum.",
                "Leg de prijs of de procentuele afwijking ten opzichte van de basisprijs voor deze periode vast.",
                "Sla de seizoensperiode op.",
              ],
            },
            { type: "h2", text: "Weekendprijzen" },
            {
              type: "p",
              text: "Aanvullend kunt u afzonderlijke weekdagen, bijvoorbeeld vrijdag en zaterdag, van een eigen toeslag voorzien. Deze toeslag geldt bovenop de op dat moment geldende seizoens- of basisprijs.",
            },
            {
              type: "ul",
              items: [
                "Seizoensprijzen gelden voor aaneengesloten periodes.",
                "Weekendprijzen gelden per weekdag, los van het seizoen.",
                "Beide regels zijn te combineren.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Overlappen meerdere seizoensperiodes elkaar, dan geldt de laatst aangemaakte respectievelijk meest specifieke regel. Controleer de kalender na het opslaan.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Voor automatische, vraaggebaseerde aanpassingen is aanvullend [Dynamische prijzen](/hilfe/preise-raten/dynamische-preise) geschikt.",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynamische prijzen",
          excerpt: "Prijzen automatisch aanpassen aan vraag, voorlooptijd en bezetting.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Dynamische prijzen passen de basisprijs automatisch aan op basis van factoren zoals boekingsvoorlooptijd, actuele bezetting en vraag — vergelijkbaar met wat grote portalen doen bij hun eigen prijsaanbevelingen. Zo reageert u op marktveranderingen zonder elke dag handmatig bij te sturen.",
            },
            { type: "h2", text: "Dynamische prijzen activeren" },
            {
              type: "steps",
              items: [
                "Open in het object het tabblad “Prijzen” en het onderdeel “Dynamische prijzen”.",
                "Activeer de functie voor het basistarief van het object.",
                "Leg een prijsondergrens en een prijsbovengrens vast.",
                "Bepaal hoe sterk de bezetting de prijs mag beïnvloeden.",
                "Sla de instellingen op.",
              ],
            },
            { type: "h2", text: "Grenzen en veiligheid" },
            {
              type: "p",
              text: "Prijsondergrens en prijsbovengrens voorkomen dat het automatische algoritme prijzen instelt die niet houdbaar zijn voor uw bedrijf. Afgeleide tariefplannen volgen automatisch het dynamisch berekende basistarief.",
            },
            {
              type: "ul",
              items: [
                "Prijsondergrens beschermt tegen te lage prijzen bij zwakke vraag.",
                "Prijsbovengrens beschermt tegen overdreven prijzen bij hoge vraag.",
                "Afgeleide tarieven nemen automatisch het nieuwe basistarief over.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynamische prijzen werken alleen door op het basistarief. Handmatig vast ingestelde tariefplannen zonder afleiding wijzigen niet automatisch mee.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Verblijfskortingen",
          excerpt: "Kortingen voor langere verblijven en vroege boekingen instellen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Verblijfskortingen belonen gasten voor langere boekingen of vroegtijdig boeken. Ze worden toegepast als percentage op de totaalprijs van het verblijf en zijn onafhankelijk per object te configureren.",
            },
            { type: "h2", text: "Kortingssoorten" },
            {
              type: "ul",
              items: [
                "Langverblijfkorting: vanaf een bepaald aantal nachten, bijvoorbeeld vanaf 7 of 28 nachten.",
                "Vroegboekkorting: bij boeking ruim van tevoren.",
                "Lastminutekorting: bij boeking kort voor de aankomstdatum.",
              ],
            },
            { type: "h2", text: "Korting instellen" },
            {
              type: "steps",
              items: [
                "Open in het object het tabblad “Prijzen” en het onderdeel “Kortingen”.",
                "Kies de gewenste kortingssoort.",
                "Leg de drempel vast, bijvoorbeeld minimumaantal nachten of voorlooptijd.",
                "Vul de korting in procenten in.",
                "Sla de regel op.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kortingen werken door op de totaalprijs van het betreffende tariefplan en worden de gast al in het prijsoverzicht getoond.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combineer langverblijfkortingen met [Minimum- & maximumverblijf](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt) om langere boekingen gericht te stimuleren.",
            },
          ],
        },
      ],
    },
  ],
};
