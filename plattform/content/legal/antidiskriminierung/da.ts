import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Antidiskriminationspolitik",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "myBestDays er åben for alle. Den, der booker eller udbyder via platformen, må ikke behandle nogen ringere på grund af personlige forhold.",
    "Denne politik er en del af [Brugsvilkårene](https://mybestdays.dk/rechtliches/nutzungsbedingungen) og gælder for gæster såvel som for udbydere.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsætning",
      paragraphs: [
        "På myBestDays er det ikke tilladt at stille en person ringere på grund af oprindelse, hudfarve, statsborgerskab, etnisk tilhørsforhold, religion eller tro, køn, kønsidentitet, seksuel orientering, handicap, alder eller civilstand.",
        "Det gælder for accept eller afvisning af bookinger, for priser og vilkår, for omgangen under opholdet og for kommunikationen via platformen.",
        "Desuden gælder artikel 20 i forordning (EU) 2018/302: udbydere må ikke begrænse adgangen til deres tilbud på grund af en gæsts statsborgerskab, bopæl eller etableringssted inden for Unionen.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Hvad det betyder for udbydere",
      paragraphs: ["Som udbyder må du navnlig ikke:"],
      list: [
        "afvise en bookingforespørgsel på grund af et af de nævnte forhold;",
        "kræve forskellige priser, deposita eller vilkår af gæster, fordi de opfylder et af forholdene;",
        "i opslaget eller i beskeder erklære, at bestemte persongrupper er uønskede;",
        "afvise service- eller førerhunde, selv om dine husregler udelukker dyr;",
        "behandle en gæst anderledes på grund af bopæl i en anden medlemsstat i Unionen.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Hvad der fortsat er tilladt",
      paragraphs: [
        "Du må fastsætte maksimal belægning, en minimumsalder for hovedbookeren og saglige husregler (f.eks. rygeforbud eller ro-tider), så længe de gælder ens for alle gæster.",
        "Bebor du selv indkvarteringen og deler bolig med gæsten, må du gøre det tydeligt i opslaget; forholdene i afsnit 1 berettiger alligevel ikke en afvisning.",
        "Du må afvise en booking, når der foreligger konkrete holdepunkter for en overtrædelse af husreglerne eller for svindel. Grunden skal vedrøre adfærden, ikke personen.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Tilgængelighed",
      paragraphs: [
        "Oplysninger om en indkvarterings tilgængelighed skal være rigtige. At beskrive en indkvartering som tilgængelig, når den ikke er det, er samtidig en overtrædelse af [Retningslinjer for passende indhold](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Er en tilpasning mulig uden urimelig indsats, forventer vi, at udbydere foretager den.",
      ],
    },
    {
      id: "melden",
      heading: "5. Anmeld forskelsbehandling",
      paragraphs: [
        "Har du oplevet eller observeret forskelsbehandling, så anmeld det til os via anmeldelsesfunktionen eller kontaktvejene under [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).",
        "Vi vurderer enhver anmeldelse. Bekræftes en overtrædelse, træffer vi foranstaltninger indtil permanent spærring af kontoen. Er en booking blevet afvist over for dig af den grund, hjælper vi dig med at finde en sammenlignelig indkvartering.",
      ],
    },
  ],
};
