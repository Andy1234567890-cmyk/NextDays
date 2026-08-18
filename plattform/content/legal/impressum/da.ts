import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Juridiske oplysninger",
  stand: "Opdateret: 18. august 2026",
  intro: [
    `Oplysninger om udbyderen af markedspladsen myBestDays. Operatør er ${ANBIETER.firma}; myBestDays er et varemærke tilhørende dette selskab og ikke en selvstændig juridisk person.`,
    "Lovpligtige oplysninger efter § 7 i e-handelsloven, der gennemfører artikel 5 i direktiv 2000/31/EF om elektronisk handel, samt oplysninger efter artikel 11 og 12 i forordning (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operatør af platformen",
      paragraphs: [
        `${ANBIETER.firma} — anpartsselskab (ApS) efter dansk ret`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark`,
        `Tegningsberettiget direktion: ${ANBIETER.direktion.join(" og ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "For forhold vedrørende en bestående booking anvender du beskedfunktionen i din konto — så foreligger booking og forløb allerede hos os; se [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Register og moms",
      paragraphs: [
        `CVR-nr. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danmark.`,
        ...(ANBIETER.ustId
          ? [`Momsnummer: ${ANBIETER.ustId}.`]
          : [
              "Der foreligger i øjeblikket ikke et momsnummer; § 7 i e-handelsloven kræver kun angivelse heraf ved bestående momsregistrering.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktpunkter efter forordning (EU) 2022/2065",
      paragraphs: [
        `Centralt kontaktpunkt for myndigheder efter artikel 11 og for brugere efter artikel 12: ${ANBIETER.email}, pr. post på ovenstående adresse.`,
        "Kommunikationssprogene er dansk, tysk og engelsk.",
        "Procedurerne efter forordningen — anmeldelse af ulovligt indhold, begrundelse af foranstaltninger, klagebehandling — er beskrevet under [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Kompetente myndigheder",
      paragraphs: [
        `Koordinator for digitale tjenester efter artikel 49 i forordning (EU) 2022/2065: ${DSA_KOORDINATOR.name}, Danmark ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Databeskyttelsestilsynsmyndighed: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danmark, ${AUFSICHTSBEHOERDE.email}.`,
        "Formidling af overnatningsydelser kræver ikke særlig tilladelse i Danmark; der findes derfor ingen brancheretlig tilsynsmyndighed.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Forbrugerklager",
      paragraphs: [
        "Europa-Kommissionens platform for onlinetvistbilæggelse er ophævet ved forordning (EU) 2024/3228 og har indstillet driften.",
        "Vi er ikke forpligtet til og ikke indstillet på at deltage i en tvistbilæggelsesprocedure ved et forbrugerklagenævn.",
        `Uafhængigt heraf kan du som forbruger henvende dig til den kompetente danske instans: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort} ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Bor du i en anden medlemsstat, hjælper Det Europæiske Forbrugercenter i dit land.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Om indhold og links",
      paragraphs: [
        "Indholdet i opslag stammer fra de pågældende udbydere. myBestDays gør det ikke til sit eget; se afsnit A4 i [Brugsvilkårene](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "For indholdet af linkede tredjepartssider er deres operatør ansvarlig. Får vi kendskab til en retskrænkelse, fjerner vi linket straks.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Ophavsret",
      paragraphs: [
        `De egne indhold, tekster, grafik og varemærker, der offentliggøres på denne platform, er beskyttet af ophavsrets- og varemærkeret. Anvendelse ud over de lovligt tilladte tilfælde kræver forudgående skriftligt samtykke fra ${ANBIETER.firma}; for varemærker gælder [Retningslinjer for varemærker](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Gældende ret",
      paragraphs: [
        `${ANBIETER.firma} har hjemsted i Danmark og er udelukkende etableret der. For dette onlinetilbud gælder derfor dansk ret — også for den danske og de øvrige sprogversioner (oprindelseslandsprincippet efter artikel 3 i direktiv 2000/31/EF). Ufravigelige forbrugerbeskyttelsesregler i dit bopælsland berøres ikke.`,
      ],
    },
  ],
};
