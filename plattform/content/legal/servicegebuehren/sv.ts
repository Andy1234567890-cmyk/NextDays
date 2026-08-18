import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Serviceavgifter",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "myBestDays finansieras genom en serviceavgift på förmedlade bokningar. Denna sida förklarar vem som betalar den, hur den beräknas och var den anges.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Vem som betalar serviceavgiften",
      paragraphs: [
        "Serviceavgiften bärs av leverantören. Den dras av från bokningsvärdet och minskar utbetalningen till denne; gästen betalar den inte utöver.",
        "Uppstår undantagsvis en serviceavgift för gästen vid en bokning anger vi den före slutförandet av bokningen som en egen post i totalpriset. Utan denna angivelse tillkommer ingen avgift för gästen.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Hur den beräknas",
      paragraphs: [
        "Serviceavgiften är en procentandel av det bokningsvärde som avräknas via plattformen. Den sats som gäller för dina bokningar anges i ditt värdkonto och i det avtal du godkände vid registreringen.",
        "Beräkningsunderlag är övernattningspriset jämte de tillägg som avräknas via plattformen. Inte medräknade är genomgångsposter som inte är en motprestation från leverantören — särskilt turistskatt och deposition.",
        "Serviceavgiften beräknas och anges i annonsens valuta.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Moms",
      paragraphs: [
        "På serviceavgiften utgår moms i den mån den enligt lag ska betalas. Om den anges eller om omvänd betalningsskyldighet gäller beror på leverantörens etablering och status.",
        "Om serviceavgiften utfärdar vi leverantören en avräkning som finns tillgänglig i dennes konto.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Avbokning och återbetalning",
      paragraphs: [
        "Återbetalas en bokning i sin helhet återbetalar vi serviceavgiften proportionellt i den omfattning bokningsvärdet återbetalas.",
        "Avbokar leverantören utan viktigt skäl bortfaller serviceavgiften inte automatiskt; vi förbehåller oss rätten att göra gällande de kostnader som avbokningen medfört.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Ändring av serviceavgiften",
      paragraphs: [
        "En ändring av satsen aviserar vi till leverantörer minst 30 dagar före ikraftträdandet på ett varaktigt medium; detta motsvarar artikel 3.2 i förordning (EU) 2019/1150.",
        "För redan bekräftade bokningar gäller den sats som gällde vid bokningstillfället.",
      ],
    },
  ],
};
