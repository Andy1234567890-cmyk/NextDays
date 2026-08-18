import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Priser, rangordning och rekommendationer",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Denna sida förklarar hur priser visas på myBestDays, vad som styr ordningen på sökresultaten och hur rekommendationer uppstår. Den uppfyller transparenskraven i artikel 6a i direktiv 2005/29/EG, artikel 5 i förordning (EU) 2019/1150 och artikel 27 i förordning (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Hur priser visas",
      paragraphs: [
        "Så snart period och antal resenärer är fastställda visar vi totalpriset för hela vistelsen, inklusive skatter och alla avgifter som avräknas via plattformen.",
        "Så länge ingen period valts visar vi ett pris per natt för orientering och märker det som sådant.",
        "Kostnader som förfaller först på plats anger vi separat före slutförandet av bokningen. De ingår inte i totalpriset men är synliga före bokningen.",
        "Visar vi ett överstruket jämförelsepris är det det lägsta pris som leverantören begärt för samma tjänst under de senaste 30 dagarna före nedsättningen (artikel 6a i direktiv 98/6/EG).",
        "Priser är lika för alla gäster. Vi anpassar inte priset efter din person, din enhet eller ditt tidigare sökbeteende.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Vad som styr ordningen på sökresultaten",
      paragraphs: [
        "I standardsorteringen bestämmer följande faktorer ordningen, i fallande betydelse:",
      ],
      list: [
        "överensstämmelse med din sökning — tillgänglighet under den sökta perioden, kapacitet för antalet resenärer, läge i det sökta området och satta filter;",
        "annonsens fullständighet och kvalitet — beskrivning, bilder, underhållna utrustningsuppgifter;",
        "omdömen — helhetsbetyg och antal omdömen;",
        "leverantörens pålitlighet — svarsbeteende, acceptansgrad och avbokningar från leverantören;",
        "hur aktuella priser och tillgänglighet är;",
        "pris-prestandaförhållandet jämfört med liknande annonser i samma område.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Betald placering",
      paragraphs: [
        "En leverantör kan inte köpa sig en bättre plats i standardsorteringen. Serviceavgiftens storlek påverkar inte ordningen.",
        "Skulle vi framöver erbjuda betalda placeringar märker vi dem otvetydigt som annons och skiljer dem synligt från övriga resultat.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Ändra sortering",
      paragraphs: [
        "Du kan när som helst ändra sorteringen, t.ex. efter pris eller omdöme. Vilken sortering som är aktiv visas ovanför resultatlistan.",
        "Du har tillgång till minst en sortering som inte bygger på profilering i den mening som avses i artikel 4.4 i förordning (EU) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Rekommendationer",
      paragraphs: [
        "Visar vi dig förslag („kan intressera dig“, „liknande boenden“) bygger dessa på den aktuella sökningen, på tidigare visade annonser och på egenskaper hos liknande boenden.",
        "Du kan stänga av personaliserade rekommendationer i ditt konto. Därefter ser du förslag som enbart bygger på den aktuella sökningen.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Omdömen i rangordningen",
      paragraphs: [
        "Hur omdömen uppstår och kontrolleras framgår av [Omdömespolicy](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Omdömen påverkar ordningen, men vi varken viktar enskilda omdömen högre eller undertrycker negativa.",
      ],
    },
  ],
};
