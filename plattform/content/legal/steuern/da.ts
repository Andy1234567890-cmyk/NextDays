import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Skattepolitik",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Denne side forklarer, hvilke skatter og afgifter der kan påløbe ved en booking via myBestDays, hvem der skylder dem, og hvilke indberetningspligter der påhviler os som platformsoperatør.",
    "Den er ikke skatterådgivning. For din skattemæssige behandling i det enkelte tilfælde bør du henvende dig til en skatterådgiver.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Hvad der vedrører gæster",
      paragraphs: [
        "Den viste totalpris indeholder de skatter, der afregnes via platformen — navnlig moms på overnatningsydelsen, for så vidt udbyderen skylder den.",
        "Lokale afgifter som turistskat, sengeskat eller turismeafgift afregnes alt efter kommune enten via platformen eller opkræves på stedet. Hvilket tilfælde der gælder, oplyser vi før gennemførelsen af bookingen.",
        "En faktura for overnatningsydelsen udsteder udbyderen; denne er den leverende erhvervsdrivende. Har du brug for en faktura med moms angivet, så anmod udbyderen om den.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Hvad der vedrører udbydere",
      paragraphs: [
        "Udbydere er selv ansvarlige for den korrekte skattemæssige behandling af deres indtægter — indkomst- eller selskabsskat, moms og lokale afgifter.",
        "Om en udlejning er momspligtig, og hvilken sats der gælder, afhænger af lovgivningen i den stat, hvor indkvarteringen ligger (leveringssted ved fast ejendom).",
        "Udbydere indtaster de afgifter, der gælder for deres indkvartering, i objektet, så de oplyses rigtigt i opslaget.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Indberetning til skattemyndighederne (DAC7)",
      paragraphs: [
        "Som operatør af en digital platform er vi efter direktiv (EU) 2021/514 („DAC7“) og de nationale regler, der gennemfører det, forpligtet til årligt at indberette oplysninger om indberetningspligtige udbydere og deres vederlag opnået via platformen til den kompetente skattemyndighed.",
        "Der indberettes navnlig navn, adresse, skatteidentifikationsnummer, fødselsdato eller registreringsnummer, kontooplysninger til udbetaling, indkvarteringens adresse samt de vederlag, der er betalt pr. kvartal, og de tilbageholdte gebyrer.",
        "Udbydere modtager en kopi af de indberettede oplysninger om dem.",
        "Stiller en udbyder trods to opfordringer ikke de oplysninger til rådighed, der kræves til indberetningen, er vi forpligtet til at tilbageholde udbetalinger og spærre kontoen.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Indeholdelse",
      paragraphs: [
        "Forpligter lovgivningen i en stat os til at indeholde og afregne skat af en udbetaling, gør vi det og oplyser indeholdelsen i opgørelsen.",
      ],
    },
  ],
};
