import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Retningslinjer for passende indhold",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Disse retningslinjer gælder for alt indhold, brugere indlægger på myBestDays: opslag, billeder, anmeldelser, beskeder, profiloplysninger og svar på anmeldelser.",
    "De er en del af [Brugsvilkårene](https://mybestdays.dk/rechtliches/nutzungsbedingungen). En overtrædelse kan føre til fjernelse af indholdet og til foranstaltninger mod kontoen.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Hvad der ikke er tilladt",
      paragraphs: ["På myBestDays er navnlig følgende indhold ikke tilladt:"],
      list: [
        "ulovligt indhold af enhver art, navnlig opfordringer til strafbare handlinger, terrorrelateret indhold og materiale om seksuelt misbrug af børn;",
        "indhold, der tilskynder til had eller vold mod personer eller grupper på grund af oprindelse, hudfarve, religion, tro, køn, kønsidentitet, seksuel orientering, handicap eller alder;",
        "fornærmelser, trusler, chikane og målrettet udstilling af enkeltpersoner;",
        "tredjemands personoplysninger uden dennes samtykke, navnlig navne, adresser, telefonnumre, legitimations- eller betalingsoplysninger;",
        "vildledende oplysninger om en indkvartering, dens beliggenhed, faciliteter, størrelse eller ledighed;",
        "andres billeder, tekster eller varemærker uden de nødvendige rettigheder;",
        "reklame, spam og indhold, der fører til andre bookingveje uden om platformen;",
        "skadelig software, phishingforsøg og links til sådant indhold;",
        "udbud af andet end en overnatningsydelse.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Billeder",
      paragraphs: [
        "Billeder skal vise den faktisk udbudte indkvartering og være optaget i en stand, der svarer til den nuværende.",
        "Billeder må ikke vise genkendelige personer uden deres samtykke. Bearbejdning er tilladt, for så vidt den ikke forvansker indtrykket af indkvarteringen — en opklaring ja, et bortretoucheret nabobyggeri nej.",
        "Kamerabaseret overvågning i indkvarteringen skal oplyses i opslaget. I indendørs rum, hvor gæster har en berettiget forventning om privatliv — soverum, badeværelser — er kameraer ikke tilladt, heller ikke slukkede.",
      ],
    },
    {
      id: "melden",
      heading: "3. Anmeld indhold",
      paragraphs: [
        "Anser du et indhold for ulovligt eller for en overtrædelse af disse retningslinjer, kan du anmelde det via anmeldelsesfunktionen ved hvert opslag, hver anmeldelse og hver besked.",
        "Anmeldelsesproceduren efter artikel 16 i forordning (EU) 2022/2065 og behandlingen af anmeldelser er beskrevet under [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Hvordan vi håndhæver",
      paragraphs: [
        "Vi vurderer ethvert anmeldt indhold og vælger den mildeste egnede foranstaltning: henvisning, fjernelse af den berørte del, fjernelse af hele indholdet, begrænsning af synligheden, spærring af en funktion eller spærring af kontoen.",
        "Gentagne eller grove overtrædelser vejer tungere. Ved åbenbart ulovligt indhold eller fare for personer handler vi straks.",
        "Enhver foranstaltning begrunder vi over for den berørte og henviser til klagevejen. Klagen behandles af mennesker.",
      ],
    },
  ],
};
