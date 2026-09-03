// Partner-AGB — Niederländisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Deelnamevoorwaarden van het myNextDays-partnerprogramma: Attributie, Provisiebasis, Staffels, Teamprovisie, Verbodsbepalingen, Markering, Uitbetaling.",
  numbered: false,
  toc: true,
  title: "Deelnamevoorwaarden Partnerprogramma (Partner-AV) — Concept",
  standIso: "2026-09-02",
  intro: [
    "CONCEPT — Deze voorwaarden zijn een werkversie van myNextDays en zijn nog niet juridisch getoetst. Tot de vrijgave van de getoetste versie gelden zij als beschrijving van het programma, niet als definitieve contracttekst. De getoetste versie zal onder dit adres met een nieuw versienummer worden gepubliceerd; partners zullen bij de volgende aanmelding opnieuw om instemming worden gevraagd.",
    `Deze deelnamevoorwaarden regelen de deelname aan het partnerprogramma (affiliateprogramma) van ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (hierna te noemen "myNextDays" of "wij") door partners (hierna te noemen "Partner").`,
    "Het partnerprogramma richt zich op personen en bedrijven gevestigd in de EU, Zwitserland of het Verenigd Koninkrijk, die bedrijven (verhuurders, agentschappen, hotels) aanbevelen op myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Deelname en goedkeuring",
      paragraphs: [
        "Deelname vereist een aanmelding via het partnerdashboard. Verplichte gegevens zijn naam of bedrijfsnaam, rechtsvorm, land, ten minste één socialmedia-account met adres, handle en bereik, en voor bedrijven het btw-identificatienummer.",
        "myNextDays beoordeelt elke aanmelding persoonlijk en beslist vrij over de goedkeuring. Er bestaat geen recht op opname. Deelname is gratis; een abonnement op myNextDays is geen vereiste.",
        "De Partner houdt zijn gegevens actueel, met name kanalen, rechtsvorm, belasting- en uitbetalingsgegevens.",
        "Het opgegeven bereik is in eerste instantie een zelfverklaring. De Partner kan zijn accounts op YouTube, Instagram, Facebook en TikTok vrijwillig koppelen; dan worden volgers en weergaven van het platform gelezen en als geverifieerd aangemerkt. Niet-geverifieerd bereik wordt bij de goedkeuring en bij latere controles minder zwaar gewogen. De koppeling kan te allen tijde in het dashboard worden verbroken; details over de verwerking staan in de privacyverklaring.",
      ],
    },
    {
      heading: "§ 2 Toewijzing van bedrijven (attributie)",
      paragraphs: [
        "Een bedrijf wordt aan de Partner toegewezen als het zich registreert met de aanbevelingscode van de Partner. De code wordt bij de registratie zichtbaar aan het bedrijf getoond en door verzending bevestigd. Trackingcookies worden niet geplaatst.",
        "Een bedrijf wordt aan precies één Partner toegewezen; bepalend is de bij de registratie bevestigde code. Een latere herordening vindt alleen plaats door myNextDays bij bewezen fouten.",
        "Niet toegewezen worden bedrijven van de Partner zelf, zijn aandeelhouders, medewerkers of familieleden, evenals bedrijven die reeds klant van myNextDays zijn of waren.",
      ],
    },
    {
      heading: "§ 3 Provisie op eigen klanten",
      paragraphs: [
        "De provisiebasis is de netto abonnementsomzet van het toegewezen bedrijf (basistarief en modules) uit betaalde facturen — zonder btw, zonder portaalprovisies, aanvullende diensten, nabetalingen en andere doorlopende posten.",
        "Het provisiepercentage is afhankelijk van de rang van de partner op het moment van betaling. De rangen en percentages zijn gepubliceerd op de programmapagina. De rang wordt bepaald door het aantal betalende klanten in de structuur van de partner: zijn eigen betalende klanten en de betalende klanten van zijn team-partners (§ 4), elke klant één keer. De rang wordt maandelijks op de peildatum vastgesteld; een promotie geldt onmiddellijk, een degradatie pas als het aantal op twee opeenvolgende peildata onder de drempel lag.",
        "Bereikt de partner voor het eerst een rang vanaf “Opkomend”, dan ontvangt hij eenmalig de voor deze rang op de programmapagina vermelde promotiebonus (momenteel 50,00 EUR per rang, voor alle partners in euro). Elke rang wordt slechts één keer vergoed, ook na degradatie en opnieuw promoveren. De bonus valt onder het restitutievenster conform § 7.",
        "De provisie ontstaat per bedrijf voor twaalf maanden vanaf de eerste betalingsplichtige abonnementsfactuur; een via de partner bemiddelde gratis proefperiode en een gratis maand tellen niet mee. Eindigt het abonnement eerder, dan eindigt de provisie met de laatst betaalde factuur.",
        "Vanaf de rang “Elite-partner” ontvangt de partner bovendien een superprovisie ter hoogte van het op de programmapagina vermelde bedrag (momenteel 2,5%) op de netto-abonnementsomzet van alle klanten in zijn structuur — eigen klanten en klanten van zijn team-partners — zonder de grens van twaalf maanden, zolang de betreffende klant een betalend abonnement heeft en de partner de rang op het moment van betaling bezit. Deze ontstaat naast de provisie conform zin 2 en § 4.",
        "Vanaf de rang “Elite-partner” ontvangt de partner voor elke via myBestDays ontvangen en betaalde boeking van een bedrijf dat aan hem of een van zijn team-partners is toegewezen een boekingsaandeel ter hoogte van het op de programmapagina vermelde bedrag (momenteel 0,5%) van het door de gast betaalde boekingsbedrag in de boekingsvaluta, zonder tijdsbeperking, zolang de toewijzing bestaat en de partner de rang op het moment van de boekingsbetaling bezit. Borgsommen zijn geen boekingsbedrag. Restituties aan de gast verminderen het aandeel pro rata (§ 7).",
      ],
    },
    {
      heading: "§ 4 Teamprovisie",
      paragraphs: [
        "Vanaf de rang “Opkomend” mag een partner team-partners leiden. Solliciteert een andere partner via de team-link van de partner en bevestigt deze zijn code zichtbaar in zijn sollicitatie, dan wordt hij na zijn goedkeuring toegewezen aan het team van de partner (hierna “Sponsor”). Indien de Sponsor de rang op het moment van de sollicitatie niet bezit, blijft de sollicitatie geldig, maar ontstaat er geen team-toewijzing.",
        "De Sponsor ontvangt op de netto-abonnementsomzet van de klanten van zijn team-partners een teamprovisie ter hoogte van het verschil tussen zijn eigen provisiepercentage en het provisiepercentage van de team-partner, telkens volgens de rang op het moment van betaling. Staan beiden in dezelfde rang of de team-partner hoger, dan ontstaat er geen teamprovisie. Provisie van de team-partner en teamprovisie van de Sponsor overschrijden samen nooit het hoogste percentage van de staffel (momenteel 30%).",
        "De teamprovisie bestaat precies één niveau diep: teampartners ontvangen geen teamprovisie op partners die zij zelf werven. Voor het werven van een partner wordt geen vergoeding betaald; een deelnamebijdrage wordt niet geheven. De teamprovisie ontstaat uitsluitend uit betaalde abonnementsomzet.",
        "De teamprovisie loopt per teamklant twaalf maanden vanaf de eerste betaalde factuur, is onderworpen aan hetzelfde restitutievenster en wordt bij restitutie of terugboeking pro rata teruggenomen (§ 7). Deze ontstaat alleen zolang sponsor en teampartner zijn goedgekeurd; anders wordt deze aangehouden tot opheldering.",
        "De teamtoewijzing is eenmalig. Een wijziging vindt alleen plaats door myNextDays met gedocumenteerde reden.",
      ],
    },
    {
      heading: "§ 5 Plichten van de partner en markering",
      paragraphs: [
        "De partner markeert elke aanbeveling met zijn link of code als reclame — aan het begin van de bijdrage, in de taal van de bijdrage, conform de voorschriften van zijn land (in Duitsland o.a. § 5a lid 4 UWG, in Denemarken markedsføringsloven § 6 lid 4). Formuleringen per land stelt myNextDays ter beschikking in het partner-dashboard.",
        "De partner verstrekt over myNextDays alleen informatie die overeenkomt met de gepubliceerde prestatiebeschrijvingen, en doet geen toezeggingen namens myNextDays. In het bijzonder zijn succes- en garantiebeloften (bijvoorbeeld „gegarandeerde volledige bezetting in drie dagen”) evenals uitspraken over inkomsten die niet voortvloeien uit de gepubliceerde prestatiebeschrijvingen verboden.",
        "Elke video en elke bijdrage die myNextDays noemt of de link van de partner draagt, wordt vóór publicatie als bestand in het partner-dashboard ter controle voorgelegd. De link van de partner ontstaat pas na schriftelijke goedkeuring door myNextDays; publicatie zonder goedkeuring is verboden. myNextDays kan een goedkeuring intrekken; reeds ontstane provisies blijven onaangetast.",
        "Voor logo's, schermopnamen, B-Roll, overlays en screenshots gebruikt de partner uitsluitend het door myNextDays ter beschikking gestelde reclamemateriaal. Eigen, niet-gecontroleerde software-opnamen zijn niet toegestaan.",
      ],
    },
    {
      heading: "§ 6 Verboden praktijken",
      paragraphs: ["In het bijzonder zijn verboden:"],
      list: [
        "Brand-Bidding: betaalde advertenties op het merk „myNextDays”, schrijfwijzen en combinaties (bijv. „myNextDays Prijzen”) in zoekmachines en netwerken;",
        "Cookie-dropping, verborgen doorverwijzingen, iFrames, geautomatiseerd oproepen van de partnerlink of andere technische manipulatie van de toewijzing;",
        "Zelfpromotie: registratie van eigen bedrijven, van aandeelhouders, medewerkers of familieleden via de eigen code of de code van een teampartner;",
        "gekocht bereik (gekochte volgers, klikfarms, bot-verkeer) evenals prikkels aan bedrijven voor de registratie (terugbetalingen, geschenken, prijsvragen);",
        "Wervingsbeloften: het werven van partners met inkomensbeloften die niet afkomstig zijn uit betaalde abonnementsomzet, of de presentatie van het programma als inkomstenbron door het werven van verdere partners;",
        "Spam, ongeoorloofde directe reclame en het gebruik van merken of inhoud van derden zonder recht.",
      ],
    },
    {
      heading: "§ 7 Terugbetalingsperiode, terugname, inhouding",
      paragraphs: [
        "Elke provisieregel staat na het ontstaan ervan 30 dagen open (terugbetalingsperiode) en is daarna uitbetaalbaar. Indien een onderliggende factuur geheel of gedeeltelijk wordt terugbetaald of teruggevorderd (chargeback), wordt de provisie — inclusief een daarop gebaseerde teamprovisie — pro rata teruggenomen, ook na uitbetaling door verrekening met toekomstige provisies.",
        "Bij vermoeden van een overtreding van § 2, § 5 of § 6 mag myNextDays toewijzingen en provisies inhouden tot opheldering. Indien de overtreding wordt bevestigd, vervallen de betreffende provisies.",
      ],
    },
    {
      heading: "§ 8 Uitbetaling en creditnota",
      paragraphs: [
        "Uitbetaalbare provisies worden maandelijks per valuta gebundeld en uitbetaald, zodra zij het op de programmapagina respectievelijk in het dashboard vermelde minimumbedrag van de betreffende valuta bereiken. Een omrekening tussen valuta's vindt niet plaats.",
        "De afrekening geschiedt middels een creditnota (zelffacturering, momsloven § 52a): myNextDays stelt per uitbetaling een creditnota op; de partner stelt geen factuur op. De partner stemt in met de creditnotaprocedure.",
        "Ondernemers ontvangen de creditnota met een verwijzing naar de belastingplicht van de ontvanger van de prestatie (reverse charge); voorwaarde is een geldig, bevestigd btw-identificatienummer. Particulieren ontvangen de creditnota zonder btw en belasten de provisie zelf.",
        "De uitbetaling geschiedt per SEPA-overschrijving, Wise of PayPal naar de door de partner in het dashboard opgegeven gegevens.",
      ],
    },
    {
      heading: "§ 9 Gegevens en inzage",
      paragraphs: [
        "De partner ziet toegewezen bedrijven pseudoniem (nummer, land, status, bedragen). Namen, e-mailadressen of boekingsgegevens van de bedrijven worden niet openbaar gemaakt. Een sponsor ziet van zijn teampartners naam respectievelijk firma, rang, aantal betalende klanten en de daaruit voortvloeiende teamprovisie, geen klantdetails.",
        "Voor gekoppelde accounts en aangemaakte bijdragen ziet myNextDays volgers, weergaven, interacties, evenals klikken en klanten per bijdrage. Opvallende zaken (bijvoorbeeld een sprong in volgers zonder passende weergaven of een duidelijke afwijking tussen zelfopgave en geverifieerde waarde) zijn aanwijzingen voor een persoonlijke controle conform § 6 en § 10, geen automatische blokkering.",
        "De verwerking van persoonsgegevens in het partnerprogramma is beschreven in de privacyverklaring.",
      ],
    },
    {
      heading: "§ 10 Looptijd, blokkering en opzegging",
      paragraphs: [
        "De deelname heeft een onbepaalde looptijd en kan door beide partijen te allen tijde schriftelijk worden beëindigd. Reeds ontstane, uitbetaalbare provisies worden conform § 8 uitbetaald; na beëindiging ontstaan geen nieuwe provisies.",
        "myNextDays mag de partner blokkeren bij overtredingen van deze voorwaarden. Tijdens de blokkering worden provisies ingehouden; bij bevestigde overtreding vervallen deze.",
      ],
    },
    {
      heading: "§ 11 Wijzigingen",
      paragraphs: [
        "myNextDays kan deze voorwaarden en de staffel met werking voor de toekomst wijzigen. Wijzigingen worden in het partner-dashboard en op deze pagina met versienummer gepubliceerd; bij wezenlijke wijzigingen wordt de partner om hernieuwde instemming gevraagd. Reeds ontstane provisies blijven onaangetast.",
      ],
    },
    {
      heading: "§ 12 Toepasselijk recht",
      paragraphs: [
        "Deense wetgeving is van toepassing, met uitsluiting van het conflictenrecht. Dwingende consumentenbeschermingsbepalingen van de staat waar een particuliere partner zijn gewone verblijfplaats heeft, blijven onaangetast.",
      ],
    },
  ],
};
