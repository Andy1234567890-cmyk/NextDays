import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Avbokningsvillkor",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "Varje leverantör väljer ett avbokningsvillkor för sitt boende. Vilket som gäller framgår av annonsen och av din bokningsbekräftelse. Denna sida beskriver de villkor vi ställer till leverantörers förfogande.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Avbokningsvillkoren i översikt",
      paragraphs: [
        "Avgörande är alltid det villkor som anges i annonsen. Fristerna räknas från början av ankomstdagen i boendets lokala tid.",
      ],
      list: [
        "Flexibel — kostnadsfri avbokning fram till 24 timmar före ankomst. Därefter debiteras första natten, övriga nätter återbetalas.",
        "Måttlig — kostnadsfri avbokning fram till 5 dagar före ankomst. Därefter debiteras 50 % av övernattningspriset.",
        "Sträng — kostnadsfri avbokning fram till 14 dagar före ankomst, förutsatt att bokningen skedde minst 14 dagar före ankomst. Därefter debiteras 50 % fram till 7 dagar före ankomst, sedan hela priset.",
        "Ej återbetalningsbar — ingen kostnadsfri avbokning. Priset är som regel lägre; på den uteblivna återbetalningen upplyser vi särskilt före bokningen.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Vad som återbetalas i varje fall",
      paragraphs: [
        "Oavsett valt villkor återbetalar vi vid varje avbokning:",
      ],
      list: [
        "turistskatt och andra genomgångsavgifter, i den mån de avräknats via plattformen och övernattningen inte äger rum;",
        "en via plattformen dragen deposition i sin helhet;",
        "tilläggstjänster som inte har utförts.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Avbokning av leverantören",
      paragraphs: [
        "Avbokar leverantören får du tillbaka hela det belopp som betalats via plattformen — oavsett valt avbokningsvillkor.",
        "Dessutom hjälper vi dig att hitta ett jämförbart boende; se [Omboknings- och återbetalningspolicy](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Ingen lagstadgad ångerrätt",
      paragraphs: [
        "Vid logitjänster som bokas för en viss period finns som regel ingen lagstadgad ångerrätt enligt artikel 16 l i direktiv 2011/83/EU. De avbokningsvillkor som beskrivs här är därför ett avtalsmässigt åtagande, inte ett genomförande av en ångerrätt.",
        "Tvingande lagstadgade rättigheter, särskilt felansvar vid brister i boendet, påverkas inte.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Ändring i stället för avbokning",
      paragraphs: [
        "Vill du ändra period eller antal resenärer begär du ändringen via din bokning. Leverantören måste godkänna; till dess kvarstår den ursprungliga bokningen.",
        "Leder ändringen till ett högre pris förfaller mellanskillnaden. Leder den till ett lägre pris återbetalar vi mellanskillnaden i den mån gällande avbokningsvillkor tillåter det för den bortfallande delen.",
      ],
    },
    {
      id: "wie",
      heading: "6. Så avbokar du",
      paragraphs: [
        "Avboka via ditt konto under „Bokningar“. Avgörande för fristen är den tidpunkt då avbokningen når oss.",
        "Du får en avbokningsbekräftelse med återbetalningsbeloppet. Om utbetalningen se [Betalningsvillkor](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
