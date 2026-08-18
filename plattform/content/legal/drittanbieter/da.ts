import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tredjeparter og betalingstjenester",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "myBestDays anvender tredjeparters tjenester til driften af platformen. Denne side nævner dem og forklarer, hvilken rolle de har, og hvis vilkår der gælder.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsætning",
      paragraphs: [
        "Hvor en tredjepart leverer en ydelse direkte til dig, gælder dennes vilkår og privatlivspolitik ud over vores. Vi gør opmærksom herpå det pågældende sted.",
        "Hvor en tredjepart udelukkende behandler på vores vegne, forbliver vi din kontaktpart. Hvilke databehandlere vi anvender, fremgår af [Privatlivspolitik](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Betalingstjenesteudbyder",
      paragraphs: [
        "Betalinger via platformen afvikles af Stripe. Stripe indsamler og behandler betalingsdata direkte og er selvstændig dataansvarlig herfor. Desuden gælder [Stripes privatlivspolitik](https://stripe.com/privacy).",
        "Til udbetaling til værter gennemfører Stripe den lovpligtige identitetskontrol.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Betalingstjenestedirektivet og tredjeparters adgang",
      paragraphs: [
        "Direktiv (EU) 2015/2366 („PSD2“) kræver stærk kundeautentifikation ved mange betalinger. Din bank eller kortudsteder gennemfører den; uden vellykket autentifikation kan en betaling afvises.",
        "myBestDays er ikke en betalingsinitieringstjeneste eller kontooplysningstjeneste og tilgår ikke dine bankkonti.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Kort, billeder og indlejret indhold",
      paragraphs: [
        "Til kortvisninger og stedoplysninger indlejrer vi tredjeparters korttjenester. Ved indlæsning af sådant indhold kan data overføres til den pågældende udbyder; nærmere og samtykkestyringen fremgår af [Cookiepolitik](https://mybestdays.dk/rechtliches/cookies).",
        "Billeder og beskrivelser i opslag kommer fra den pågældende udbyder, ikke fra os.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Links til andre sider",
      paragraphs: [
        "Platformen kan linke til tredjeparters sider. Vi har ingen indflydelse på deres indhold og påtager os intet ansvar herfor. Får vi kendskab til en retskrænkelse, fjerner vi linket straks.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. App-butikker",
      paragraphs: [
        "Henter du myBestDays-appen via en app-butik, gælder desuden den pågældende butiksoperatørs vilkår. Butiksoperatøren er ikke part i aftalen mellem dig og os og skylder hverken support eller garanti for appen.",
      ],
    },
  ],
};
