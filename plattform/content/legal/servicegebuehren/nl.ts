import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Servicekosten",
  stand: "Bijgewerkt: 18 augustus 2026",
  intro: [
    "myBestDays financiert zich met servicekosten over bemiddelde boekingen. Deze pagina legt uit wie ze betaalt, hoe ze worden berekend en waar ze worden vermeld.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Wie de servicekosten betaalt",
      paragraphs: [
        "De servicekosten komen voor rekening van de aanbieder. Zij worden op de boekingswaarde ingehouden en verlagen de uitbetaling aan hem; de gast betaalt ze niet extra.",
        "Vallen er voor een boeking bij uitzondering servicekosten voor de gast aan, dan vermelden wij die vóór het afronden van de boeking als afzonderlijke post in de totaalprijs. Zonder die vermelding zijn er voor de gast geen kosten.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Hoe ze worden berekend",
      paragraphs: [
        "De servicekosten zijn een percentage van de via het platform afgerekende boekingswaarde. Het voor uw boekingen geldende tarief staat in uw hostaccount en in de overeenkomst waarmee u bij de registratie hebt ingestemd.",
        "Grondslag is de overnachtingsprijs vermeerderd met de via het platform afgerekende toeslagen. Niet meegerekend worden doorlopende posten die geen tegenprestatie van de aanbieder zijn — met name de toeristenbelasting en de borg.",
        "De servicekosten worden berekend en vermeld in de valuta van de advertentie.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Btw",
      paragraphs: [
        "Over de servicekosten is btw verschuldigd voor zover die wettelijk is verschuldigd. Of zij wordt vermeld dan wel de verleggingsregeling geldt, hangt af van de vestiging en de status van de aanbieder.",
        "Over de servicekosten verstrekken wij de aanbieder een afrekening die in zijn account beschikbaar is.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Annulering en restitutie",
      paragraphs: [
        "Wordt een boeking volledig gerestitueerd, dan restitueren wij de servicekosten naar rato van de gerestitueerde boekingswaarde.",
        "Annuleert de aanbieder zonder zwaarwegende reden, dan vervallen de servicekosten niet automatisch; wij behouden ons voor de door de annulering ontstane kosten te vorderen.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Wijziging van de servicekosten",
      paragraphs: [
        "Een wijziging van het tarief kondigen wij aanbieders ten minste 30 dagen vóór inwerkingtreding op een duurzame gegevensdrager aan; dat komt overeen met artikel 3, lid 2, van Verordening (EU) 2019/1150.",
        "Voor reeds bevestigde boekingen geldt het tarief dat op het moment van boeken gold.",
      ],
    },
  ],
};
