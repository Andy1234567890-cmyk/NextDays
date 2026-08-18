import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tredjepartsleverantörer och betaltjänster",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "myBestDays använder tredje parts tjänster för driften av plattformen. Denna sida nämner dem och förklarar vilken roll de har och vems villkor som gäller.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Utgångspunkt",
      paragraphs: [
        "Där en tredje part utför en tjänst direkt till dig gäller dennes villkor och integritetspolicy utöver våra. Vi upplyser om detta på respektive ställe.",
        "Där en tredje part enbart behandlar på vårt uppdrag förblir vi din kontaktpart. Vilka personuppgiftsbiträden vi anlitar framgår av [Integritetspolicy](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Betaltjänstleverantör",
      paragraphs: [
        "Betalningar via plattformen hanteras av Stripe. Stripe samlar in och behandlar betalningsuppgifter direkt och är självständigt personuppgiftsansvarig för detta. Därutöver gäller [Stripes integritetspolicy](https://stripe.com/privacy).",
        "För utbetalning till värdar utför Stripe den lagstadgade identitetskontrollen.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Betaltjänstdirektivet och tredje parts åtkomst",
      paragraphs: [
        "Direktiv (EU) 2015/2366 („PSD2“) kräver stark kundautentisering för många betalningar. Din bank eller kortutgivare utför den; utan lyckad autentisering kan en betalning avvisas.",
        "myBestDays är ingen betalningsinitieringstjänst eller kontoinformationstjänst och har ingen åtkomst till dina bankkonton.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Kartor, bilder och inbäddat innehåll",
      paragraphs: [
        "För kartvisningar och platsuppgifter bäddar vi in karttjänster från tredje part. När sådant innehåll laddas kan uppgifter överföras till respektive leverantör; närmare och samtyckesstyrningen framgår av [Kakpolicy](https://mybestdays.dk/rechtliches/cookies).",
        "Bilder och beskrivningar i annonser kommer från respektive leverantör, inte från oss.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Länkade sidor",
      paragraphs: [
        "Plattformen kan länka till tredje parts sidor. På deras innehåll har vi inget inflytande och för det tar vi inget ansvar. Får vi kännedom om en rättskränkning tar vi omgående bort länken.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Appbutiker",
      paragraphs: [
        "Hämtar du myBestDays-appen via en appbutik gäller därutöver respektive butiksoperatörs villkor. Butiksoperatören är inte part i avtalet mellan dig och oss och är varken skyldig att ge support eller garanti för appen.",
      ],
    },
  ],
};
