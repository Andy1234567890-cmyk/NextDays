import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portalen & kanaalbeheerder",
  description: "Booking, Airbnb, Expedia & co. centraal beheren.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Portalen koppelen",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Wat is de kanaalbeheerder?",
          excerpt:
            "De kanaalbeheerder synchroniseert prijzen, beschikbaarheid en boekingen automatisch tussen myNextDays en de portalen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Eén koppeling voor alle portalen" },
            {
              type: "p",
              text: "De kanaalbeheerder is de brug tussen myNextDays en de grote boekingsportalen zoals Booking, Airbnb & co. In plaats van in elk portaal afzonderlijk prijzen, beschikbaarheid en bezetting bij te houden, voert u alles één keer in myNextDays in — de kanaalbeheerder verspreidt het automatisch naar alle gekoppelde portalen.",
            },
            { type: "h2", text: "Wat automatisch wordt gesynchroniseerd" },
            {
              type: "ul",
              items: [
                "Beschikbaarheid — elke reservering blokkeert de nacht onmiddellijk op alle portalen",
                "Prijzen en minimumverblijven uit uw prijskalender",
                "Binnenkomende portaalboekingen worden automatisch in myNextDays geïmporteerd",
                "Annuleringen en stopverkoop werken kanaaloverstijgend",
              ],
            },
            { type: "h2", text: "Wat u hierdoor niet meer handmatig hoeft te doen" },
            {
              type: "p",
              text: "Zonder kanaalbeheerder zou u na elke boeking handmatig in elk portaal de nacht moeten blokkeren — een veelvoorkomende oorzaak van dubbele boekingen. Met een actieve kanaalbeheerder neemt myNextDays deze afstemming in beide richtingen over, meerdere keren per dag en in realtime bij nieuwe boekingen.",
            },
            {
              type: "note",
              variant: "info",
              text: "De portaalkoppeling wordt eenmalig account-breed ingericht. Voor elk afzonderlijk object activeert u daarna alleen nog de mapping — meer hierover onder [Object aan een portaal koppelen](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Portaalkoppeling instellen",
          excerpt:
            "De koppeling met de portalen richt u één keer account-breed in — niet opnieuw voor elk object.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Eenmalig voor het hele account" },
            {
              type: "p",
              text: "De koppeling met de portalen is een account-brede instelling: u verbindt uw myNextDays-account precies één keer met de kanaalbeheerder. Alle objecten die u later aanmaakt, gebruiken automatisch diezelfde koppeling — u hoeft deze niet per object opnieuw op te zetten.",
            },
            { type: "h2", text: "Zo richt u de koppeling in" },
            {
              type: "steps",
              items: [
                "Open /konto en kies het gedeelte “Portalen & kanaalbeheerder”",
                "Klik op “Koppeling instellen” en bevestig uw bedrijfsgegevens (adres, contact, rechtsvorm)",
                "Controleer de automatisch overgenomen stamgegevens — deze worden aan alle portalen doorgegeven",
                "Rond de instelling af; de status verandert naar “Gekoppeld”",
              ],
            },
            { type: "h2", text: "Volgende stap: objecten koppelen" },
            {
              type: "p",
              text: "Na de eenmalige instelling is er nog geen enkel object zichtbaar — daarvoor koppelt u elk object afzonderlijk aan een portaal (mapping) en verbindt u de gewenste portalen zoals Booking.com of Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder volledige stamgegevens (adres, belastinginformatie, contact) wijzen de portalen de koppeling af. Controleer deze gegevens eerst onder /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Object aan een portaal koppelen",
          excerpt:
            "Na de account-brede koppeling activeert u per object alleen nog de mapping naar het betreffende portaal.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Mapping in plaats van nieuwe koppeling" },
            {
              type: "p",
              text: "Is de portaalkoppeling eenmaal account-breed ingericht, dan koppelt u elk object alleen nog via een zogenoemde mapping: u legt vast welk myNextDays-object overeenkomt met welk kamer- of aanbodtype in het portaal. Dit is per object een eenmalige stap.",
            },
            { type: "h2", text: "Zo koppelt u een object" },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte en ga naar het tabblad “Portalen”",
                "Kies het gewenste portaal, bijvoorbeeld Booking.com of Airbnb",
                "Koppel het object aan het passende kamer- of aanbodtype in het portaal",
                "Activeer de synchronisatie — prijzen en beschikbaarheid worden vanaf nu doorgegeven",
              ],
            },
            { type: "h2", text: "Eén object, meerdere portalen" },
            {
              type: "p",
              text: "Eén object kan tegelijk aan meerdere portalen gekoppeld zijn. Elke koppeling is onafhankelijk — u kunt een object bijvoorbeeld op Booking.com en Airbnb zichtbaar maken, maar op Expedia voorlopig gedeactiveerd laten.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Controleer na de mapping direct de zichtbaarheid — zie [Zichtbaarheid per portaal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.com koppelen",
          excerpt: "Zo schakelt u Booking.com vrij als verkoopkanaal voor een object.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Vereiste: account-brede koppeling" },
            {
              type: "p",
              text: "Voordat u Booking.com voor een object activeert, moet de account-brede portaalkoppeling zijn ingericht (zie [Portaalkoppeling instellen](/hilfe/portale-kanalmanager/portal-verbindung)). Daarna is Booking.com voor elk volgend object alleen nog een kwestie van mapping.",
            },
            { type: "h2", text: "Booking.com activeren" },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte, tabblad “Portalen”",
                "Kies “Booking.com” uit de lijst met beschikbare portalen",
                "Koppel het passende kamer- of aanbodtype en bevestig de tariefplannen",
                "Activeer de zichtbaarheid — het object wordt na controle door Booking.com live geschakeld",
              ],
            },
            { type: "h2", text: "Wat Booking.com van u verwacht" },
            {
              type: "ul",
              items: [
                "Volledige objectbeschrijving, foto's en voorzieningen",
                "Minstens één tarief met prijs en annuleringsvoorwaarden",
                "Een geldige betaalmethode voor commissies",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De vrijgave door Booking.com kan enkele uren duren. De status in het objecttabblad “Portalen” toont of de koppeling al actief is.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnb koppelen",
          excerpt: "Zo maakt u een object via de kanaalbeheerder boekbaar op Airbnb.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Airbnb als extra portaal" },
            {
              type: "p",
              text: "Airbnb wordt, zoals elk ander portaal, via de account-brede koppeling aangesloten. Is deze ingericht, dan activeert u Airbnb per object via de mapping — ongeacht of het object al zichtbaar is op Booking.com of andere portalen.",
            },
            { type: "h2", text: "Airbnb activeren voor een object" },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte, tabblad “Portalen”",
                "Kies “Airbnb” uit de lijst met beschikbare portalen",
                "Bevestig de objectcategorie en het gekoppelde aanbodtype",
                "Controleer foto's, voorzieningen en huisregels — Airbnb vereist volledige gegevens vóór vrijgave",
                "Activeer de zichtbaarheid voor Airbnb",
              ],
            },
            { type: "h2", text: "Na de activering" },
            {
              type: "p",
              text: "Zodra Airbnb het object heeft vrijgegeven, lopen prijzen en beschikbaarheid automatisch via de kanaalbeheerder. Boekingen die op Airbnb binnenkomen, verschijnen vervolgens automatisch in uw reserveringskalender.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder vastgelegde annuleringsvoorwaarden en huisregels wijst Airbnb de vrijgave af. Vul deze gegevens eerst aan bij het object.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Prijzen & beschikbaarheid synchroniseren",
          excerpt:
            "Prijzen en beschikbaarheid worden automatisch naar alle gekoppelde portalen doorgegeven.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Eén kalender, alle portalen" },
            {
              type: "p",
              text: "U beheert prijzen en beschikbaarheid uitsluitend in de myNextDays-kalender van het betreffende object. De kanaalbeheerder geeft elke wijziging automatisch door aan alle portalen waarvoor het object actief is gemapt — zonder dat u iets dubbel hoeft in te voeren.",
            },
            { type: "h2", text: "Wat wordt doorgegeven" },
            {
              type: "ul",
              items: [
                "Dagprijzen uit uw prijskalender of de tariefplannen",
                "Beschikbare nachten en blokkeringen",
                "Minimumverblijf en aankomst-/vertrekbeperkingen",
                "Stopverkoopdagen — deze blokkeren automatisch op alle portalen",
              ],
            },
            { type: "h2", text: "Hoe snel de synchronisatie werkt" },
            {
              type: "p",
              text: "Wijzigingen in prijzen en beschikbaarheid worden binnen enkele minuten aan de portalen doorgegeven. Nieuwe reserveringen blokkeren de betreffende nachten onmiddellijk, zodat dezelfde nacht op geen enkel ander kanaal opnieuw kan worden verkocht.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Meer over het kanaaloverstijgend blokkeren van afzonderlijke dagen vindt u onder [Overboekingen voorkomen](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Portaalboekingen ontvangen",
          excerpt: "Boekingen van Booking, Airbnb & co. komen automatisch in uw kalender terecht.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Automatische import" },
            {
              type: "p",
              text: "Boekt een gast via een portaal zoals Booking.com of Airbnb, dan importeert de kanaalbeheerder de reservering automatisch in myNextDays. U hoeft niets handmatig over te dragen — de boeking verschijnt in de kalender en in de reserveringslijst van het betreffende object.",
            },
            { type: "h2", text: "Wat er gebeurt bij een portaalboeking" },
            {
              type: "steps",
              items: [
                "Het portaal meldt de nieuwe boeking aan de kanaalbeheerder",
                "myNextDays maakt de reservering aan met gastgegevens, periode en prijs",
                "De geboekte nachten worden onmiddellijk op alle andere kanalen geblokkeerd",
                "U ontvangt een melding en vindt de boeking in de kalender",
              ],
            },
            { type: "h2", text: "Annuleringen en wijzigingen" },
            {
              type: "p",
              text: "Annuleert een gast via het portaal of wijzigt de gast de periode, dan wordt dit eveneens automatisch naar myNextDays doorgegeven en worden de betreffende nachten weer vrijgegeven.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portaalboekingen zijn in de reserveringsdetails herkenbaar aan hun herkomstbadge, bijvoorbeeld Booking.com of Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Overboekingen voorkomen",
          excerpt: "Stopverkoop en automatische blokkeringen voorkomen dubbele boekingen via meerdere portalen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Waarom overboekingen ontstaan" },
            {
              type: "p",
              text: "Zonder centrale sturing gebeurt het gemakkelijk dat dezelfde nacht tegelijkertijd op twee portalen wordt verkocht — bijvoorbeeld wanneer prijzen en beschikbaarheid handmatig in meerdere systemen worden bijgehouden. De kanaalbeheerder dicht dit gat doordat elke boeking op elk kanaal onmiddellijk alle andere kanalen blokkeert.",
            },
            { type: "h2", text: "Uw hulpmiddelen tegen overboekingen" },
            {
              type: "ul",
              items: [
                "Automatische blokkering: elke nieuwe reservering — ongeacht op welk kanaal — blokkeert de nachten overal",
                "Stopverkoop: blokkeert een dag handmatig op alle kanalen tegelijk, bijvoorbeeld voor eigen gebruik of onderhoud",
                "Minimumverblijf en aankomstbeperkingen voorkomen ongepaste kortverblijfboekingen",
              ],
            },
            { type: "h2", text: "Stopverkoop instellen" },
            {
              type: "steps",
              items: [
                "Open de bezettingskalender van het object",
                "Markeer de betreffende dag of periode",
                "Kies “Stopverkoop” — de dag is daarna geblokkeerd op alle portalen en op website en platform",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stopverkoop geldt zonder uitzondering voor alle kanalen. Er is geen mogelijkheid om een dag alleen voor één portaal te blokkeren en voor andere open te laten.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Zichtbaarheid per portaal",
          excerpt: "Elk portaal kan onafhankelijk van website en platform-marktplaats worden in- of uitgeschakeld.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            { type: "h2", text: "Drie onafhankelijke verkoopwegen" },
            {
              type: "p",
              text: "Een object kan tegelijkertijd via meerdere wegen worden verkocht: via de portalen (Booking, Airbnb & co.), via de myBestDays-platform-marktplaats en via uw eigen website. Elke weg heeft een eigen zichtbaarheidsschakelaar — ze zijn volledig onafhankelijk van elkaar.",
            },
            { type: "h2", text: "Zichtbaarheid per portaal beheren" },
            {
              type: "p",
              text: "Binnen de portalen is bovendien elk afzonderlijk portaal apart schakelbaar. Een object kan bijvoorbeeld op Booking.com actief zijn, maar op Airbnb gedeactiveerd — beide koppelingen blijven hierdoor onaangetast bestaan.",
            },
            { type: "h2", text: "Zo wijzigt u de zichtbaarheid" },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte, tabblad “Portalen”",
                "Schakel het gewenste kanaal (afzonderlijk portaal, website of platform-marktplaats) individueel in of uit",
                "Sla op — de wijziging is binnen enkele minuten van kracht",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De objectstatus (actief/inactief) en stopverkoop werken overkoepelend op alle kanalen. De zichtbaarheidsschakelaars bepalen alleen op welke aanvullende kanalen een reeds actief object verschijnt.",
            },
          ],
        },
      ],
    },
  ],
};
