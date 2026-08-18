import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Gebruiksvoorwaarden voor gasten",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Deze gebruiksvoorwaarden regelen het gebruik van het boekingsportaal myBestDays (hierna „het platform“) door reizigers en boekers (hierna „gast“ of „u“).",
    `Het platform wordt geëxploiteerd door ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Denemarken, CVR-nr. ${ANBIETER.cvr} (hierna „myBestDays“ of „wij“). myBestDays is een merk van deze vennootschap en geen zelfstandige rechtspersoon. De volledige aanbiedergegevens vindt u in het [Colofon](https://mybestdays.dk/rechtliches/impressum).`,
    "Door het platform te gebruiken stemt u in met deze voorwaarden. Leest u ze aandachtig.",
  ],
  summary: {
    heading: "Samenvatting van deze voorwaarden",
    paragraphs: [
      "myBestDays is een marktplaats. Wij stellen het platform ter beschikking waarop aanbieders hun accommodatie aanbieden — de accommodatie zelf leveren wij niet. De accommodatieovereenkomst komt tot stand tussen u en de aanbieder, niet met ons.",
      "Wat u in een advertentie ziet, komt van de aanbieder: beschrijving, foto's, voorzieningen, prijs, annuleringsvoorwaarden en huisregels. Wij controleren advertenties, maar wij kunnen niet voor elke opgave van een aanbieder instaan.",
      "De prijs die u ziet bij het afronden van de boeking is de totaalprijs voor de geboekte diensten. Bedragen die pas ter plaatse verschuldigd zijn (zoals toeristenbelasting of een borg) vermelden wij vooraf afzonderlijk.",
      "Gaat er iets mis, neem dan eerst contact met ons op. Onderdeel A15 beschrijft hoe u een klacht indient en welke wegen u daarna openstaan.",
      "Deze samenvatting licht de voorwaarden toe, maar vervangt ze niet. De volledige tekst is bepalend.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Alle boekingen via myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definities",
          paragraphs: [
            "De in deze voorwaarden gebruikte begrippen worden toegelicht in de begrippenlijst aan het einde van dit document. De belangrijkste zijn:",
          ],
          list: [
            "„Platform“ — de website, de mobiele applicaties en alle overige toegangen waarmee myBestDays accommodaties toont en boekingen bemiddelt.",
            "„Aanbieder“ — de natuurlijke of rechtspersoon die accommodatie via het platform aanbiedt (host, verhuurder, bureau, hotel- of accommodatiebedrijf).",
            "„Accommodatie“ — de door de aanbieder aangeboden logiesdienst, dus een vakantieobject of een eenheid van een kamer- of objecttype.",
            "„Boeking“ — de via het platform gesloten reservering van een accommodatie voor een bepaalde periode.",
            "„Totaalprijs“ — het bij het afronden van de boeking vermelde bedrag inclusief alle belastingen, kosten en toeslagen die via het platform worden afgerekend.",
            "„Kosten ter plaatse“ — bedragen die niet via het platform worden afgerekend maar bij de aanbieder verschuldigd zijn (bijvoorbeeld toeristenbelasting, borg, eindschoonmaak naar keuze van de aanbieder).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Over deze voorwaarden",
          paragraphs: [
            "Deze voorwaarden gelden voor elk gebruik van het platform, ongeacht of u een account aanmaakt en ongeacht of een boeking tot stand komt.",
            "Onderdeel A geldt voor alle boekingen. Onderdeel B bevat de aanvullende regels voor accommodaties. Bij tegenstrijdigheid gaat onderdeel B voor.",
            "Voor de logiesdienst zelf gelden aanvullend de voorwaarden van de betreffende aanbieder (met name huisregels en annuleringsvoorwaarden) zoals vermeld in de advertentie. Deze aanbiedersvoorwaarden gelden naast de onze; zij kunnen onze voorwaarden niet opzijzetten voor zover het uw verhouding tot ons betreft.",
            "Deze voorwaarden zijn beschikbaar in alle 24 officiële talen van de Europese Unie. Bij afwijkingen tussen de taalversies is de Duitse versie bepalend, tenzij dwingend recht van uw woonstaat anders voorschrijft.",
            "Dwingende consumentenrechten volgens het recht van uw woonstaat worden door deze voorwaarden niet aangetast.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Over myBestDays",
          paragraphs: [
            "myBestDays is een online marktplaats voor vakantieaccommodaties en accommodatiebedrijven. Wij exploiteren het platform waarop aanbieders hun accommodatie presenteren en gasten deze kunnen boeken.",
            "Wij zijn bemiddelaar, geen logiesverstrekker. Wij bezitten, exploiteren, beheren of controleren geen van de op het platform aangeboden accommodaties en zijn geen partij bij de accommodatieovereenkomst.",
            "myBestDays is een tussenhandelsdienst in de zin van Verordening (EU) 2022/2065 betreffende digitale diensten. Onze vermeldingen en procedures op grond van die verordening vindt u onder [Digitaledienstenverordening](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays is geen reisorganisator. Wij stellen geen pakketreizen samen in de zin van Richtlijn (EU) 2015/2302; over gekoppelde reisarrangementen zie A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Ons platform",
          paragraphs: [
            "De inhoud van een advertentie — beschrijving, foto's, voorzieningen, bezettingsgrenzen, prijzen, beschikbaarheid, annuleringsvoorwaarden en huisregels — komt van de betreffende aanbieder. De aanbieder is verantwoordelijk voor de juistheid en volledigheid ervan.",
            "Wij controleren advertenties vóór publicatie en doorlopend op kennelijke inbreuken op onze [Richtlijnen voor passende inhoud](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Een verplichting tot algemene monitoring van alle inhoud bestaat niet en zou op grond van artikel 8 van Verordening (EU) 2022/2065 ook niet toelaatbaar zijn.",
            "Hoe wij zoekresultaten ordenen en welke kenmerken de volgorde bepalen, leggen wij uit in [Prijzen, rangschikking en aanbevelingen](https://mybestdays.dk/rechtliches/preisangaben).",
            "Wij streven naar een doorlopend beschikbaar platform, maar zijn geen ononderbroken beschikbaarheid verschuldigd. Onderhoud, storingen en aanpassingen zijn mogelijk.",
            "Vertalingen van aanbiedersinhoud kunnen machinaal zijn gemaakt. Bepalend is de door de aanbieder aangeleverde oorspronkelijke versie.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Onze waarden",
          paragraphs: [
            "Wij verwachten van gasten en aanbieders een respectvolle omgang. Discriminatie wegens herkomst, huidskleur, godsdienst, levensovertuiging, geslacht, genderidentiteit, seksuele gerichtheid, handicap, leeftijd of vergelijkbare kenmerken wordt op het platform niet geduld — zie [Antidiscriminatiebeleid](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Voor het gedrag tijdens het verblijf gelden de [Basisregels voor gasten](https://mybestdays.dk/rechtliches/grundregeln-gaeste), voor aanbieders de [Gedragscode voor aanbieders](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Uw account en uw gebruik van het platform",
          paragraphs: [
            "Voor een boeking kunt u een account aanmaken. U bent verantwoordelijk voor de vertrouwelijkheid van uw inloggegevens en stelt ons onverwijld op de hoogte wanneer u onbevoegd gebruik vermoedt.",
            "U mag het platform alleen gebruiken wanneer u handelingsbekwaam bent en rechtsgeldig overeenkomsten kunt sluiten.",
            "Uw gegevens bij registratie en boeking moeten juist en volledig zijn — met name naam, contactgegevens en aantal reizigers. De aanbieder heeft deze gegevens nodig om de accommodatie ter beschikking te stellen en aan zijn registratieverplichtingen te voldoen.",
            "Niet toegestaan is met name:",
          ],
          list: [
            "schijnboekingen, frauduleuze betalingen of het gebruik van andermans betaalmiddelen zonder bevoegdheid;",
            "het geautomatiseerd uitlezen van het platform (scraping, crawlers) buiten hetgeen onze robots.txt toestaat;",
            "handelingen die het platform of de onderliggende infrastructuur verstoren of overbelasten of de beveiligingsmaatregelen omzeilen;",
            "het plaatsen van onrechtmatige, beledigende of misleidende inhoud in beoordelingen, berichten of profielgegevens;",
            "de poging de boeking buiten het platform om af te wikkelen nadat het contact via het platform tot stand kwam — zie [Kosten buiten het platform](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Prijzen",
          paragraphs: [
            "Alle prijzen worden als totaalprijs inclusief belastingen en alle via het platform afgerekende kosten getoond zodra de reisgegevens (periode en aantal reizigers) vaststaan. Is een onderdeel pas ter plaatse verschuldigd, dan vermelden wij dat afzonderlijk vóór het afronden van de boeking.",
            "Prijzen worden getoond in de valuta van de advertentie. Wordt een bedrag daarnaast in een andere valuta getoond, dan is dat een vrijblijvende omrekening ter oriëntatie; er wordt afgerekend in de valuta van de advertentie, tenzij bij het afrekenen anders is vermeld.",
            "Prijzen kunnen tot het afronden van de boeking wijzigen, bijvoorbeeld doordat de aanbieder ze aanpast of de beschikbaarheid verandert. Bepalend is de prijs die u onmiddellijk vóór de bindende boeking wordt getoond en die in de boekingsbevestiging wordt genoemd.",
            "Kennelijke prijsfouten (bijvoorbeeld een bedrag dat een factor tien afwijkt) binden noch ons noch de aanbieder. Constateren wij een dergelijke fout, dan informeren wij u onverwijld; u kunt de boeking dan kosteloos annuleren.",
            "Hoe servicekosten zijn samengesteld, staat in [Servicekosten](https://mybestdays.dk/rechtliches/servicegebuehren). Over belastingen en heffingen zie het [Belastingbeleid](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Betaling",
          paragraphs: [
            "Betalingen via het platform worden afgewikkeld door betaaldienstverlener Stripe. Betaalgegevens (bijvoorbeeld kaartgegevens) worden rechtstreeks door Stripe verzameld en verwerkt; myBestDays slaat geen volledige kaartgegevens op.",
            "Wanneer welk bedrag verschuldigd wordt — aanbetaling, restbetaling of betaling ter plaatse — hangt af van de advertentie en wordt vóór het afronden van de boeking getoond. Bijzonderheden regelen de [Betalingsvoorwaarden](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Is in de advertentie een borg vermeld, dan kan deze worden voorgeautoriseerd of geïncasseerd en bij schade geheel of gedeeltelijk worden ingehouden; bepalend zijn de gegevens in de advertentie.",
            "Mislukt een betaling of wordt zij teruggeboekt, dan kan de boeking worden geannuleerd. De aanbieder kan de op grond van zijn annuleringsvoorwaarden ontstane bedragen blijven vorderen.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Beleidsregels",
          paragraphs: [
            "Naast deze voorwaarden gelden de volgende beleidsregels, die deel uitmaken van de overeenkomst tussen u en ons:",
          ],
          list: [
            "[Richtlijnen voor passende inhoud](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Beoordelingsbeleid](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Antidiscriminatiebeleid](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Basisregels voor gasten](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Annuleringsvoorwaarden](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Omboekings- en restitutiebeleid](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Beleid bij ernstige verstoringen](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Auteursrechtbeleid](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Privacy en cookies",
          paragraphs: [
            "Hoe wij persoonsgegevens verwerken, staat in de [Privacyverklaring](https://mybestdays.dk/rechtliches/datenschutz). Welke cookies en vergelijkbare technieken wij inzetten, staat in het [Cookiebeleid](https://mybestdays.dk/rechtliches/cookies).",
            "Voor een boeking geven wij de aanbieder de gegevens door die hij nodig heeft om de logiesdienst te verrichten. De aanbieder is daarvoor zelfstandig verwerkingsverantwoordelijke; voor hem gelden de [Privacynormen voor hosts](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Toegankelijkheid",
          paragraphs: [
            "Onze stand van zaken rond de toegankelijkheid van het platform en de weg om drempels te melden beschrijft de [Toegankelijkheidsverklaring](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Gegevens over de toegankelijkheid van een accommodatie komen van de aanbieder. Bent u op bepaalde kenmerken aangewezen, stem die dan vóór de boeking met de aanbieder af via de berichtenfunctie.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Beoordelingen en door gebruikers gegenereerde inhoud",
          paragraphs: [
            "Na het verblijf kunt u een beoordeling plaatsen. Beoordelingen mogen alleen worden geplaatst door wie via het platform heeft geboekt en het verblijf is begonnen of had kunnen beginnen — zo waarborgen wij dat gepubliceerde beoordelingen van daadwerkelijke gasten afkomstig zijn.",
            "Wij betalen niet voor beoordelingen, wijzigen de inhoud ervan niet en onderdrukken geen beoordeling louter omdat zij negatief is. Bijzonderheden en de gronden waarop wij een beoordeling verwijderen, staan in het [Beoordelingsbeleid](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Voor inhoud die u plaatst — beoordelingen, foto's, berichten, profielgegevens — blijft u verantwoordelijk. U verleent ons een niet-exclusief, in tijd en plaats onbeperkt, kosteloos recht om die inhoud in het kader van de exploitatie en promotie van het platform te verveelvoudigen, te bewerken (bijvoorbeeld bijsnijden, vertalen) en openbaar te maken. U kunt uw inhoud verwijderen; reeds verrichte gebruikshandelingen in reeds gepubliceerde samenstellingen blijven onaangetast.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Berichten en communicatie met de aanbieder",
          paragraphs: [
            "Berichten tussen u en de aanbieder lopen via het platform. Wij stellen de berichtenfunctie ter beschikking, maar zijn afzender noch ontvanger van de inhoud.",
            "Wij mogen berichten geautomatiseerd controleren op inbreuken op deze voorwaarden (bijvoorbeeld contactgegevens om het platform te omzeilen, fraudepatronen, onrechtmatige inhoud) en de betrokken berichten achterhouden of verwijderen. Over een verwijdering informeren wij u met een motivering volgens A17.",
            "Wij sturen u berichten over uw boeking (bevestiging, wijzigingen, aankomstinformatie) naar het opgegeven e-mailadres. Deze berichten zijn contractuele communicatie en kunnen niet worden afgemeld zolang de boeking bestaat. Reclameberichten ontvangt u alleen voor zover u hebt toegestemd of het recht dat zonder toestemming toestaat; u kunt daartegen te allen tijde bezwaar maken.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Intellectuele-eigendomsrechten",
          paragraphs: [
            "Het platform, de vormgeving, software, databanken, teksten en merken ervan zijn beschermd. U krijgt een niet-exclusief, niet-overdraagbaar recht om het platform te gebruiken voor het zoeken naar en boeken van accommodatie — meer niet.",
            "Het gebruik van onze merken en logo's regelen de [Richtlijnen voor merken](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Meent u dat inhoud op het platform inbreuk maakt op uw auteursrecht, volg dan het [Auteursrechtbeleid](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Wat te doen als er iets misgaat",
          paragraphs: [
            "Betreft het probleem de accommodatie zelf, wend u dan eerst tot de aanbieder — via de berichtenfunctie of ter plaatse. Veel problemen worden zo het snelst opgelost.",
            "Komt u met de aanbieder niet verder, of betreft het probleem het platform, de betaling of de boekingsafwikkeling, wend u dan tot ons. Hoe u ons bereikt en hoe wij klachten behandelen, staat onder [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden).",
            "Houd daarbij gereed: uw boekingsnummer, het e-mailadres van de boeking, een korte beschrijving van het probleem met uw wens hoe wij moeten helpen, en de bijbehorende bewijzen (foto's, berichten, bonnen).",
            "Is de accommodatie bij aankomst niet beschikbaar of wijkt zij wezenlijk af van de advertentie, dan geldt het [Omboekings- en restitutiebeleid](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Het platform van de Europese Commissie voor onlinegeschillenbeslechting (ODR-platform) is bij Verordening (EU) 2024/3228 ingetrokken en heeft zijn werkzaamheden gestaakt; het staat niet langer als route ter beschikking. Welke instanties in de plaats treden, staat onder [Klachten en geschillenbeslechting](https://mybestdays.dk/rechtliches/beschwerden).",
            "Hebben wij een maatregel tegen uw inhoud of uw account genomen, dan kunt u naast onze interne klachtenprocedure een op grond van artikel 21 van Verordening (EU) 2022/2065 gecertificeerde buitengerechtelijke geschillenbeslechtingsinstantie inschakelen. De beslissingen daarvan zijn voor ons niet bindend.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Maatregelen tegen ongepast gedrag",
          paragraphs: [
            "Schendt u deze voorwaarden of een van de in A9 genoemde beleidsregels, dan kunnen wij — afgestemd op ernst, frequentie en gevolgen van de schending — inhoud verwijderen of de zichtbaarheid ervan beperken, functies blokkeren, boekingen annuleren of uw account tijdelijk of blijvend blokkeren.",
            "Vóór een maatregel beoordelen wij het individuele geval. Bij kennelijk onrechtmatige inhoud, bij gevaar voor personen of bij fraude kunnen wij onmiddellijk optreden.",
            "Elke maatregel motiveren wij tegenover u en wijzen wij u op de klachtenroute — zie A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Melding van onrechtmatige inhoud en motivering van maatregelen",
          paragraphs: [
            "Iedereen kan bij ons inhoud melden die hij onrechtmatig acht. De meldprocedure op grond van artikel 16 van Verordening (EU) 2022/2065, onze contactpunten en de omgang met meldingen zijn beschreven onder [Digitaledienstenverordening](https://mybestdays.dk/rechtliches/dsa).",
            "Nemen wij een maatregel tegen door u geplaatste inhoud of tegen uw account, dan ontvangt u een motivering met vermelding van de grond, de feitelijke grondslag, de rechtsgrondslag of de geschonden contractsbepaling en de klachtmogelijkheden.",
            "Tegen elke maatregel kunt u binnen zes maanden kosteloos klagen. Klachten worden door mensen behandeld, niet uitsluitend geautomatiseerd.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Aansprakelijkheidsbeperking",
          paragraphs: [
            "Wij zijn onbeperkt aansprakelijk voor opzet en grove nalatigheid, voor schade uit aantasting van leven, lichaam of gezondheid alsmede binnen de omvang van een door ons gegeven garantie. Aanspraken op grond van productaansprakelijkheid blijven onaangetast.",
            "Voor het overige is onze aansprakelijkheid beperkt tot de voorzienbare schade die typisch voortvloeit uit schending van de verplichtingen op de nakoming waarvan u mag vertrouwen — en uitsluitend voor zover het toepasselijke recht een dergelijke beperking toestaat.",
            "Wij zijn niet aansprakelijk voor het verrichten van de logiesdienst zelf en niet voor het gedrag van aanbieders of andere gasten. Contractspartij van de logiesdienst is de aanbieder.",
            "Wij zijn niet aansprakelijk voor de juistheid van door aanbieders geplaatste gegevens, voor zover wij die niet kenden en ook niet behoorden te kennen. Krijgen wij kennis van een onrechtmatige opgave, dan treden wij onverwijld op.",
            "Verdergaande aansprakelijkheid is uitgesloten. Dwingende wettelijke aanspraken, met name consumentenrechten, blijven onaangetast.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Toepasselijk recht en bevoegde rechter",
          paragraphs: [
            "Deens recht is van toepassing — de exploitant is in Denemarken gevestigd — met uitsluiting van het Weens Koopverdrag. Dwingende consumentenbeschermingsbepalingen van de staat waar u uw gewone verblijfplaats hebt, blijven op grond van artikel 6 van Verordening (EG) nr. 593/2008 (Rome I) onaangetast.",
            "Als consument kunt u ons dagvaarden voor de rechter van uw woonplaats of op onze vestigingsplaats in Denemarken; wij kunnen u alleen dagvaarden voor de rechter van uw woonplaats (artikelen 17 tot en met 19 van Verordening (EU) nr. 1215/2012).",
            "Voor de accommodatieovereenkomst geldt in de regel het recht van de staat waar de accommodatie is gelegen; voor vorderingen uit huur van onroerend goed zijn de gerechten van die staat bij uitsluiting bevoegd.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Gekoppelde reisarrangementen",
          paragraphs: [
            "myBestDays bemiddelt uitsluitend logiesdiensten. Wij bieden vluchten, huurauto's, vervoersdiensten, excursies noch attracties aan en stellen geen pakketreizen samen in de zin van Richtlijn (EU) 2015/2302.",
            "Mochten wij in de toekomst verdere reisdiensten bemiddelen, dan wijzen wij u vóór de boeking met het wettelijk voorgeschreven standaardformulier erop of een pakketreis dan wel een gekoppeld reisarrangement ontstaat en welke rechten u daaraan ontleent.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Duur, blokkering en beëindiging",
          paragraphs: [
            "De overeenkomst over het gebruik van het platform geldt voor onbepaalde tijd. U kunt uw account te allen tijde zonder opgave van redenen verwijderen; bestaande boekingen blijven onaangetast en worden afgewikkeld volgens de voorwaarden van de betreffende aanbieder.",
            "Wij kunnen de gebruiksovereenkomst met een termijn van 14 dagen opzeggen. Bij een ernstige schending van deze voorwaarden kunnen wij per direct opzeggen en het account blokkeren.",
            "Na beëindiging verwijderen wij uw gegevens, voor zover geen wettelijke bewaarplicht of gerechtvaardigd belang bij bewaring zich daartegen verzet; bijzonderheden regelt de [Privacyverklaring](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Wijzigingsbeding",
          paragraphs: [
            "Wij kunnen deze voorwaarden wijzigen wanneer daarvoor een zakelijke grond bestaat — bijvoorbeeld gewijzigde wetgeving, hoogste rechtspraak, nieuwe of vervallen functies van het platform of het opvullen van leemtes.",
            "Wijzigingen kondigen wij ten minste 30 dagen vóór inwerkingtreding schriftelijk aan. Maakt u vóór de inwerkingtreding geen bezwaar, dan gelden de gewijzigde voorwaarden als aanvaard; op dit gevolg wijzen wij in de aankondiging afzonderlijk. Maakt u bezwaar, dan kunnen wij de gebruiksovereenkomst opzeggen per de datum van inwerkingtreding.",
            "Voor reeds gesloten boekingen gelden de voorwaarden in de versie die op het moment van boeken gold.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Accommodaties",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Reikwijdte van dit onderdeel",
          paragraphs: [
            "Dit onderdeel geldt voor het boeken van accommodaties via het platform — vakantieobjecten evenals kamers en eenheden van accommodatiebedrijven.",
            "Het vult onderdeel A aan. Bij tegenstrijdigheid gaat dit onderdeel B voor.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Contractuele verhouding",
          paragraphs: [
            "De accommodatieovereenkomst komt uitsluitend tot stand tussen u en de aanbieder. myBestDays is geen contractspartij.",
            "De weergave van een accommodatie op het platform is een uitnodiging aan u om een boekingsaanbod te doen. Met de klik op de betaalplichtige boekingsknop doet u een bindend aanbod.",
            "De overeenkomst komt tot stand wanneer de boeking wordt bevestigd. De boekingsbevestiging sturen wij naar het door u opgegeven e-mailadres; zij noemt de aanbieder, de geboekte dienst, de periode, de totaalprijs en de annuleringsvoorwaarden.",
            "Bij accommodaties met aanvraagboeking komt de overeenkomst pas tot stand door aanvaarding door de aanbieder. Tot dan kan uw betaalmiddel worden voorgeautoriseerd, maar niet belast.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Wat wij doen",
          paragraphs: [
            "Wij stellen het platform ter beschikking, tonen de advertenties van de aanbieders, nemen uw boeking in ontvangst, sturen die door naar de aanbieder en zenden u de boekingsbevestiging.",
            "Wij wikkelen de betaling af voor zover de advertentie betaling via het platform voorziet, en stellen de berichtenfunctie tussen u en de aanbieder ter beschikking.",
            "Wij stellen de accommodatie niet ter beschikking, exploiteren die niet en staan niet in voor de gesteldheid ervan. Wij zijn niet uw reisorganisator.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Wat u moet doen",
          paragraphs: [
            "Bekijk vóór de boeking de advertentie volledig: voorzieningen, bezettingsgrens, aankomst- en vertrektijden, huisregels, annuleringsvoorwaarden en de kosten die pas ter plaatse verschuldigd zijn.",
            "Houd u aan de in de advertentie vermelde maximale bezetting. Reizen er meer personen af dan geboekt, dan kan de aanbieder de toegang weigeren of een toeslag verlangen.",
            "Neem de huisregels van de aanbieder en de [Basisregels voor gasten](https://mybestdays.dk/rechtliches/grundregeln-gaeste) in acht. U behandelt de accommodatie zorgvuldig en bent aansprakelijk voor schade die u of uw medereizigers veroorzaken.",
            "Heeft de aanbieder of een instantie gegevens nodig voor de registratie (bijvoorbeeld registratieformulier, identiteitsgegevens, verklaring toeristenbelasting), stel die dan tijdig ter beschikking.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Prijzen en betaling",
          paragraphs: [
            "De totaalprijs omvat de overnachtingsprijs voor de geboekte periode en de in de advertentie vermelde toeslagen en kosten die via het platform worden afgerekend.",
            "Ter plaatse kunnen aanvullende bedragen verschuldigd worden — met name toeristenbelasting of plaatselijke heffingen, een borg alsmede extra diensten die u pas ter plaatse boekt. Deze vermelden wij vóór het afronden van de boeking als kosten ter plaatse, voor zover de aanbieder ze heeft opgegeven.",
            "Voorziet de advertentie in een aanbetaling, dan wordt het restbedrag opeisbaar op het in de advertentie genoemde moment. Blijft de restbetaling uit, dan kan de aanbieder volgens zijn annuleringsvoorwaarden de overeenkomst ontbinden.",
            "Betalingen aan de aanbieder buiten het platform nemen wij niet in ontvangst en kunnen wij niet nagaan; zij vallen niet onder onze betalingsafwikkeling — zie [Kosten buiten het platform](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Wijzigingen, annuleringen en restituties",
          paragraphs: [
            "Of en onder welke voorwaarden een boeking kosteloos kan worden geannuleerd of gewijzigd, hangt af van de in de advertentie vermelde annuleringsvoorwaarden van de aanbieder. De voorwaarden die wij aanbieders ter keuze stellen, zijn beschreven onder [Annuleringsvoorwaarden](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "Bij logiesdiensten die voor een bepaalde periode worden geboekt, bestaat in de regel geen wettelijk herroepingsrecht op grond van artikel 16, onder l), van Richtlijn 2011/83/EU respectievelijk de overeenkomstige nationale bepalingen. Dwingende wettelijke rechten blijven onaangetast.",
            "Annuleert de aanbieder, dan vergoeden wij het via het platform betaalde bedrag volledig. Daarnaast geldt het [Omboekings- en restitutiebeleid](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Verhindert een gebeurtenis buiten de macht van beide partijen de reis of het verblijf, dan geldt het [Beleid bij ernstige verstoringen](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Restituties vinden plaats op het voor de betaling gebruikte betaalmiddel, tenzij anders overeengekomen.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Wat u verder moet weten",
          paragraphs: [
            "Aanbieders kunnen particuliere hosts of handelaren zijn. Of een aanbieder als handelaar optreedt, vermelden wij in de advertentie. Betreft het geen handelaar, dan gelden de consumentenbeschermingsbepalingen van de Unie niet voor de accommodatieovereenkomst — hierop wijzen wij u in de advertentie.",
            "Gegevens over ligging, omgeving, afstanden en beoordelingen van derden dienen ter oriëntatie. Bindend zijn de gegevens over de geboekte dienst zelf.",
            "In gebieden met een registratieplicht voor kortetermijnverhuur vermelden wij het door de aanbieder opgegeven registratienummer in de advertentie; zie [Kortetermijnverhuur](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Bij meerdere identieke eenheden van een object- of kamertype boekt u één eenheid van dat type. Welke concrete eenheid u krijgt, bepaalt de aanbieder.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Begrippenlijst",
      paragraphs: [
        "De volgende begrippen hebben in deze voorwaarden de hier genoemde betekenis.",
      ],
      definitions: [
        {
          term: "Aanbieder",
          description:
            "De natuurlijke of rechtspersoon die accommodatie via het platform aanbiedt en contractspartij van de accommodatieovereenkomst wordt.",
        },
        {
          term: "Aanvraagboeking",
          description:
            "Een boeking die pas tot stand komt na uitdrukkelijke aanvaarding door de aanbieder, in tegenstelling tot een directe boeking.",
        },
        {
          term: "Boekingsbevestiging",
          description:
            "Het bericht waarmee wij u de totstandkoming van de accommodatieovereenkomst bevestigen; het bevat aanbieder, dienst, periode, totaalprijs en annuleringsvoorwaarden.",
        },
        {
          term: "Eenheid",
          description:
            "Het concrete boekbare object onder een object- of kamertype. Verkocht wordt de eenheid, beschreven en geprijsd wordt het type.",
        },
        {
          term: "Totaalprijs",
          description:
            "Het bij het afronden van de boeking vermelde bedrag inclusief alle belastingen en alle via het platform afgerekende kosten.",
        },
        {
          term: "Maximale bezetting",
          description:
            "Het in de advertentie vermelde grootste toegestane aantal personen dat in de accommodatie mag overnachten.",
        },
        {
          term: "Borg",
          description:
            "Een bedrag dat de aanbieder als zekerheid voor schade verlangt en dat wordt voorgeautoriseerd of geïncasseerd en na het verblijf wordt vrijgegeven of verrekend.",
        },
        {
          term: "Toeristenbelasting",
          description:
            "Een plaatselijke heffing op overnachtingen, die naargelang de gemeente ter plaatse of via de aanbieder wordt geheven; zij is geen dienst van myBestDays.",
        },
        {
          term: "Platform",
          description:
            "De website, de mobiele applicaties en alle overige toegangen waarmee myBestDays accommodaties toont en boekingen bemiddelt.",
        },
        {
          term: "Servicekosten",
          description:
            "De vergoeding voor de bemiddelingsdienst van myBestDays. Wie ze draagt en hoe ze worden vermeld, staat onder Servicekosten.",
        },
        {
          term: "Annuleringsvoorwaarden",
          description:
            "De door de aanbieder gekozen regels over tot wanneer en tegen welke kosten een boeking kan worden geannuleerd of gewijzigd.",
        },
        {
          term: "Accommodatie",
          description:
            "De door de aanbieder aangeboden logiesdienst — een vakantieobject of een eenheid van een kamer- of objecttype.",
        },
        {
          term: "Kosten ter plaatse",
          description:
            "Bedragen die niet via het platform worden afgerekend maar bij de aanbieder verschuldigd zijn, zoals toeristenbelasting, borg of ter plaatse geboekte extra diensten.",
        },
      ],
    },
  ],
};
