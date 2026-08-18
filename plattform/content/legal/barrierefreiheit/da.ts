import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tilgængelighedserklæring",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "myBestDays skal kunne bruges af alle. Denne erklæring beskriver platformens tilgængelighed, kendte begrænsninger og vejen til at indberette barrierer til os.",
    "Den vedrører kravene i direktiv (EU) 2019/882 om tilgængelighedskrav for produkter og tjenester, der siden den 28. juni 2025 har gældt for tjenester inden for elektronisk handel.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Tilgængelighedens stand",
      paragraphs: [
        "Vi retter os efter den harmoniserede standard EN 301 549 og de underliggende Web Content Accessibility Guidelines (WCAG) 2.1 på overensstemmelsesniveau AA.",
        "Gennemført er blandt andet: gennemgående betjening med tastatur, synligt fokus, semantisk overskriftsstruktur, mærkater ved alle formularfelter, tekstalternativer til betjeningselementer, tilstrækkelige farvekontraster, skalerbarhed af teksten uden tab af indhold samt en visning, der tilpasser sig skærmstørrelsen.",
        "Retsteksterne kan hentes på alle 24 officielle EU-sprog og er forsynet med korrekt sprogangivelse, så skærmlæsere læser dem rigtigt op.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Kendte begrænsninger",
      paragraphs: ["Ikke tilgængelige er i øjeblikket navnlig:"],
      list: [
        "Billeder og beskrivelser i opslag stammer fra udbydere; tekstalternativer til billeder kan mangle eller være utilstrækkelige. Vi opfordrer udbydere til at supplere dem.",
        "Indlejrede kortvisninger fra tredjeparter kan kun i begrænset omfang betjenes med tastatur. Alle stedoplysninger findes desuden som tekst.",
        "Dokumenter uploadet af udbydere (f.eks. husorden som PDF) er ikke gennemgående mærket tilgængeligt.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Indkvarteringernes tilgængelighed",
      paragraphs: [
        "Denne erklæring vedrører platformen, ikke indkvarteringerne. Oplysninger om en indkvarterings bygningsmæssige tilgængelighed stammer fra udbyderen.",
        "Er du afhængig af bestemte forhold — trinfri adgang, dørbredder, niveaufri bruser, elevator — så afklar dem med udbyderen via beskedfunktionen før bookingen. Urigtige oplysninger om tilgængelighed er en overtrædelse af vores retningslinjer og kan anmeldes.",
      ],
    },
    {
      id: "melden",
      heading: "4. Indberet barrierer",
      paragraphs: [
        `Støder du på en barriere, så indberet den til os på ${ANBIETER.email} eller via kontaktvejene under [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Beskriv venligst, hvilken side der er berørt, hvad du ville gøre, og hvilke hjælpemidler du bruger. Vi bekræfter modtagelsen og meddeler dig, hvordan og hvornår vi udbedrer barrieren.",
        "Har du brug for en oplysning i et tilgængeligt format, stiller vi den til rådighed på anmodning.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Håndhævelsesprocedure",
      paragraphs: [
        "Er du ikke tilfreds med vores svar, kan du henvende dig til den myndighed, der er ansvarlig for markedsovervågning efter direktiv (EU) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (tidligere Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danmark",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
