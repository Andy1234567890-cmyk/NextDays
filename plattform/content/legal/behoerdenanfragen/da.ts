import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Retningslinjer for myndigheds- og politianmodninger",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Disse retningslinjer henvender sig til myndigheder, domstole og retshåndhævende instanser, der anmoder myBestDays om data eller retter et påbud mod indhold. De er offentlige her, så også brugere kan læse, under hvilke betingelser vi udleverer data.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsætning",
      paragraphs: [
        "Vi udleverer kun brugerdata, når der foreligger et gyldigt retsgrundlag, og anmodningen opfylder de formelle krav. En formløs anmodning om data er ikke tilstrækkelig.",
        "Vi vurderer enhver anmodning for kompetence, retsgrundlag, bestemthed og proportionalitet og udleverer kun de data, anmodningen angiver.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Krav til en anmodning",
      paragraphs: ["En anmodning bør indeholde:"],
      list: [
        "den anmodende instans, sagsnummeret og kontaktoplysninger på den behandlende person på officielt brevpapir;",
        "retsgrundlaget efter national ret eller EU-ret;",
        "en præcis angivelse af den berørte person eller konto — e-mailadresse, bookingnummer eller opslags-URL;",
        "de præcist angivne data og perioden;",
        "i givet fald en retskendelse, for så vidt den gældende ret kræver det;",
        "en oplysning, hvis underretning af den berørte person ville bringe efterforskningen i fare, med angivelse af retsgrundlaget.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Påbud efter forordning (EU) 2022/2065",
      paragraphs: [
        "Påbud om at skride ind over for ulovligt indhold (artikel 9) og påbud om at give oplysninger (artikel 10) skal indeholde de dér nævnte angivelser, navnlig retsgrundlaget, den præcise elektroniske placering, begrundelsen, klagemulighederne og sproget.",
        "Vi bekræfter modtagelsen og meddeler den påbydende myndighed, hvilke foranstaltninger vi har truffet, og hvornår.",
        "Om et påbud underretter vi den berørte person senest på gennemførelsestidspunktet, medmindre myndigheden med angivelse af retsgrundlaget påbyder udsættelse.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Nødsituationer",
      paragraphs: [
        "Foreligger der en umiddelbar fare for liv eller legeme, udleverer vi de data, der er nødvendige for at afværge den, også uden forudgående formelt påbud. Markér en sådan anmodning udtrykkeligt som nødsituation og beskriv faren.",
        "Foreligger der holdepunkter for en strafbar handling, der indebærer en fare for en persons liv eller sikkerhed, underretter vi af egen drift de kompetente myndigheder (artikel 18 i forordning (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Hvilke data vi har",
      paragraphs: [
        "Hvilke datakategorier vi behandler, og hvor længe vi opbevarer dem, fremgår af [Privatlivspolitik](https://mybestdays.dk/rechtliches/datenschutz). Ud over de dér nævnte frister opbevarer vi ingen data.",
        "Der finder ingen logning ud over behovet sted. En opfordring til midlertidigt at sikre data til en verserende sag efterkommer vi inden for de retligt tilladte rammer.",
        "Fuldstændige betalingsdata foreligger ikke hos os; de skal indhentes hos betalingstjenesteudbyderen.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Underretning af den berørte person",
      paragraphs: [
        "Vi underretter berørte brugere om en anmodning, der vedrører deres data, medmindre en retsforskrift eller et begrundet myndighedspåbud forbyder det, eller der foreligger en umiddelbar fare for liv eller legeme.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Hvor anmodninger skal sendes hen",
      paragraphs: [
        "Anmodninger rettes til det centrale kontaktpunkt for myndigheder, der er nævnt under [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa). Vi behandler dem på dansk, tysk og engelsk.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Gennemsigtighed",
      paragraphs: [
        "Antal og art af myndighedspåbud oplyser vi i vores årlige gennemsigtighedsrapport; se [Forordningen om digitale tjenester](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
