import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Klager og tvistbilæggelse",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Denne side beskriver, hvordan du når myBestDays, hvordan vi behandler klager, og hvilke veje der står åbne for dig, hvis du ikke er enig i vores afgørelse.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Sådan når du os",
      paragraphs: [
        "Hurtigst når du os via Hjælpecenteret og de kontaktveje, der er anført dér. Til en bestående booking anvender du beskedfunktionen i din konto — så foreligger booking og forløb allerede hos os.",
        `Skriftligt når du os på ${ANBIETER.email} eller ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danmark; telefonisk på ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Hvad din klage bør indeholde",
      paragraphs: ["For at vi kan hjælpe hurtigt, bedes du oplyse:"],
      list: [
        "dit bookingnummer og den e-mailadresse, der er brugt til bookingen;",
        "en kort beskrivelse af problemet;",
        "hvad du ønsker som løsning;",
        "den tilhørende dokumentation — billeder, beskeder, kvitteringer, kontoudtog.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Sådan behandler vi",
      paragraphs: [
        "Enhver klage registreres og får et sagsnummer, hvorunder du kan følge status.",
        "Vi bekræfter modtagelsen straks og svarer i sagen som regel inden for syv dage. Er en længere undersøgelse nødvendig, meddeler vi dig mellemstatus.",
        "Klager, hvor personer er i fare, eller hvor en ankomst er nært forestående, behandler vi prioriteret.",
        "Vores afgørelse begrunder vi og angiver det grundlag, den hviler på.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Klage over en foranstaltning fra os",
      paragraphs: [
        "Har vi fjernet indhold, begrænset dets synlighed, afbestilt en booking eller spærret en konto, kan du klage herover vederlagsfrit inden for seks måneder. Det svarer til artikel 20 i forordning (EU) 2022/2065.",
        "Klagen behandles af mennesker, ikke alene af automatiserede procedurer. Viser den sig begrundet, ophæver vi foranstaltningen.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Udenretslig tvistbilæggelse",
      paragraphs: [
        "Europa-Kommissionens platform for onlinetvistbilæggelse (OTB-platformen) er ophævet ved forordning (EU) 2024/3228 og har indstillet driften. Der kan ikke længere indgives klager via den.",
        "Vi er ikke forpligtet til og ikke indstillet på at deltage i en tvistbilæggelsesprocedure ved et forbrugerklagenævn.",
        `Uafhængigt heraf kan du som forbruger henvende dig til den kompetente danske instans: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort} ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Bor du i en anden medlemsstat, hjælper Det Europæiske Forbrugercenter i dit land.`,
        "Vedrører tvisten en foranstaltning, vi har truffet mod dit indhold eller din konto, kan du desuden indbringe sagen for et udenretsligt tvistbilæggelsesorgan, der er certificeret efter artikel 21 i forordning (EU) 2022/2065. Dets afgørelser er ikke bindende for os, og vi er ikke forpligtet til at deltage i sådanne procedurer.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Domstolsvejen",
      paragraphs: [
        "Adgangen til domstolene står dig åben til enhver tid, også uden forudgående klageprocedure. Hvilke domstole der er kompetente, fremgår af afsnit A19 i [Brugsvilkårene](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Klager fra udbydere",
      paragraphs: [
        "Udbydere kan indgive klager over anvendelsen af disse vilkår, over rangordningsafgørelser og over begrænsninger af deres opslag via samme procedure. Det svarer til artikel 11 i forordning (EU) 2019/1150.",
        "Om antal, genstand og gennemsnitlig behandlingstid for sådanne klager rapporterer vi årligt; rapporten kan hentes under [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
