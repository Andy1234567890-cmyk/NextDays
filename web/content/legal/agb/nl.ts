import type { LegalDoc } from "../types";

// Niederländische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen
// immer zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (recommended disclosure language) — Wortlaut und URLs nicht verändern.
export const agb: LegalDoc = {
  title: "Algemene voorwaarden (AV) voor agentschappen en verhuurders",
  stand: "Laatst bijgewerkt: 26 juli 2026",
  intro: [
    "Deze algemene voorwaarden (hierna “Voorwaarden”) regelen het gebruik van het softwareplatform myNextDays (hierna “Platform”) door agentschappen, verhuurders, vastgoedbeheerders en andere zakelijke gebruikers (hierna “Gebruiker”).",
    "Het Platform wordt geëxploiteerd door [volledige bedrijfsnaam, rechtsvorm, adres en registergegevens van de exploitant — vóór publicatie aanvullen] (hierna “myNextDays” of “wij”).",
    "Het Platform is uitsluitend bedoeld voor ondernemers in de zin van § 14 van het Duitse Burgerlijk Wetboek (BGB) dan wel de overeenkomstige bepalingen van de betreffende EU-lidstaat. Het is niet bedoeld voor consumenten.",
  ],
  sections: [
    {
      heading: "§ 1 Toepassingsgebied",
      paragraphs: [
        "Deze Voorwaarden gelden voor alle overeenkomsten over het gebruik van het Platform tussen myNextDays en de Gebruiker alsmede voor alle daarmee ter beschikking gestelde diensten en modules.",
        "Afwijkende, strijdige of aanvullende voorwaarden van de Gebruiker worden alleen onderdeel van de overeenkomst indien myNextDays uitdrukkelijk in tekstvorm met de toepasselijkheid ervan heeft ingestemd.",
      ],
    },
    {
      heading: "§ 2 Onderwerp van de overeenkomst en diensten",
      paragraphs: [
        "myNextDays stelt de Gebruiker cloudgebaseerde software ter beschikking voor het beheer van vakantieaccommodaties en logiesbedrijven. De functionaliteit blijkt uit de telkens actuele dienstbeschrijving en omvat in het bijzonder:",
      ],
      list: [
        "beheer van objecten, bezettingskalenders en reserveringen (property-management-systeem),",
        "koppeling met boekingskanalen van derden (bijv. Booking.com, Airbnb) via een channelmanager,",
        "publicatie van aanbiedingen via het platformeigen boekingskanaal myNextDays,",
        "het maken van eigen websites via de geïntegreerde pagebuilder,",
        "boekhoud-, afrekenings- en rapportagefuncties, waaronder eigenarenafrekeningen,",
        "communicatie met gasten en het accepteren van betalingen via de geïntegreerde betalingsverwerking (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registratie, account en gegevens van de Gebruiker",
      paragraphs: [
        "Voor het gebruik van het Platform is de registratie van een account vereist. De Gebruiker is verplicht bij de registratie en gedurende de gehele looptijd van de overeenkomst juiste, actuele en volledige gegevens over zichzelf en zijn onderneming te verstrekken en deze bij wijzigingen onverwijld bij te werken.",
        "Inloggegevens moeten geheim worden gehouden en tegen toegang door derden worden beschermd. De Gebruiker dient myNextDays onverwijld te informeren indien er aanwijzingen zijn voor misbruik van zijn account.",
        "Een account is niet overdraagbaar. De Gebruiker zorgt ervoor dat alle personen die het account namens hem gebruiken deze Voorwaarden naleven.",
      ],
    },
    {
      heading: "§ 4 Rol van myNextDays bij boekingen",
      paragraphs: [
        "Logiesovereenkomsten voor de accommodaties die op het Platform, via gekoppelde kanalen van derden of via de eigen website van de Gebruiker worden aangeboden, komen uitsluitend tot stand tussen de Gebruiker (respectievelijk de door hem vertegenwoordigde eigenaar) en de betreffende gast. myNextDays wordt geen partij bij de logiesovereenkomst.",
        "Voor de juistheid en rechtmatigheid van de inhoud van de aanbiedingen (beschrijvingen, foto’s, prijzen, beschikbaarheid, belastingen en heffingen) is uitsluitend de Gebruiker verantwoordelijk.",
      ],
    },
    {
      heading: "§ 5 Betalingsverwerking door Stripe",
      paragraphs: [
        "De betalingsverwerkingsdiensten voor agentschappen en verhuurders op myNextDays worden geleverd door Stripe en vallen onder de [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), die de servicevoorwaarden van Stripe omvat (gezamenlijk de “Stripe-dienstenovereenkomst”). Door met deze Voorwaarden in te stemmen of door als agentschap of verhuurder actief te blijven op myNextDays, verklaart de Gebruiker zich gebonden aan de Stripe-dienstenovereenkomst, die van tijd tot tijd door Stripe kan worden gewijzigd.",
        "Als voorwaarde voor het mogelijk maken van betalingsverwerkingsdiensten via Stripe door myNextDays verstrekt de Gebruiker myNextDays juiste en volledige informatie over zichzelf en zijn onderneming en machtigt hij myNextDays om deze informatie en transactiegegevens die verband houden met zijn gebruik van de door Stripe geleverde betalingsverwerkingsdiensten met Stripe te delen.",
        "Voor de rechtsverhouding met Stripe is de gelinkte Engelstalige contracttekst in de telkens geldende versie bepalend. Contractpartij voor gebruikers in de Europese Economische Ruimte is de in de Stripe-dienstenovereenkomst genoemde Stripe-vennootschap (momenteel Stripe Payments Europe, Limited, Ierland). Stripe verwerkt persoonsgegevens overeenkomstig de [privacyverklaring van Stripe](https://stripe.com/privacy).",
        "Ter nakoming van wettelijke identificatie- en verificatieverplichtingen (onder meer witwaspreventie, “know your customer”) kunnen myNextDays en Stripe te allen tijde aanvullende gegevens en bewijsstukken verlangen, in het bijzonder identiteitsdocumenten, gegevens over uiteindelijk belanghebbenden en bankgegevens. Worden opgevraagde gegevens of bewijsstukken niet binnen de gestelde termijn verstrekt, dan kunnen de acceptatie van betalingen of de uitbetalingen geheel of gedeeltelijk worden opgeschort totdat de gegevens volledig zijn.",
      ],
    },
    {
      heading: "§ 6 Uitbetalingen, terugboekingen en negatieve saldi",
      paragraphs: [
        "De betalingsroute hangt af van het boekingskanaal. Bij boekingen via de eigen boekingsmodule van de gebruiker en bij boekingen via aangesloten distributieportalen worden betalingen van gasten rechtstreeks op de betaalrekening van de gebruiker ontvangen; in die gevallen is de gebruiker tegenover de gast de begunstigde van de betaling en de contractpartij voor de accommodatiedienst (§ 4), en wordt myNextDays op geen enkel moment houder van deze gelden. myNextDays brengt op dergelijke boekingen geen procentuele boekingsvergoeding in rekening; de commissie voor boekingen via aangesloten distributieportalen wordt afzonderlijk vermeld en achteraf gefactureerd.",
        "Bij boekingen die via het myNextDays-boekingsportaal tot stand komen, wordt de betaling via myNextDays afgewikkeld. myNextDays houdt daarbij de in de op dat moment geldende prijslijst vermelde bemiddelingscommissie in, inclusief de kosten van de betalingsverwerking, en maakt het resterende bedrag conform de onderstaande leden over aan de gebruiker. De vergoeding voor het gebruik van de software (§ 7) blijft hierdoor onverlet.",
        "Uitbetalingen vinden plaats op de door de Gebruiker opgegeven bankrekening. myNextDays kan het uitbetalingsritme om risicoredenen aanpassen, in het bijzonder bij nieuwe accounts, opvallende transactiepatronen of lopende controles.",
        "Terugbetalingen aan gasten komen economisch voor rekening van de gebruiker. Terugboekingen (chargebacks) en de daaruit voortvloeiende kosten komen voor rekening van de gebruiker bij boekingen via de eigen boekingsmodule van de gebruiker en via aangesloten distributieportalen, aangezien de gebruiker in die gevallen de begunstigde van de betaling is; bij boekingen via het myNextDays-boekingsportaal draagt myNextDays het terugboekingsrisico, tenzij de terugboeking het gevolg is van een tekortkoming van de gebruiker (met name het niet leveren van of een wezenlijke afwijking in de accommodatiedienst). myNextDays is gerechtigd door de gebruiker te dragen bedragen te verrekenen met toekomstige uitbetalingen.",
        "Ontstaat op de betaalrekening van de Gebruiker een negatief saldo, dan dient de Gebruiker dit onverwijld aan te zuiveren. De Gebruiker machtigt myNextDays en Stripe om negatieve saldi van de opgegeven bankrekening te incasseren, voor zover dit wettelijk is toegestaan.",
      ],
    },
    {
      heading: "§ 7 Vergoedingen en facturering",
      paragraphs: [
        "De vergoedingen voor het gebruik van het Platform blijken uit de bij het sluiten van de overeenkomst overeengekomen prijslijst dan wel de individuele offerte. Alle prijzen zijn exclusief de telkens wettelijk verschuldigde belastingen en luiden in de in de overeenkomst vermelde valuta.",
        "Transactiegebonden vergoedingen (bijv. betalings- of kanaalkosten) kunnen direct bij de verwerking van de betreffende transactie worden ingehouden of verrekend.",
        "Raakt de Gebruiker in verzuim met betalingen, dan kan myNextDays de toegang tot het Platform na voorafgaande aankondiging blokkeren totdat de openstaande vorderingen zijn voldaan.",
      ],
    },
    {
      heading: "§ 8 Verplichtingen van de Gebruiker; eigen juridische teksten",
      paragraphs: [
        "De Gebruiker zorgt ervoor dat zijn aanbiedingen, content en handelspraktijken voldoen aan de telkens toepasselijke wetgeving, in het bijzonder het logies-, registratie-, belasting- en consumentenrecht op de locatie van de accommodatie. Vereiste vergunningen, registraties en licenties houdt de Gebruiker onder eigen verantwoordelijkheid aan.",
        "Voor websites die de Gebruiker via de pagebuilder exploiteert alsmede voor zijn aanbiedingen op het Platform is de Gebruiker zelf verantwoordelijk; daartoe behoren in het bijzonder eigen algemene voorwaarden voor gasten, een eigen colofon en eigen privacy-informatie.",
        "Verboden zijn in het bijzonder: het plaatsen van onjuiste of misleidende aanbiedingen, het afwikkelen van schijntransacties of frauduleuze transacties, het omzeilen van de betalingsverwerking volgens § 5 voor via het Platform tot stand gekomen boekingen, alsmede elk gebruik dat de veiligheid of beschikbaarheid van het Platform aantast.",
      ],
    },
    {
      heading: "§ 9 Boekingskanalen van derden",
      paragraphs: [
        "Bij de koppeling van kanalen van derden (bijv. Booking.com, Airbnb) gelden aanvullend de voorwaarden van de betreffende kanaalexploitant. De Gebruiker sluit de daarvoor vereiste overeenkomsten zelf met de kanaalexploitant.",
        "myNextDays verzorgt de technische synchronisatie van beschikbaarheid, prijzen en boekingsgegevens, maar heeft geen invloed op de inhoud, commissies of beslissingen van de kanaalexploitanten en is niet aansprakelijk voor hun beschikbaarheid.",
      ],
    },
    {
      heading: "§ 10 Beschikbaarheid en doorontwikkeling",
      paragraphs: [
        "myNextDays verleent de diensten met de zorgvuldigheid van een goed ondernemer en streeft naar een hoge beschikbaarheid van het Platform. Onderhoudsvensters, doorontwikkelingen en omstandigheden buiten de invloedssfeer van myNextDays (bijv. storingen bij derde aanbieders) kunnen de beschikbaarheid tijdelijk beperken.",
        "myNextDays mag het Platform doorontwikkelen en functies wijzigen, voor zover het doel van de overeenkomst daardoor niet in gevaar komt en de wijziging voor de Gebruiker redelijk is.",
      ],
    },
    {
      heading: "§ 11 Gegevens en gegevensbescherming",
      paragraphs: [
        "Voor zover myNextDays bij het ter beschikking stellen van het Platform persoonsgegevens in opdracht van de Gebruiker verwerkt (in het bijzonder gastgegevens), sluiten partijen een verwerkersovereenkomst overeenkomstig art. 28 AVG.",
        "De Gebruiker blijft verantwoordelijk voor de rechtmatigheid van het verzamelen en verwerken van de door hem ingebrachte gegevens. Details over de gegevensverwerking door myNextDays blijken uit de privacy-informatie van het Platform; voor de gegevensverwerking door Stripe geldt § 5.",
      ],
    },
    {
      heading: "§ 12 Intellectuele eigendom",
      paragraphs: [
        "Alle rechten op het Platform, de software en de inhoud ervan (met uitzondering van de door de Gebruiker geplaatste content) komen toe aan myNextDays respectievelijk haar licentiegevers. De Gebruiker verkrijgt voor de looptijd van de overeenkomst een eenvoudig, niet-overdraagbaar recht om het Platform te gebruiken in de contractueel overeengekomen omvang.",
        "Op de door de Gebruiker geplaatste content verleent de Gebruiker aan myNextDays de voor de exploitatie van het Platform vereiste eenvoudige gebruiksrechten (in het bijzonder voor opslag, verveelvoudiging, weergave en doorgifte aan gekoppelde kanalen).",
      ],
    },
    {
      heading: "§ 13 Aansprakelijkheid",
      paragraphs: [
        "myNextDays is onbeperkt aansprakelijk voor opzet en grove nalatigheid alsmede voor schade als gevolg van letsel aan leven, lichaam of gezondheid.",
        "Bij lichte nalatigheid is myNextDays alleen aansprakelijk voor de schending van wezenlijke contractuele verplichtingen (kardinale verplichtingen), beperkt tot de voor de overeenkomst typische, voorzienbare schade. De aansprakelijkheid op grond van het productaansprakelijkheidsrecht en uit verstrekte garanties blijft onverlet.",
        "Voor het verlies van gegevens is myNextDays alleen aansprakelijk voor zover de schade ook bij een behoorlijke, regelmatige gegevensback-up door de Gebruiker zou zijn ontstaan, tenzij de gegevensback-up contractueel de verantwoordelijkheid van myNextDays is.",
      ],
    },
    {
      heading: "§ 14 Looptijd, opzegging en blokkering",
      paragraphs: [
        "Looptijd en opzegtermijnen blijken uit de betreffende overeenkomst. Het recht op buitengewone opzegging wegens gewichtige reden blijft onverlet.",
        "myNextDays kan de toegang tot het Platform of afzonderlijke functies (waaronder het accepteren van betalingen en uitbetalingen) tijdelijk blokkeren indien er concrete aanwijzingen zijn voor een schending van deze Voorwaarden, voor fraude of voor misbruik, of indien myNextDays daartoe wettelijk of op last van een betaaldienstverlener verplicht is. De Gebruiker wordt over de blokkering geïnformeerd, voor zover dit wettelijk is toegestaan.",
        "Na het einde van de overeenkomst stelt myNextDays de gegevens van de Gebruiker op verzoek binnen 30 dagen in een gangbaar formaat beschikbaar voor export; daarna worden de gegevens gewist, voor zover geen wettelijke bewaarplichten daaraan in de weg staan.",
      ],
    },
    {
      heading: "§ 15 Wijzigingen van deze Voorwaarden",
      paragraphs: [
        "myNextDays kan deze Voorwaarden met werking voor de toekomst wijzigen, voor zover dit om gegronde redenen noodzakelijk is (in het bijzonder wetswijzigingen, wijzigingen in de rechtspraak of eisen van betaaldienstverleners) en de Gebruiker daardoor niet onredelijk wordt benadeeld.",
        "Wijzigingen worden ten minste zes weken vóór de inwerkingtreding in tekstvorm aan de Gebruiker aangekondigd. Maakt de Gebruiker niet binnen de aankondigingstermijn bezwaar of blijft hij het Platform na de inwerkingtreding gebruiken, dan gelden de gewijzigde Voorwaarden als aanvaard; op dit gevolg wordt in de aankondiging afzonderlijk gewezen.",
      ],
    },
    {
      heading: "§ 16 Slotbepalingen",
      paragraphs: [
        "Het recht van de staat waarin de exploitant haar zetel heeft is van toepassing, met uitsluiting van het Weens Koopverdrag. Dwingende bepalingen van de staat waarin de Gebruiker zijn zetel heeft blijven onverlet.",
        "Exclusief bevoegde rechter voor alle geschillen die voortvloeien uit of verband houden met deze overeenkomst is — voor zover wettelijk toegestaan — die van de zetel van de exploitant.",
        "Indien afzonderlijke bepalingen van deze Voorwaarden ongeldig zijn of worden, blijft de geldigheid van de overige bepalingen onverlet.",
      ],
    },
  ],
};
