import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Betalingsvoorwaarden",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Deze betalingsvoorwaarden regelen hoe betalingen in verband met een boeking via myBestDays worden afgewikkeld. Zij vullen de [Gebruiksvoorwaarden voor gasten](https://mybestdays.dk/rechtliches/nutzungsbedingungen) aan; bij tegenstrijdigheid over betalingskwesties gaan deze betalingsvoorwaarden voor.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Onze rol bij de betaling",
      paragraphs: [
        "myBestDays wikkelt betalingen af in opdracht van de aanbieder. Wij zijn geen betaalinstelling en geen elektronischgeldinstelling; de betaaldienst zelf wordt verricht door onze betaaldienstverlener.",
        "Betalingen via het platform worden afgewikkeld door Stripe (Stripe Payments Europe, Limited). Kaartgegevens en andere betaalgegevens worden rechtstreeks door Stripe verzameld en verwerkt. myBestDays slaat geen volledige kaartgegevens op.",
        "Betaalt u via het platform, dan geldt uw betalingsverplichting jegens de aanbieder ten belope van het betaalde bedrag als nagekomen zodra de betaling door onze betaaldienstverlener met succes is geautoriseerd en geïncasseerd.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Betaalmethoden",
      paragraphs: [
        "Welke betaalmethoden beschikbaar zijn, hangt af van de advertentie, van het land van de aanbieder en van uw land. De beschikbare methoden worden getoond vóór het afronden van de boeking.",
        "Voor bepaalde betaalmethoden is sterke cliëntauthenticatie op grond van Richtlijn (EU) 2015/2366 vereist. Zonder geslaagde authenticatie kan de betaling niet worden uitgevoerd.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Opeisbaarheid, aanbetaling en restbetaling",
      paragraphs: [
        "Wanneer welk bedrag opeisbaar wordt, bepaalt de aanbieder in de advertentie. Gebruikelijk zijn drie modellen: volledige betaling bij boeking, aanbetaling bij boeking met restbetaling vóór aankomst, of betaling ter plaatse bij de aanbieder.",
        "Het voor uw boeking geldende model en de vervaldata worden getoond vóór het afronden van de boeking en herhaald in de boekingsbevestiging.",
        "Vóór het opeisbaar worden van de restbetaling herinneren wij u daaraan op het door u opgegeven e-mailadres. Blijft de restbetaling uit, dan kan de aanbieder volgens zijn annuleringsvoorwaarden de overeenkomst ontbinden.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Valuta",
      paragraphs: [
        "Er wordt afgerekend in de valuta van de advertentie. Deze valuta wordt bij elke prijs en bij het afrekenen vermeld.",
        "Wordt een bedrag daarnaast in een andere valuta getoond, dan is dat een vrijblijvende omrekening ter oriëntatie en geen bindende prijs.",
        "Rekent uw betaaldienstverlener om naar een andere valuta of brengt hij buitenlandkosten in rekening, dan draagt u die kosten. Zij maken geen deel uit van de totaalprijs en worden door ons noch vastgesteld noch geïnd.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Borg",
      paragraphs: [
        "Voorziet de advertentie in een borg, dan wordt de hoogte daarvan vermeld vóór het afronden van de boeking.",
        "Afhankelijk van de advertentie wordt de borg op uw betaalmiddel voorgeautoriseerd (het bedrag wordt gereserveerd maar niet afgeschreven) of geïncasseerd. Een voorautorisatie kan uw beschikbare kaartlimiet tijdelijk verlagen.",
        "Na het verblijf wordt de voorautorisatie vrijgegeven of de geïncasseerde borg terugbetaald, voor zover de aanbieder geen schade claimt. Claimt de aanbieder schade, dan moet hij die aantonen; over de gegrondheid beslist de verhouding tussen u en de aanbieder.",
        "Verlangt de aanbieder de borg in plaats daarvan ter plaatse, dan is dat een kostenpost ter plaatse en wordt zij niet via het platform afgewikkeld.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Restituties",
      paragraphs: [
        "Restituties vinden plaats op het voor de betaling gebruikte betaalmiddel, tenzij anders overeengekomen of technisch onmogelijk.",
        "Wij zetten een restitutie onverwijld in gang zodra de grond daarvoor vaststaat. Hoelang het duurt tot de creditering op uw rekening of kaart zichtbaar is, bepaalt uw betaaldienstverlener; vijf tot tien bankwerkdagen is gebruikelijk.",
        "Of en in welke omvang recht op restitutie bestaat, hangt af van de [Annuleringsvoorwaarden](https://mybestdays.dk/rechtliches/stornierungsbedingungen) en het [Omboekings- en restitutiebeleid](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Mislukte betalingen en terugboekingen",
      paragraphs: [
        "Mislukt een betaling, dan informeren wij u en geven wij u gelegenheid een ander betaalmiddel op te geven. Blijft de betaling uit, dan kan de boeking worden geannuleerd.",
        "Boekt u een reeds uitgevoerde betaling terug zonder dat recht op restitutie bestaat, dan kan de aanbieder het bedrag blijven vorderen. Kosten die ons door een ongegronde terugboeking ontstaan, kunnen wij bij u in rekening brengen.",
        "Achten wij een betaling frauduleus, dan kunnen wij die achterhouden of de boeking annuleren. Wij informeren u daarover en motiveren de beslissing.",
      ],
    },
    {
      id: "belege",
      heading: "8. Bewijsstukken en afrekeningen",
      paragraphs: [
        "Voor de via het platform betaalde bedragen stellen wij een bewijsstuk beschikbaar dat u in uw account onder „Boekingen“ kunt oproepen.",
        "Een factuur voor de logiesdienst stelt de aanbieder op; hij is de presterende ondernemer. Over belastingen zie het [Belastingbeleid](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Wijzigingen van deze betalingsvoorwaarden",
      paragraphs: [
        "Voor wijzigingen van deze betalingsvoorwaarden geldt onderdeel A22 van de [Gebruiksvoorwaarden](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
