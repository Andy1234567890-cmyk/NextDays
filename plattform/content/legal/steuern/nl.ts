import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Belastingbeleid",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "Deze pagina legt uit welke belastingen en heffingen bij een boeking via myBestDays kunnen ontstaan, wie ze verschuldigd is en welke meldplichten ons als platformexploitant treffen.",
    "Zij is geen fiscaal advies. Voor uw fiscale behandeling in het concrete geval wendt u zich tot een belastingadviseur.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Wat gasten betreft",
      paragraphs: [
        "De getoonde totaalprijs bevat de belastingen die via het platform worden afgerekend — met name de btw over de logiesdienst, voor zover de aanbieder die verschuldigd is.",
        "Plaatselijke heffingen zoals toeristenbelasting, bedbelasting of toerismeheffing worden naargelang de gemeente hetzij via het platform afgerekend hetzij ter plaatse geheven. Welk geval geldt, vermelden wij vóór het afronden van de boeking.",
        "Een factuur voor de logiesdienst stelt de aanbieder op; hij is de presterende ondernemer. Hebt u een factuur met btw-vermelding nodig, vraag die dan bij de aanbieder aan.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Wat aanbieders betreft",
      paragraphs: [
        "Aanbieders zijn zelf verantwoordelijk voor de juiste fiscale behandeling van hun inkomsten — inkomsten- of vennootschapsbelasting, btw en plaatselijke heffingen.",
        "Of een verhuur btw-plichtig is en welk tarief geldt, hangt af van het recht van de staat waar de accommodatie is gelegen (plaats van dienst bij onroerend goed).",
        "Aanbieders voeren de voor hun accommodatie geldende heffingen in het object in, zodat die correct in de advertentie worden vermeld.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Melding aan de belastingautoriteiten (DAC7)",
      paragraphs: [
        "Als exploitant van een digitaal platform zijn wij op grond van Richtlijn (EU) 2021/514 („DAC7“) en de nationale uitvoeringsbepalingen verplicht jaarlijks gegevens over meldplichtige aanbieders en de via het platform behaalde vergoedingen aan de bevoegde belastingautoriteit te melden.",
        "Gemeld worden met name naam, adres, fiscaal identificatienummer, geboortedatum of registratienummer, rekeninggegevens voor de uitbetaling, adres van de accommodatie en de per kwartaal betaalde vergoedingen alsmede ingehouden kosten.",
        "Aanbieders ontvangen een kopie van de over hen gemelde gegevens.",
        "Verstrekt een aanbieder de voor de melding vereiste gegevens ondanks twee verzoeken niet, dan zijn wij verplicht uitbetalingen achter te houden en het account te blokkeren.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Inhoudingen",
      paragraphs: [
        "Verplicht het recht van een staat ons van een uitbetaling belasting in te houden en af te dragen, dan doen wij dat en vermelden wij de inhouding in de afrekening.",
      ],
    },
  ],
};
