import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tillgänglighetsredogörelse",
  stand: "Uppdaterat: 18 augusti 2026",
  intro: [
    "myBestDays ska kunna användas av alla. Denna redogörelse beskriver plattformens tillgänglighet, kända begränsningar och vägen att anmäla hinder till oss.",
    "Den avser kraven i direktiv (EU) 2019/882 om tillgänglighetskrav för produkter och tjänster, som sedan den 28 juni 2025 gäller för tjänster inom e-handel.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Tillgänglighetens status",
      paragraphs: [
        "Vi utgår från den harmoniserade standarden EN 301 549 och de bakomliggande Web Content Accessibility Guidelines (WCAG) 2.1 på överensstämmelsenivå AA.",
        "Genomfört är bland annat: genomgående manövrering med tangentbord, synlig fokusmarkering, semantisk rubrikstruktur, etiketter vid alla formulärfält, textalternativ för manöverelement, tillräckliga färgkontraster, skalbarhet av texten utan förlust av innehåll samt en visning som anpassar sig till skärmstorleken.",
        "Rättstexterna finns på unionens alla 24 officiella språk och är försedda med korrekt språkmärkning så att skärmläsare läser upp dem rätt.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Kända begränsningar",
      paragraphs: ["Inte tillgängliga är för närvarande särskilt:"],
      list: [
        "Bilder och beskrivningar i annonser kommer från leverantörer; textalternativ till bilder kan saknas eller vara otillräckliga. Vi uppmanar leverantörer att komplettera dem.",
        "Inbäddade kartvisningar från tredje part går endast i begränsad omfattning att manövrera med tangentbord. Alla platsuppgifter finns även som text.",
        "Dokument som laddats upp av leverantörer (t.ex. ordningsregler som PDF) är inte genomgående märkta för tillgänglighet.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Boendenas tillgänglighet",
      paragraphs: [
        "Denna redogörelse avser plattformen, inte boendena. Uppgifter om ett boendes byggnadstekniska tillgänglighet kommer från leverantören.",
        "Är du beroende av vissa egenskaper — nivåfri entré, dörrbredder, golvbrunn i duschen, hiss — stäm av dem med leverantören via meddelandefunktionen före bokningen. Oriktiga uppgifter om tillgänglighet är en överträdelse av våra riktlinjer och kan anmälas.",
      ],
    },
    {
      id: "melden",
      heading: "4. Anmäla hinder",
      paragraphs: [
        `Stöter du på ett hinder, anmäl det till oss på ${ANBIETER.email} eller via kontaktvägarna under [Klagomål och tvistlösning](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Beskriv gärna vilken sida som berörs, vad du ville göra och vilka hjälpmedel du använder. Vi bekräftar mottagandet och meddelar dig hur och när vi åtgärdar hindret.",
        "Behöver du information i ett tillgängligt format tillhandahåller vi den på begäran.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Tillsynsförfarande",
      paragraphs: [
        "Är du inte nöjd med vårt svar kan du vända dig till den myndighet som ansvarar för marknadskontroll enligt direktiv (EU) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (tidigare Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danmark",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
