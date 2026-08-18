import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Skattepolicy",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Denna sida förklarar vilka skatter och avgifter som kan uppkomma vid en bokning via myBestDays, vem som är skyldig att betala dem och vilka rapporteringsskyldigheter som åligger oss som plattformsoperatör.",
    "Den utgör inte skatterådgivning. För din skattemässiga behandling i det enskilda fallet bör du vända dig till en skatterådgivare.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Vad som rör gäster",
      paragraphs: [
        "Det visade totalpriset innehåller de skatter som avräknas via plattformen — särskilt moms på logitjänsten, i den mån leverantören är skyldig att betala den.",
        "Lokala avgifter som turistskatt, bäddskatt eller turismavgift avräknas beroende på kommun antingen via plattformen eller tas ut på plats. Vilket fall som gäller anger vi före slutförandet av bokningen.",
        "En faktura för logitjänsten utfärdar leverantören; denne är den presterande näringsidkaren. Behöver du en faktura med momsangivelse, begär den hos leverantören.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Vad som rör leverantörer",
      paragraphs: [
        "Leverantörer ansvarar själva för korrekt skattemässig behandling av sina inkomster — inkomst- eller bolagsskatt, moms och lokala avgifter.",
        "Om en uthyrning är momspliktig och vilken sats som gäller följer av lagen i den stat där boendet är beläget (omsättningsland vid fast egendom).",
        "Leverantörer anger de avgifter som gäller för deras boende i objektet så att de anges korrekt i annonsen.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Rapportering till skattemyndigheterna (DAC7)",
      paragraphs: [
        "Som operatör av en digital plattform är vi enligt direktiv (EU) 2021/514 („DAC7“) och de nationella genomförandebestämmelserna skyldiga att årligen rapportera uppgifter om rapporteringspliktiga leverantörer och deras ersättningar via plattformen till behörig skattemyndighet.",
        "Rapporteras gör särskilt namn, adress, skatteregistreringsnummer, födelsedatum eller registernummer, kontouppgifter för utbetalning, boendets adress samt de ersättningar som betalats per kvartal och de avgifter som hållits inne.",
        "Leverantörer får en kopia av de uppgifter som rapporterats om dem.",
        "Tillhandahåller en leverantör inte de uppgifter som krävs för rapporteringen trots två uppmaningar är vi skyldiga att hålla inne utbetalningar och spärra kontot.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Innehållande",
      paragraphs: [
        "Förpliktar lagen i en stat oss att hålla inne och betala in skatt från en utbetalning gör vi det och anger innehållandet i avräkningen.",
      ],
    },
  ],
};
