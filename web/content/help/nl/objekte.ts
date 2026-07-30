import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Objecten & voorzieningen",
  description: "Kamers en vakantieobjecten aanmaken en onderhouden.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Objecten beheren",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Object = één boekbare eenheid",
          excerpt: "Waarom elk object in myNextDays precies één boekbare eenheid is.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays is een object altijd precies één boekbare eenheid — een afzonderlijke kamer in een hotel of een compleet vakantieobject. Dit principe geldt ongeacht of u een vakantiehuis, een vakantieappartement of een hotel exploiteert, en is de basis voor beschikbaarheid, prijzen en boekingen.",
            },
            { type: "h2", text: "Geen gebouw met kamers eronder" },
            {
              type: "p",
              text: "Een veelvoorkomend misverstand is om een hotelgebouw af te beelden als één object met meerdere kamers eronder. Dat is in myNextDays niet voorzien. Exploiteert u bijvoorbeeld een hotel met acht tweepersoonskamers en vier eenpersoonskamers, maak dan twaalf afzonderlijke objecten aan — niet één object met een aantal kamers.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Een veld zoals “Aantal kamers” op objectniveau bestaat bewust niet. Elke kamer heeft een eigen object nodig met een eigen kalender en eigen prijzen.",
            },
            { type: "h2", text: "Vakantieobjecten" },
            {
              type: "p",
              text: "Bij een vakantiehuis of vakantieappartement komt het volledige object overeen met de boekbare eenheid. Er is hier geen verdere onderverdeling — een vakantieobject is altijd een zelfstandig object met een eigen kalender.",
            },
            { type: "h2", text: "Waarom dit belangrijk is" },
            {
              type: "ul",
              items: [
                "Elk object heeft een eigen beschikbaarheidskalender — dubbele boekingen worden per object voorkomen.",
                "Prijzen, voorzieningen en foto's gelden per object, niet per gebouw.",
                "Een object hoort altijd bij precies één eigenaar — geen meervoudige toewijzing.",
                "Kanaalzichtbaarheid (website, platform-marktplaats, portalen) wordt per object aangestuurd.",
              ],
            },
            {
              type: "p",
              text: "Hoe u het juiste objecttype voor uw kamer of vakantieobject kiest, leest u onder [Objecttype vastleggen](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Objecttype vastleggen",
          excerpt: "Categorie, vastgoedtype en aanbodsoort correct toewijzen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Het objecttype bepaalt hoe uw object op portalen en de platform-marktplaats wordt ingedeeld en gefilterd. Het bestaat uit drie op elkaar voortbouwende keuzevelden, die u doorloopt bij het aanmaken of bewerken van een object.",
            },
            { type: "h2", text: "De drie keuzeniveaus" },
            {
              type: "steps",
              items: [
                "Kies eerst de categorie — bijvoorbeeld vakantieaccommodatie of hotel.",
                "Kies daarop voortbouwend het vastgoedtype — bijvoorbeeld vakantieappartement, vakantiehuis, tweepersoonskamer of eenpersoonskamer.",
                "Kies de aanbodsoort — bijvoorbeeld het hele object of een privékamer.",
                "Vul de afhankelijk van uw keuze getoonde extra velden aan, bijvoorbeeld bedtype of verdieping.",
              ],
            },
            { type: "h2", text: "Waarom de volgorde belangrijk is" },
            {
              type: "p",
              text: "De drie dropdowns zijn van elkaar afhankelijk: de keuze van de categorie beperkt de beschikbare vastgoedtypes, de keuze van het vastgoedtype op zijn beurt de aanbodsoorten. Zo ontstaan alleen zinvolle combinaties, zoals ook op grote portalen wordt gebruikt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Wijzigt u de categorie achteraf, dan controleert myNextDays of vastgoedtype en aanbodsoort nog passen, en vraagt u indien nodig om een nieuwe keuze.",
            },
            { type: "h2", text: "Objecttype bewerken" },
            {
              type: "p",
              text: "Open in het menu Objecten het gewenste object en ga naar het tabblad Basisgegevens. Daar vindt u de drie dropdowns onder Objecttype. Slaat u uw wijziging op, dan wordt de nieuwe indeling doorgegeven aan alle actieve kanalen.",
            },
            {
              type: "ul",
              items: [
                "Categorie: overkoepelende indeling (bijv. vakantieaccommodatie, hotel)",
                "Vastgoedtype: concreet objecttype (bijv. vakantieappartement, tweepersoonskamer)",
                "Aanbodsoort: wat precies wordt geboekt (bijv. heel object, privékamer)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Voorzieningen onderhouden",
          excerpt: "Voorzieningskenmerken selecteren en actueel houden.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De voorzieningen van een object bepalen in grote mate hoe goed het op portalen wordt gevonden en gefilterd. Gasten filteren gericht op kenmerken zoals wifi, keuken of parkeerplaats — ontbrekende gegevens kunnen een object uitsluiten van zoekresultaten.",
            },
            { type: "h2", text: "Voorzieningen selecteren" },
            {
              type: "steps",
              items: [
                "Open het object en ga naar het tabblad Voorzieningen.",
                "Selecteer alle van toepassing zijnde kenmerken uit de vastgestelde lijst.",
                "Vul indien nodig details aan, zoals aantal parkeerplaatsen of type keuken.",
                "Sla de wijzigingen op — ze worden automatisch doorgegeven aan alle actieve portalen.",
              ],
            },
            { type: "h2", text: "Waar de kenmerken vandaan komen" },
            {
              type: "p",
              text: "De voorzieningenlijst volgt de kenmerkencatalogus van de grote portalen, zodat uw gegevens daar correct kunnen worden toegewezen. Eigen, zelfbedachte kenmerken zijn niet voorzien, omdat deze niet netjes naar portalen konden worden doorgegeven.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Controleer de voorzieningen na elke bouwkundige wijziging — bijvoorbeeld een nieuwe airconditioning of een extra badkamer — zodat de gegevens op alle kanalen actueel blijven.",
            },
            { type: "h2", text: "Veelvoorkomende kenmerkgroepen" },
            {
              type: "ul",
              items: [
                "Basisvoorzieningen: wifi, verwarming, airconditioning",
                "Keuken & verzorging: volledig uitgeruste keuken, vaatwasser, koffiezetapparaat",
                "Badkamer & was: eigen badkamer, wasmachine, handdoeken",
                "Buitenruimte: balkon, terras, tuin, parkeerplaats",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Foto's & beschrijving",
          excerpt: "Sterke beelden en teksten voor meer boekingen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "Foto's en beschrijving zijn voor gasten de belangrijkste beslissingsbasis. Een object kan pas worden gepubliceerd wanneer minstens één titelfoto en een beschrijving zijn vastgelegd.",
            },
            { type: "h2", text: "Foto's uploaden" },
            {
              type: "steps",
              items: [
                "Open het object en ga naar het tabblad Foto's.",
                "Sleep afbeeldingsbestanden naar het uploadgebied of selecteer ze via de bestandskiezer.",
                "Stel een titelfoto in — deze verschijnt in zoekresultaten en tegels.",
                "Orden de overige foto's door slepen in een zinvolle volgorde.",
              ],
            },
            { type: "h2", text: "Beschrijving opstellen" },
            {
              type: "p",
              text: "Ga naar het tabblad Beschrijving en vul een titel en een lopende tekst in. Beschrijf ligging, bijzonderheden en doelgroep van het object concreet — algemene clichés werken op portalen minder overtuigend dan tastbare details.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Foto's van andere objecten of van internet mogen niet worden gebruikt — portalen controleren dit en kunnen objecten bij overtredingen blokkeren.",
            },
            { type: "h2", text: "Aanbevelingen voor goede foto's" },
            {
              type: "ul",
              items: [
                "Minstens vijf foto's, idealiter één per ruimte",
                "Liggend formaat, goede belichting, geen watermerken",
                "Titelfoto toont het object zo uitnodigend en eenduidig mogelijk",
                "Regelmatig bijwerken, vooral na renovaties",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Bezetting & capaciteit",
          excerpt: "Maximaal aantal gasten en bedverdeling correct vastleggen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De bezetting bepaalt hoeveel gasten een object kan huisvesten en wordt bij elke zoekopdracht en boeking gecontroleerd. Onjuiste gegevens leiden ofwel tot afgewezen aanvragen, ofwel tot overbezetting — beide dient u te vermijden.",
            },
            { type: "h2", text: "Bezetting invullen" },
            {
              type: "steps",
              items: [
                "Open het object en ga naar het tabblad Bezetting.",
                "Vul het maximale aantal volwassenen in.",
                "Vul het maximale aantal kinderen in, indien toegestaan.",
                "Leg de bedverdeling per ruimte vast, bijvoorbeeld één tweepersoonsbed en twee eenpersoonsbedden.",
              ],
            },
            { type: "h2", text: "Grenzen van de bezetting" },
            {
              type: "p",
              text: "Bij een boekingsaanvraag controleert myNextDays automatisch of het gevraagde aantal gasten binnen de vastgelegde bezetting valt. Aanvragen die de maximale capaciteit overschrijden, worden afgewezen respectievelijk helemaal niet als boekbaar getoond.",
            },
            {
              type: "note",
              variant: "info",
              text: "Een extra bed of kinderbed verhoogt de werkelijke capaciteit alleen wanneer u dit expliciet in de bedverdeling vastlegt — anders blijft het maximale aantal gasten ongewijzigd.",
            },
            { type: "h2", text: "Typische foutbronnen" },
            {
              type: "ul",
              items: [
                "Maximaal aantal gasten te hoog ingesteld, terwijl er maar weinig bedden zijn",
                "Aantal kinderen vergeten, terwijl het object zich op gezinnen richt",
                "Bedverdeling na een renovatie niet bijgewerkt",
              ],
            },
            {
              type: "p",
              text: "Sluiten bezetting en voorzieningen niet op elkaar aan, controleer dan aanvullend het tabblad [Voorzieningen](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Objectstatus & zichtbaarheid",
          excerpt: "Verschil tussen actief/inactief en de drie kanaalassen.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays onderscheidt twee verschillende zaken die vaak worden verward: de objectstatus (actief of inactief) en de zichtbaarheid op afzonderlijke verkoopkanalen. Beide stuurt u los van elkaar aan.",
            },
            { type: "h2", text: "Objectstatus" },
            {
              type: "p",
              text: "De status active betekent dat een object in beginsel verkoopbaar is. De status inactive zet een object volledig buiten gebruik — bijvoorbeeld bij een langdurige renovatie. Een inactief object is op geen enkel kanaal boekbaar, ongeacht de kanaalschakelaars.",
            },
            { type: "h2", text: "De drie kanaalassen" },
            {
              type: "p",
              text: "Is een object actief, dan bepalen drie onafhankelijke schakelaars precies waar het zichtbaar is:",
            },
            {
              type: "ul",
              items: [
                "Website — zichtbaarheid op uw eigen myNextDays-website",
                "Platform-marktplaats — zichtbaarheid op de wereldwijde myNextDays-marktplaats",
                "Portalen — zichtbaarheid op Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Deze drie assen staan volledig los van de objectstatus en van elkaar. Een actief object kan bijvoorbeeld alleen op de website zichtbaar zijn, maar niet op portalen.",
            },
            { type: "h2", text: "Status wijzigen" },
            {
              type: "steps",
              items: [
                "Open het object en ga naar het tabblad Overzicht.",
                "Zet de status op actief of inactief.",
                "Pas indien nodig ook de drie kanaalschakelaars in het tabblad Zichtbaarheid aan.",
                "Sla de wijziging op — deze werkt onmiddellijk door op alle betrokken kanalen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Voor een kortdurende blokkering van afzonderlijke dagen gebruikt u in plaats daarvan stopverkoop in de kalender — dit blokkeert gericht dagen op alle kanalen, zonder het hele object te deactiveren.",
            },
          ],
        },
      ],
    },
  ],
};
