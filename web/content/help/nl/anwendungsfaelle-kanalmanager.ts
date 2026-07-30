import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanaalbeheer",
  description: "Portalen en kanaalbeheer onder de knie krijgen.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanaalbeheer",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Uw eerste portaal koppelen",
          excerpt: "Zo schakelt u voor het eerst een portaal vrij voor een object.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: u heeft een object aangemaakt, maar nog geen portaal gekoppeld",
            },
            {
              type: "p",
              text: "Uw object is volledig ingericht in myNextDays, maar nog op geen enkel portaal zoals Booking.com of Airbnb zichtbaar. Voordat een portaal een object accepteert, heeft uw account eenmalig een accountbrede portaalkoppeling nodig — daarna volstaat voor elk volgend object alleen nog een mapping.",
            },
            {
              type: "steps",
              items: [
                "Open /konto, onderdeel “Portalen & kanaalbeheer”, en richt de accountbrede koppeling in met uw bedrijfsgegevens",
                "Open daarna het object onder /objekte en ga naar het tabblad “Portalen”",
                "Kies het gewenste portaal en koppel het aan het juiste kamer- of aanbodtype",
                "Controleer foto's, voorzieningen, prijzen en annuleringsvoorwaarden — portalen vereisen volledige gegevens",
                "Activeer de zichtbaarheid; de status wordt na controle door het portaal “Verbonden”",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De accountbrede koppeling richt u maar één keer in. Details hierover vindt u onder [Booking.com koppelen](/hilfe/portale-kanalmanager/booking-verbinden) en [Airbnb koppelen](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.com koppelen",
          excerpt: "Zo maakt u een object via de kanaalbeheerder boekbaar op Booking.com.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: uw object moet ook zichtbaar worden op Booking.com",
            },
            {
              type: "p",
              text: "Booking.com is een van de portalen die via de kanaalbeheerder wordt gekoppeld. Voorwaarde is de accountbrede portaalkoppeling — is die al ingericht, dan heeft u voor Booking.com alleen nog een mapping per object nodig.",
            },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte, tabblad “Portalen”",
                "Kies “Booking.com” uit de lijst met beschikbare portalen",
                "Koppel het juiste kamer- of aanbodtype en bevestig minstens één tarief met prijs en annuleringsvoorwaarden",
                "Leg een geldige betaalmethode vast voor de commissieafrekening",
                "Activeer de zichtbaarheid voor Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De vrijschakeling door Booking.com kan enkele uren duren. De status op het tabblad “Portalen” toont zodra de koppeling actief is.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnb koppelen",
          excerpt: "Zo maakt u een object via de kanaalbeheerder boekbaar op Airbnb.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: uw object moet ook zichtbaar worden op Airbnb",
            },
            {
              type: "p",
              text: "Airbnb wordt net als elk ander portaal via de accountbrede koppeling aangesloten. Is die ingericht, dan activeert u Airbnb per object via een mapping — ongeacht of het object al zichtbaar is op Booking.com of andere portalen.",
            },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte, tabblad “Portalen”",
                "Kies “Airbnb” uit de lijst met beschikbare portalen",
                "Bevestig de objectcategorie en het gekoppelde aanbodtype",
                "Vul foto's, voorzieningen en huisregels aan — Airbnb vereist volledige gegevens vóór vrijschakeling",
                "Activeer de zichtbaarheid voor Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zonder vastgelegde annuleringsvoorwaarden en huisregels wijst Airbnb de vrijschakeling af. Vul deze gegevens eerst aan in het object.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Prijzen op alle portalen synchroon houden",
          excerpt: "Eén kalender volstaat — de kanaalbeheerder verspreidt prijswijzigingen automatisch naar alle portalen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: u wijzigt een prijs en wilt zeker weten dat deze overal klopt",
            },
            {
              type: "p",
              text: "U beheert prijzen uitsluitend in de myNextDays-kalender van het object — nooit afzonderlijk in de portalen zelf. De kanaalbeheerder draagt elke wijziging automatisch over naar alle portalen waarvoor het object actief gemapt is.",
            },
            {
              type: "steps",
              items: [
                "Open de prijskalender of de tariefplannen van het object",
                "Pas de dagprijs, het minimumverblijf of de aankomst-/vertrekbeperking aan",
                "Sla de wijziging op — deze werkt eerst intern in het object",
                "Controleer op het tabblad “Portalen” of alle gewenste portalen nog actief gemapt zijn",
                "Wacht enkele minuten tot de wijziging naar de portalen is overgedragen",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Voer prijzen nooit rechtstreeks in het portaal in — dergelijke wijzigingen worden bij de volgende synchronisatie overschreven door de myNextDays-kalender.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Een portaalboeking importeren",
          excerpt: "Portaalboekingen komen automatisch in de kalender terecht — hier controleert u of de import geslaagd is.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: een gast heeft via een portaal geboekt, de boeking moet in myNextDays terechtkomen",
            },
            {
              type: "p",
              text: "Boekt een gast via Booking.com, Airbnb of een ander gekoppeld portaal, dan importeert de kanaalbeheerder de reservering automatisch — u hoeft niets handmatig over te nemen. Deze werkwijze beschrijft hoe u de import controleert en bevestigt.",
            },
            {
              type: "steps",
              items: [
                "Open de kalender of de reserveringslijst van het betreffende object",
                "Zoek de nieuwe reservering — deze heeft een herkomstbadge van het portaal, bijvoorbeeld Booking.com of Airbnb",
                "Controleer gastgegevens, periode en prijs op volledigheid",
                "Controleer dat de geboekte nachten op alle andere kanalen als geblokkeerd worden weergegeven",
                "Open desgewenst de boekingsdetails om extra diensten of berichten van de gast te bewerken",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Annuleert de gast via het portaal of wijzigt hij de periode, dan wordt dit eveneens automatisch overgenomen en worden de nachten weer vrijgegeven.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Een dubbele boeking oplossen",
          excerpt: "Zo gaat u te werk als dezelfde nacht bij uitzondering op twee kanalen is verkocht.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: twee reserveringen overlappen voor hetzelfde object en dezelfde nachten",
            },
            {
              type: "p",
              text: "De kanaalbeheerder blokkeert geboekte nachten normaal gesproken direct kanaaloverstijgend. Toch kan een dubbele boeking ontstaan, bijvoorbeeld bij gelijktijdige boekingen op twee portalen op hetzelfde moment of bij een handmatig aangemaakte reservering die botst met een portaalboeking.",
            },
            {
              type: "steps",
              items: [
                "Open de kalender van het object en identificeer beide overlappende reserveringen",
                "Controleer het boekingsmoment en de herkomstbadge van beide reserveringen",
                "Neem contact op met de laatst binnengekomen gast en bied een alternatief object of een andere periode aan",
                "Annuleer de niet-houdbare reservering in het betreffende portaal, niet alleen in myNextDays",
                "Zet voor de betrokken nachten daarna stopverkoop, totdat de zaak volledig is opgehelderd",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Annuleer een portaalboeking altijd via het portaal zelf — een annulering alleen in myNextDays geeft de nacht intern wel vrij, maar informeert het portaal niet betrouwbaar.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Een portaal tijdelijk pauzeren",
          excerpt: "Zichtbaarheid per portaal apart uitschakelen, zonder de mapping te verliezen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: een object mag op een portaal tijdelijk niet boekbaar zijn",
            },
            {
              type: "p",
              text: "De zichtbaarheid is per portaal apart schakelbaar — onafhankelijk van website en platform-marktplaats. Wilt u bijvoorbeeld Airbnb kortstondig pauzeren, maar Booking.com laten doorlopen, dan schakelt u uitsluitend dat ene kanaal uit.",
            },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte, tabblad “Portalen”",
                "Zoek de vermelding van het portaal dat u wilt pauzeren",
                "Schakel de zichtbaarheid voor dit portaal uit",
                "Sla op — de wijziging werkt binnen enkele minuten, het object verdwijnt uit de zoekresultaten van dit portaal",
                "Schakel de zichtbaarheid weer in zodra het object opnieuw boekbaar moet zijn",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "De mapping blijft bij het pauzeren behouden — u hoeft de koppeling met het portaal later niet opnieuw in te richten. Voor een volledige blokkering van alle kanalen gebruikt u in plaats daarvan stopverkoop.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "De objectmapping controleren",
          excerpt: "Zo controleert u of uw object nog correct is gekoppeld aan het juiste aanbodtype in het portaal.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: prijzen of beschikbaarheid komen op een portaal niet meer overeen met myNextDays",
            },
            {
              type: "p",
              text: "Wijkt de weergave in het portaal af van uw myNextDays-kalender, dan ligt de oorzaak vaak bij een foutieve of onderbroken mapping — de koppeling tussen uw object en het kamer- of aanbodtype in het portaal.",
            },
            {
              type: "steps",
              items: [
                "Open het object onder /objekte, tabblad “Portalen”",
                "Controleer de status van het betreffende portaal — deze moet “Verbonden” tonen, niet “Fout” of “In behandeling”",
                "Controleer of het gekoppelde kamer- of aanbodtype in het portaal nog overeenkomt met het werkelijke object",
                "Bij afwijking: mapping ontkoppelen en opnieuw koppelen, daarna de zichtbaarheid weer activeren",
                "Wacht na de correctie enkele minuten en controleer prijzen en beschikbaarheid opnieuw in het portaal",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Een object kan aan meerdere portalen tegelijk gekoppeld zijn — controleer bij afwijkingen gericht het ene betrokken portaal, niet allemaal tegelijk.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Verschillende tarieven per portaal",
          excerpt: "Hoe u een portaal een eigen tariefplan toewijst, zonder de overige kanalen te beïnvloeden.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: u wilt op een portaal een andere prijs aanbieden dan op de overige kanalen",
            },
            {
              type: "p",
              text: "Tariefplannen kunnen afzonderlijk per portaal worden gekoppeld, bijvoorbeeld een niet-annuleerbaar tariefplan voor het ene portaal en een flexibel plan voor het andere. De basisprijzen blijven centraal in het object beheerd, de mapping bepaalt welk tariefplan naar welk portaal gaat.",
            },
            {
              type: "steps",
              items: [
                "Maak in het object het extra tariefplan aan met de gewenste voorwaarden (prijs, annuleringsvoorwaarden, minimumverblijf)",
                "Open het tabblad “Portalen” en kies het betreffende portaal",
                "Koppel in de mapping het nieuwe tariefplan aan dit portaal",
                "Laat de overige portalen ongewijzigd op hun huidige tariefplan",
                "Sla op en controleer na enkele minuten de prijsweergave in het betreffende portaal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Elk tariefplan wordt onafhankelijk overgedragen — een wijziging aan één tariefplan heeft geen effect op portalen die aan een ander tariefplan gekoppeld zijn.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Veelvoorkomende portaalfouten oplossen",
          excerpt: "Typische oorzaken wanneer een portaal een object afwijst of de synchronisatie stokt.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "h2",
              text: "Uitgangssituatie: de status van een portaal toont een fout of het object wordt niet overgenomen",
            },
            {
              type: "p",
              text: "Portalen wijzen een koppeling meestal af wegens ontbrekende stamgegevens of onvolledige objectgegevens. Loop de meest voorkomende oorzaken systematisch na voordat u contact opneemt met de support.",
            },
            {
              type: "steps",
              items: [
                "Controleer onder /konto of adres, belastinggegevens en contactgegevens volledig zijn ingevuld",
                "Controleer in het object of beschrijving, foto's, voorzieningen en minstens één tarief volledig zijn",
                "Controleer of een geldige betaalmethode voor commissies is vastgelegd",
                "Open het tabblad “Portalen” en lees de exacte foutmelding naast het betrokken portaal",
                "Verhelp de genoemde ontbrekende gegevens en activeer de zichtbaarheid opnieuw",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Een portaalfout betreft altijd alleen dat ene portaal — de overige kanalen blijven onafhankelijk daarvan doorlopen, zolang aan hun eigen vereisten wordt voldaan.",
            },
          ],
        },
      ],
    },
  ],
};
