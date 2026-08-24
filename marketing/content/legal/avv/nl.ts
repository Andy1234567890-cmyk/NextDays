// Niederländische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin und
// werden von da in alle Sprachfassungen übernommen (in `de.ts` stehen auch die
// Belege für die technischen und organisatorischen Maßnahmen und die Liste der
// Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Verwerkersovereenkomst",
  metaDescription:
    "Verwerking in opdracht op grond van artikel 28 AVG tussen myNextDays ApS en de bedrijven die het platform gebruiken: onderwerp, instructies, beveiliging, subverwerkers.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Deze overeenkomst (hierna “Verwerkersovereenkomst”) geldt tussen het bedrijf dat het platform myNextDays gebruikt (hierna “verwerkingsverantwoordelijke”) en ${ANBIETER.firma} (hierna “verwerker” of “wij”) en werkt de verplichtingen uit artikel 28 van Verordening (EU) 2016/679 (AVG) nader uit.`,
    `Zij wordt door de [algemene voorwaarden](${AGB_URL}) van toepassing verklaard en geldt voor de volledige duur van het gebruik van het platform. Zij heeft voorrang op de algemene voorwaarden, voor zover het gaat om de verwerking van persoonsgegevens in opdracht.`,
    "Aanvullend geldt de [privacyverklaring](/datenschutz) voor de gegevens die wij als eigen verwerkingsverantwoordelijke verwerken — in het bijzonder de gegevens van het account en van de zakelijke relatie.",
  ],
  sections: [
    {
      heading: "Onderwerp en rolverdeling",
      unterpunkte: [
        {
          paragraphs: [
            "Onderwerp is de verwerking van persoonsgegevens die de verwerkingsverantwoordelijke in het platform invoert of daarmee verzamelt, zodat wij de contractueel overeengekomen diensten kunnen leveren: beheer van objecten, reserveringen en bezetting, communicatie met gasten, betalingsverwerking, boekhouding en eigenarenafrekening, koppeling met boekingsportalen, websitebouwer alsmede taken- en teambeheer.",
          ],
        },
        {
          paragraphs: [
            "De verwerkingsverantwoordelijke beslist over de doeleinden en de middelen van deze verwerking. Wij verwerken de gegevens uitsluitend op zijn gedocumenteerde instructie en niet voor eigen doeleinden.",
          ],
        },
        {
          paragraphs: [
            "Voor de gegevens van het account, de facturering van onze eigen diensten, de systeembeveiliging en de wettelijke bewaring zijn wij zelf verwerkingsverantwoordelijke. Die verwerking is geen onderwerp van deze Verwerkersovereenkomst.",
          ],
        },
      ],
    },
    {
      heading: "Aard, omvang en doel van de verwerking",
      paragraphs: [
        "Er wordt verwerkt door verzamelen, opslaan, weergeven, wijzigen, doorgeven aan door de verwerkingsverantwoordelijke gekozen ontvangers (bijv. boekingsportalen, betaaldienstverleners), beperken en wissen — in geautomatiseerde vorm in het platform.",
        "De plaats van verwerking is de Europese Unie; uitzonderingen zijn in afdeling 8 uitputtend benoemd.",
      ],
    },
    {
      heading: "Categorieën van betrokkenen",
      list: [
        "Gasten en boekers, met inbegrip van medereizigers",
        "Belangstellenden die aanvragen doen of berichten sturen",
        "Eigenaren van de beheerde objecten",
        "Medewerkers van de verwerkingsverantwoordelijke (team, schoonmaak, service, receptie)",
        "Contactpersonen van partners en dienstverleners van de verwerkingsverantwoordelijke",
      ],
    },
    {
      heading: "Categorieën van persoonsgegevens",
      list: [
        "Basisgegevens: naam, adres, geboortedatum indien vastgelegd, nationaliteit indien voor de meldplicht vastgelegd",
        "Contactgegevens: e-mailadres, telefoonnummer",
        "Boekingsgegevens: periode, object, aantal reizigers, prijzen, extra diensten, annuleringen",
        "Betaalgegevens: bedrag, valuta, betaalwijze, betaalstatus, referenties (volledige kaartgegevens bereiken onze systemen niet)",
        "Communicatiegegevens: berichten, notities, beoordelingen",
        "Toegangs- en gebruiksgegevens van de medewerkers: rol, rechten, tijdstip van aanmelding, apparaat en IP-adres van de aanmelding",
        "Bijzondere categorieën in de zin van artikel 9 AVG zijn geen onderwerp van de opdracht; de verwerkingsverantwoordelijke voert dergelijke gegevens niet in vrijetekstvelden in.",
      ],
    },
    {
      heading: "Instructies",
      unterpunkte: [
        {
          paragraphs: [
            "Instructies geeft de verwerkingsverantwoordelijke door het gebruik en de configuratie van het platform alsmede in tekstvorm aan ons contactadres. Mondelinge instructies bevestigen wij in tekstvorm.",
          ],
        },
        {
          paragraphs: [
            "Achten wij een instructie onrechtmatig, dan melden wij dit onverwijld en mogen wij de uitvoering opschorten totdat de verwerkingsverantwoordelijke haar bevestigt of wijzigt.",
          ],
        },
        {
          paragraphs: [
            "Zijn wij wettelijk tot verwerking verplicht (bijvoorbeeld tegenover autoriteiten), dan informeren wij de verwerkingsverantwoordelijke vooraf, voor zover ons dat rechtens is toegestaan.",
          ],
        },
        {
          titel: "Koppeling van eigen diensten van de verwerkingsverantwoordelijke",
          paragraphs: [
            "De verwerkingsverantwoordelijke kan zijn account via een interface koppelen met een dienst die hij zelf heeft gekozen en waarmee hij een eigen overeenkomst heeft gesloten — bijvoorbeeld een AI-assistent. Geeft hij een dergelijke koppeling, dan is dat zijn uitdrukkelijke instructie op grond van artikel 28, lid 3, onder a), AVG om de vrijgegeven gegevens aan deze dienst te verstrekken. Zij omvat uitdrukkelijk ook een daarmee verbonden doorgifte naar een derde land, wanneer de dienst buiten de Europese Unie is gevestigd.",
            "Kort gezegd: over een dergelijke koppeling beslist alleen de verwerkingsverantwoordelijke, en voor de gekoppelde dienst is hij zelf verantwoordelijk.",
            "Geven kan haar alleen een account met het recht om externe koppelingen te beheren. Dit recht is voorbehouden aan de rol “Beheerder”; accounts met beperkte rechten — ook de rol “Co-beheerder” — kunnen geen koppeling geven. Wij leggen vast wie haar wanneer voor welke dienst heeft gegeven, welke soorten gegevens zijn vrijgegeven en welke opvragingen hebben plaatsgevonden; deze vastlegging staat de verwerkingsverantwoordelijke in de interface onder “Account → Verbindingen” ter beschikking, zodat hij aan zijn verantwoordingsplicht kan voldoen en verzoeken om inzage kan beantwoorden.",
            "De gekoppelde dienst is geen subverwerker van ons: wij geven hem geen opdracht, wij selecteren hem niet en wij geven hem geen instructies. Hij verwerkt de gegevens op grond van de overeenkomst die de verwerkingsverantwoordelijke zelf met hem heeft gesloten. Voor deze verwerking, voor de rechtsgrondslag daarvan en voor de waarborgen van de doorgifte naar een derde land is daarom de verwerkingsverantwoordelijke verantwoordelijk; zij is geen onderwerp van deze Verwerkersovereenkomst.",
            "Vrijetekstvelden — boekingsnotities en de inhoud van gastberichten — zijn van een dergelijke koppeling standaard uitgesloten. Zij kunnen bijzondere categorieën van persoonsgegevens in de zin van artikel 9 AVG bevatten, bijvoorbeeld gegevens over de gezondheid. De verwerkingsverantwoordelijke moet ze bij het geven van de koppeling afzonderlijk vrijgeven; zonder deze vrijgave worden ze niet doorgegeven.",
            "De verwerkingsverantwoordelijke kan een gegeven koppeling op elk moment in de interface verbreken. De vernieuwingstokens worden daarbij gewist, en bij elke verdere opvraging wordt gecontroleerd of de toestemming nog bestaat — een verbroken dienst kan daarom onmiddellijk niets meer lezen, niet pas na het verstrijken van zijn toegangstoken.",
          ],
        },
      ],
    },
    {
      heading: "Vertrouwelijkheid",
      paragraphs: [
        "Alle personen die in het kader van de opdracht toegang tot de gegevens kunnen hebben, zijn tot vertrouwelijkheid verplicht en worden regelmatig over gegevensbescherming geïnstrueerd. De toegang is beperkt tot wat voor de betreffende taak noodzakelijk is.",
        "Toegang van onze medewerkers tot klantgegevens vindt alleen plaats voor het oplossen van storingen, op verzoek van de support of ter nakoming van wettelijke verplichtingen.",
      ],
    },
    {
      heading: "Beveiliging van de verwerking",
      paragraphs: [
        "Wij nemen de technische en organisatorische maatregelen die op grond van artikel 32 AVG vereist zijn. Uitgevoerd zijn in het bijzonder:",
      ],
      list: [
        "Transportversleuteling (TLS) voor alle verbindingen, HTTP-beveiligingsheaders inclusief een strikte Content-Security-Policy",
        "Scheiding van de bedrijven rechtstreeks in de database: op rijen gebaseerde toegangsregels (Row Level Security) plus ontnomen tabelrechten voor gevoelige gegevens, zodat toegang buiten het eigen bedrijf ook via de directe databaseweg uitgesloten is",
        "Op rollen gebaseerde rechten met scheiding van gegevens: service- en schoonmaakmedewerkers krijgen geen financiële en verkoopgegevens, eigenaren alleen hun eigen objecten; gastgegevens worden voor rollen zonder recht daarop gemaskeerd",
        "Tweefactorauthenticatie (TOTP) beschikbaar voor accounts; opnieuw aanmelden bij veiligheidskritische wijzigingen",
        "Logboek van de aanmeldingen met apparaat, tijdstip en IP-adres, in te zien door de verwerkingsverantwoordelijke",
        "Verbindingen met externe diensten kan alleen een account met de rol “Beheerder” geven; elke opvraging via een dergelijke verbinding wordt vastgelegd (hulpmiddel, tijdstip, omvang — zonder de inhoud zelf) en is voor de verwerkingsverantwoordelijke in te zien. Een verbroken verbinding verliest de toegang onmiddellijk: bij elke opvraging wordt gecontroleerd of de toestemming nog bestaat",
        "Beperking van de frequentie van verzoeken tegen geautomatiseerde aanvallen, controle van de signaturen van inkomende Webhook-aanroepen",
        "Versleutelde back-ups die buiten het productiesysteem worden bewaard, met regelmatige hersteltest",
        "Gescheiden omgevingen voor ontwikkeling en productie; wijzigingen aan de database uitsluitend via geversioneerde migraties",
      ],
    },
    {
      heading: "Subverwerkers",
      paragraphs: [
        "De verwerkingsverantwoordelijke geeft toestemming voor de inzet van de volgende subverwerkers. Met elk van hen bestaan overeenkomsten op grond van artikel 28, lid 4, AVG met verplichtingen die overeenkomen met deze Verwerkersovereenkomst.",
      ],
      list: [
        "Hetzner Online GmbH, Duitsland (server, database, media, mailserver; datacenter Helsinki, Finland)",
        "Stripe Payments Europe, Limited, Ierland (betalingen, uitbetalingen, wettelijke identiteitsverificatie)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg (betalingen, indien de verwerkingsverantwoordelijke ze activeert)",
        "Channex.io Ltd, Verenigd Koninkrijk (koppeling met boekingsportalen, indien geactiveerd)",
        "Meta Platforms Ireland Limited, Ierland (WhatsApp-berichten, indien geactiveerd)",
        "Google Ireland Limited, Ierland (vertaling van inhoud; aanmelden met Google, indien gebruikt)",
        "Groq, Inc., Verenigde Staten (antwoordsuggesties in het postvak in, indien geactiveerd)",
        "Cloudflare, Inc., Verenigde Staten (beheer van de DNS-records voor eigen domeinen, indien gebruikt)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Een wisseling of een aanvulling melden wij ten minste 30 dagen vooraf. De verwerkingsverantwoordelijke kan binnen deze termijn bezwaar maken om een gewichtige reden die verband houdt met de gegevensbescherming; wordt het bezwaar niet weggenomen, dan kan hij het betreffende onderdeel van de dienst of de overeenkomst opzeggen.",
          ],
        },
        {
          paragraphs: [
            "Diensten die de verwerkingsverantwoordelijke zelf met een derde overeenkomt, zijn geen verwerking in subopdracht, maar een door hem veroorzaakte doorgifte. Dat geldt voor een boekingsportaal waarmee hij een eigen overeenkomst heeft, evenals voor een AI-assistent of een ander programma dat hij via de interface met zijn account verbindt (zie de afdeling “Instructies”).",
            "Beslissend is daarbij niet via wiens systemen de gegevens lopen, maar wie de dienst erbij betrekt: verwerking in subopdracht ontstaat wanneer WIJ een verdere dienstverlener opdracht geven om onze dienst te leveren. Kiest de verwerkingsverantwoordelijke de dienst zelf en sluit hij de overeenkomst met hem, dan verwerkt deze dienst voor de verwerkingsverantwoordelijke — niet voor ons. Dit onderscheid stemt overeen met de contractpraktijk van vergelijkbare aanbieders voor door de klant verbonden diensten van derden.",
          ],
        },
      ],
    },
    {
      heading: "Doorgifte naar derde landen",
      paragraphs: [
        "Doorgiften aan ontvangers buiten de EU blijven beperkt tot de hierboven genoemde diensten met vestiging in de Verenigde Staten respectievelijk het Verenigd Koninkrijk. Grondslag zijn de standaardcontractbepalingen van de Europese Commissie op grond van artikel 46, lid 2, onder c), AVG of een geldend adequaatheidsbesluit; aanvullende beschermingsmaatregelen (versleuteling, gegevensminimalisering) worden toegepast.",
      ],
    },
    {
      heading: "Bijstand aan de verwerkingsverantwoordelijke",
      unterpunkte: [
        {
          paragraphs: [
            "Wij staan de verwerkingsverantwoordelijke bij bij het beantwoorden van verzoeken van betrokkenen (artikelen 15 tot en met 22 AVG). Het platform biedt daarvoor inzage, rectificatie, export en wissing van de gegevens rechtstreeks in de interface. Wenden betrokkenen zich rechtstreeks tot ons, dan verwijzen wij hen naar de verwerkingsverantwoordelijke en informeren wij hem.",
          ],
        },
        {
          paragraphs: [
            "Wij staan verder bij bij gegevensbeschermingseffectbeoordelingen, bij de naleving van de verplichtingen uit de artikelen 32 tot en met 36 AVG en bij verzoeken van toezichthoudende autoriteiten.",
          ],
        },
      ],
    },
    {
      heading: "Inbreuken in verband met persoonsgegevens",
      paragraphs: [
        "Wordt ons een inbreuk in verband met persoonsgegevens bekend die gegevens van de verwerkingsverantwoordelijke betreft, dan informeren wij hem onverwijld, uiterlijk binnen 48 uur na kennisneming, in tekstvorm.",
        "De melding bevat, voor zover bekend, de aard en het tijdstip van het incident, de betrokken categorieën van gegevens en groepen van personen, de waarschijnlijke gevolgen en de genomen alsmede de voorgestelde maatregelen. Wij staan de verwerkingsverantwoordelijke bij bij zijn meldings- en kennisgevingsplichten op grond van de artikelen 33 en 34 AVG.",
      ],
    },
    {
      heading: "Bewijzen en controles",
      unterpunkte: [
        {
          paragraphs: [
            "Wij tonen de naleving van deze Verwerkersovereenkomst op verzoek aan, in het bijzonder door informatie te verstrekken over de genomen maatregelen en over de ingezette subverwerkers.",
          ],
        },
        {
          paragraphs: [
            "De verwerkingsverantwoordelijke kan controles in de vereiste omvang uitvoeren of laten uitvoeren door een onafhankelijke auditor die niet met ons in concurrentie staat. Controles vinden plaats na aankondiging met een redelijke termijn, tijdens de gebruikelijke kantooruren en zonder verstoring van de bedrijfsvoering. De kosten van een controle die verder gaat dan het verstrekken van informatie draagt de verwerkingsverantwoordelijke, voor zover de controle niet is ingegeven door een incident dat door ons is veroorzaakt.",
          ],
        },
      ],
    },
    {
      heading: "Wissing en teruggave",
      paragraphs: [
        "Na het einde van de overeenkomst stellen wij de gegevens van de verwerkingsverantwoordelijke op verzoek binnen 30 dagen in een gangbaar, machineleesbaar formaat beschikbaar voor export. Daarna wissen wij de gegevens met inbegrip van de kopieën.",
        "Uitgezonderd zijn gegevens waarvoor een wettelijke bewaarplicht bestaat (in het bijzonder factuur- en boekhoudgegevens); deze worden geblokkeerd en na het verstrijken van de termijn gewist. Back-ups worden met de reguliere rotatiecyclus overschreven.",
      ],
    },
    {
      heading: "Aansprakelijkheid en rangorde",
      paragraphs: [
        "Artikel 82 AVG is van toepassing. In de verhouding tussen de partijen gelden daarnaast de aansprakelijkheidsregels van de algemene voorwaarden, voor zover zij niet in strijd zijn met de AVG.",
        "Zijn de algemene voorwaarden en deze Verwerkersovereenkomst met elkaar in strijd bij de verwerking in opdracht, dan geldt deze Verwerkersovereenkomst. Wordt een bepaling ongeldig, dan blijft de overige inhoud geldig; de partijen vervangen haar door een toelaatbare regeling met hetzelfde doel.",
      ],
    },
    {
      heading: "Wijzigingen van deze overeenkomst",
      paragraphs: [
        "Wij mogen deze Verwerkersovereenkomst aanpassen, voor zover dat door wetswijzigingen, eisen van toezichthoudende autoriteiten, voorschriften van betaaldienstverleners of technische ontwikkelingen noodzakelijk wordt en de verwerkingsverantwoordelijke daardoor niet in een slechtere positie komt.",
        "Wijzigingen kondigen wij ten minste 30 dagen voor de inwerkingtreding in tekstvorm aan. Maakt de verwerkingsverantwoordelijke binnen deze termijn geen bezwaar, dan gelden zij als aanvaard; op dit gevolg wordt in de aankondiging gewezen. Bij bezwaar kan elke partij de overeenkomst opzeggen per het tijdstip van de inwerkingtreding.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Vragen over deze overeenkomst, instructies en meldingen richt u aan [${ANBIETER.email}](mailto:${ANBIETER.email}) of aan ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen, damit bestehende Importe halten.
export default avv;
