import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Opgaver & rengøring",
  description: "Organiser rengøringsplaner og teamopgaver.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Virksomhed",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Opret opgaver",
          excerpt: "Sådan opretter du en ny opgave for en bolig eller et tidsrum.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Opgaver samler alt, hvad der skal udføres omkring en bolig — fra rengøring efter check-out til vedligeholdelsesarbejde eller gæsteforespørgsler. Hver opgave er knyttet til præcis én bolig og kan tildeles et teammedlem.",
            },
            { type: "h2", text: "Opret en ny opgave" },
            {
              type: "steps",
              items: [
                "Åbn afsnittet »Opgaver« i hovedmenuen.",
                "Klik på »Ny opgave«.",
                "Vælg den relevante bolig.",
                "Angiv en titel og eventuelt en beskrivelse.",
                "Fastlæg forfaldsdato og -klokkeslæt.",
                "Gem opgaven.",
              ],
            },
            { type: "h2", text: "Opgavetyper" },
            {
              type: "p",
              text: "Ud over frie opgaver findes der systemgenererede opgaver, for eksempel automatisk planlagt rengøring efter en check-out. Disse er allerede knyttet til boligen og det rette tidsvindue og skal blot tildeles et teammedlem.",
            },
            {
              type: "ul",
              items: [
                "Manuel opgave: oprettet frit, f.eks. vedligeholdelse eller særønske.",
                "Automatisk rengøringsopgave: udledt af check-out-datoen.",
                "Tilbagevendende opgave: til regelmæssige kontroller eller inspektioner.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Detaljer om den automatiske tidsplanlægning finder du under [Rengøringsplaner](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Brug præcise titler — teammedlemmer ser ofte kun titlen og boligen på et øjeblik i mobilvisningen.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Rengøringsplaner",
          excerpt: "Lad rengøringer efter check-out blive planlagt automatisk.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "En rengøringsplan sørger for, at der automatisk oprettes en rengøringsopgave for den pågældende bolig efter hver check-out — uden at du skal følge op på hver booking enkeltvis. Det reducerer glemte overdragelser og sikrer et pålideligt forløb mellem to ophold.",
            },
            { type: "h2", text: "Aktiver automatisk planlægning" },
            {
              type: "steps",
              items: [
                "Åbn boligen, og skift til fanen »Rengøring«.",
                "Aktiver »Planlæg rengøring automatisk efter check-out«.",
                "Fastlæg, hvor meget tid der afsættes til rengøring efter check-out.",
                "Angiv eventuelt et standardteam eller en fast rengøringskraft.",
                "Gem indstillingen.",
              ],
            },
            { type: "h2", text: "Samspil med kalenderen" },
            {
              type: "p",
              text: "Så snart en booking annulleres eller flyttes, tilpasser den tilhørende rengøringsopgave sig automatisk til den nye check-out-dato. Sådan forbliver rengøringsplanen altid synkroniseret med den faktiske belægning.",
            },
            {
              type: "ul",
              items: [
                "Rengøring oprettes automatisk ved hver check-out med aktiv plan.",
                "Flyttes bookingen, flyttes rengøringsopgaven med.",
                "Annullerer gæsten opholdet, fjernes rengøringsopgaven.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Uden en aktiveret rengøringsplan oprettes der ingen automatiske opgaver — opret i så fald rengøringer manuelt under [Opret opgaver](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Tildel opgaver",
          excerpt: "Tildel opgaver målrettet til rengøringskræfter eller teammedlemmer.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "For at en opgave bliver udført, tildeler du den til et konkret teammedlem — for eksempel en rengøringskraft eller en medarbejder med vedligeholdelsesansvar. Kun den tildelte person ser som udgangspunkt opgaven i sin egen oversigt.",
            },
            { type: "h2", text: "Tildel en opgave manuelt" },
            {
              type: "steps",
              items: [
                "Åbn opgaven i listen »Opgaver«.",
                "Klik på »Tildel«.",
                "Vælg det ansvarlige teammedlem fra listen.",
                "Bekræft tildelingen.",
              ],
            },
            { type: "h2", text: "Tildeling efter bolig" },
            {
              type: "p",
              text: "Hvis en rengøringskraft allerede er fast tilknyttet en bolig, kan du lade opgaver for denne bolig blive tildelt automatisk til samme person. Det sparer klik ved tilbagevendende rengøringer og reducerer opklarende spørgsmål.",
            },
            {
              type: "ul",
              items: [
                "Manuel tildeling: du vælger selv personen for hver opgave.",
                "Fast boligtilknytning: nye opgaver for denne bolig går automatisk til den registrerede person.",
                "En opgave har altid præcis én ansvarlig person.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Rengøringskræfter og medarbejdere ser udelukkende deres egne tildelte opgaver, ingen finans- eller salgsdata for boligen.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Følg opgavestatus",
          excerpt: "Hold øje med opgavers behandlingsstatus i realtid.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "p",
              text: "Hver opgave gennemløber en klar status — fra åben over i gang til afsluttet. Sådan kan du til enhver tid se, om en rengøring eller vedligeholdelse bliver færdig i tide før næste check-in.",
            },
            { type: "h2", text: "Statusoversigt" },
            {
              type: "ul",
              items: [
                "Åben: opgaven er oprettet, men endnu ikke påbegyndt.",
                "I gang: den tildelte person har påbegyndt opgaven.",
                "Afsluttet: opgaven er udført og bekræftet.",
              ],
            },
            { type: "h2", text: "Opdater status" },
            {
              type: "steps",
              items: [
                "Åbn opgaven fra listen »Opgaver«.",
                "Vælg den relevante status, f.eks. »I gang« eller »Afsluttet«.",
                "Tilføj eventuelt en kort note, f.eks. om afvigelser i boligen.",
                "Gem ændringen.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Statusændringer vises straks i den delte opgaveliste — en manuel genindlæsning er ikke nødvendig.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Er en rengøring stadig åben kort før næste check-in, skal du først kontrollere tildelingen, før du kontakter gæsten.",
            },
          ],
        },
      ],
    },
  ],
};
