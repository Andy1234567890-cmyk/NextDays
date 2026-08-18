import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Anmeldelsespolitik",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Anmeldelser er den vigtigste uafhængige kilde for gæster. Denne politik beskriver, hvem der må anmelde, hvordan vi sikrer, at anmeldelser stammer fra faktiske gæster, og hvornår vi fjerner en anmeldelse.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Hvordan vi sikrer ægtheden",
      paragraphs: [
        "En anmeldelse kan kun afgives af den, der har booket indkvarteringen via myBestDays, og hvis opholdsperiode er begyndt. Anmeldelsen knyttes teknisk til den konkrete booking.",
        "Dermed opfylder vi pligten efter bilag I, nr. 23b, i direktiv 2005/29/EF til kun at fremstille sådanne anmeldelser som gæsteanmeldelser, hvor vi har taget rimelige skridt til at kontrollere, at de stammer fra faktiske gæster.",
        "Vi køber ikke anmeldelser, bestiller ingen og indlægger ingen falske anmeldelser. Vi tolererer heller ikke, at udbydere gør det.",
      ],
    },
    {
      id: "frist",
      heading: "2. Frist og offentliggørelse",
      paragraphs: [
        "Efter afrejsen har du 14 dage til at afgive en anmeldelse. Udbyderen kan inden for samme frist afgive en anmeldelse om dig.",
        "Begge anmeldelser offentliggøres samtidig, så snart begge foreligger, eller fristen er udløbet. Sådan påvirker ingen af parterne den anden.",
        "En afgivet anmeldelse kan du trække tilbage inden for fristen. Efter offentliggørelsen er en ændring ikke længere mulig; du kan få den slettet.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Udbyderens svar",
      paragraphs: [
        "Udbyderen kan svare offentligt på en anmeldelse. For svaret gælder samme regler som for selve anmeldelsen.",
        "Et svar ændrer ikke anmeldelsen og ændrer intet ved den samlede karakter.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Hvornår vi fjerner en anmeldelse",
      paragraphs: [
        "Vi fjerner ikke en anmeldelse, fordi den er negativ, eller fordi udbyderen er utilfreds med den. Vi fjerner den, når den:",
      ],
      list: [
        "overtræder [Retningslinjer for passende indhold](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "indeholder tredjemands personoplysninger;",
        "tydeligvis vedrører en anden indkvartering eller et andet ophold;",
        "i det væsentlige vedrører forhold, som hverken gæst eller udbyder havde indflydelse på (f.eks. vejr, kommunens byggeplads, trafik ved ankomst) — i så fald fjerner vi kun den berørte del, hvis den kan udskilles;",
        "tydeligvis tjener afpresning, f.eks. fordi den er knyttet til et krav;",
        "er købt gennem incitamenter eller afgivet i koordineret hensigt.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Incitamenter er ikke tilladt",
      paragraphs: [
        "Udbydere må hverken tilbyde penge, rabatter, opgraderinger, gaver eller andre fordele for en anmeldelse — heller ikke for at undlade en anmeldelse.",
        "Udbydere må invitere gæster til at anmelde uden at påvirke karakteren. En invitation, der kun opfordrer til anmeldelse ved en positiv oplevelse, er ikke tilladt.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Hvordan vi viser anmeldelser",
      paragraphs: [
        "Den samlede karakter er det uvægtede gennemsnit af alle offentliggjorte anmeldelser af en indkvartering. Vi vægter ingen anmeldelse højere, fordi den er bedre.",
        "Standardsorteringen viser de nyeste anmeldelser først. Du kan skifte til andre sorteringer; hvilken sortering der er aktiv, vises.",
        "Vi oplyser, hvor mange anmeldelser der ligger til grund for en samlet karakter. Ved færre end tre anmeldelser viser vi ingen samlet karakter, kun de enkelte anmeldelser.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Klage over en afgørelse",
      paragraphs: [
        "Fjerner vi din anmeldelse, eller afviser vi at fjerne en anmeldelse, begrunder vi det og henviser til klagevejen — se [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
