import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Grundregler för gäster",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Dessa grundregler gäller för varje vistelse som bokats via myBestDays. De kompletterar respektive leverantörs ordningsregler — är ordningsreglerna strängare gäller de därutöver.",
    "Den som bryter mot grundreglerna får räkna med åtgärder upp till spärr av kontot och ansvarar gentemot leverantören för uppkomna skador.",
  ],
  sections: [
    {
      id: "belegung",
      heading: "1. Beläggning",
      paragraphs: [
        "I boendet övernattar endast de personer som angavs vid bokningen, och högst så många som den maximala beläggningen tillåter.",
        "Besök som inte övernattar är tillåtet, om inte ordningsreglerna föreskriver annat.",
        "Boendet får inte hyras ut i andra hand eller överlåtas.",
      ],
    },
    {
      id: "ruhe",
      heading: "2. Hänsyn och tysta tider",
      paragraphs: [
        "Ta hänsyn till grannar. Håll de tysta tider som anges i ordningsreglerna; saknas uppgift gäller den lokalt sedvanliga nattron.",
        "Fester och evenemang är inte tillåtna utan leverantörens uttryckliga tillstånd. Detta gäller även när den maximala beläggningen hålls.",
        "Kommersiell användning av boendet — t.ex. foto- eller filmproduktioner, försäljningsevenemang — kräver leverantörens föregående samtycke.",
      ],
    },
    {
      id: "umgang",
      heading: "3. Umgänge med boendet",
      paragraphs: [
        "Behandla boendet och dess inredning varsamt och lämna det i ordnat skick.",
        "Anmäl skador och störningar till leverantören omgående — inte först efter avresan. Endast så kan denne åtgärda dem och endast så behåller du dina anspråk.",
        "Du ansvarar för skador som du eller dina medresenärer orsakar. Är en deposition avtalad kan den tas i anspråk för detta.",
      ],
    },
    {
      id: "sicherheit",
      heading: "4. Säkerhet",
      paragraphs: [
        "Håll brandvarnare, brandsläckare och utrymningsvägar fria och funktionsdugliga. Brandvarnare får inte tejpas över eller tas bort.",
        "Rökning är endast tillåten om ordningsreglerna uttryckligen medger det, och endast i de områden som anvisats för detta.",
        "Vid pool, bastu, öppen spis, grill eller bubbelpool följer du leverantörens anvisningar. Barn får endast använda sådana anläggningar under uppsikt.",
      ],
    },
    {
      id: "tiere",
      heading: "5. Djur",
      paragraphs: [
        "Djur får du endast ta med om annonsen tillåter det och du angett dem vid bokningen.",
        "Assistans- och ledarhundar är alltid tillåtna, även om annonsen utesluter djur. Anmäl dem gärna i förväg så att leverantören är förberedd.",
      ],
    },
    {
      id: "anreise",
      heading: "6. Ankomst och avresa",
      paragraphs: [
        "Håll de ankomst- och avresetider som anges i annonsen. Behöver du avvikande tider, stäm av dem med leverantören i förväg.",
        "Tillhandahåll de uppgifter som leverantören behöver för registreringen (registreringsblankett, id-uppgifter, turistskatt) i god tid.",
        "Åtkomstuppgifter, nyckelkoder och nycklar lämnar du inte vidare till tredje man.",
      ],
    },
    {
      id: "kommunikation",
      heading: "7. Kommunikation",
      paragraphs: [
        "Genomför bokning, betalning och överenskommelser via plattformen. Endast då är de dokumenterade och endast då kan vi hjälpa till vid en tvist.",
        "Var saklig gentemot leverantören och vårt team. Förolämpningar och hot leder omedelbart till åtgärder mot kontot.",
      ],
    },
  ],
};
