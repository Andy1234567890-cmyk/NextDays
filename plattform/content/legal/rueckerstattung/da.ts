import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ombookings- og refusionspolitik",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Denne politik gælder, når der ved en indkvartering booket via myBestDays er noget grundlæggende galt — den er dermed det tilsagn, der går ud over udbyderens afbestillingsvilkår.",
    "Den gælder for bookinger, der er indgået og betalt via platformen.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. Hvornår denne politik gælder",
      paragraphs: [
        "Den gælder, når en af følgende begivenheder indtræder før eller under opholdet:",
      ],
      list: [
        "Udbyderen afbestiller bookingen.",
        "Udbyderen kan ikke træffes ved ankomsten, eller du får ikke adgang til indkvarteringen.",
        "Indkvarteringen er ubeboelig — f.eks. på grund af manglende opvarmning ved kulde, manglende rindende vand, utilstrækkelig renlighed eller en sundhedsfare.",
        "Indkvarteringen afviger væsentligt fra opslaget — et andet antal sovepladser eller rum, et andet sted, et i opslaget lovet og faktisk manglende centralt udstyr.",
        "En anden gæst, der ikke var meldt, opholder sig i indkvarteringen.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Hvad du skal gøre",
      paragraphs: [
        "Meld problemet så tidligt som muligt, dog senest 24 timer efter konstateringen — ved problemer ved ankomsten altså på ankomstdagen.",
        "Meld det først til udbyderen via beskedfunktionen og giv denne lejlighed til at udbedre det. Ved fare for dit helbred, eller hvis udbyderen ikke kan træffes, bortfalder denne pligt.",
        "Dokumentér problemet, hvis det er muligt, med billeder, videoer eller beskeder. Uden dokumentation kan vi ofte ikke fastslå forholdet.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Hvad vi gør",
      paragraphs: [
        "Bekræftes problemet, kan du vælge mellem en sammenlignelig erstatningsindkvartering og en refusion.",
        "Vælger du en erstatningsindkvartering, dækker vi merprisen i forhold til din oprindelige booking, for så vidt erstatningsindkvarteringen er sammenlignelig efter beliggenhed, faciliteter og størrelse.",
        "Vælger du refusionen, refunderer vi ved et problem før ankomst hele det beløb, der er betalt via platformen. Opstår problemet under opholdet, refunderer vi andelen for de nætter, der ikke kan bruges, samt et rimeligt beløb for gener ved de allerede tilbragte nætter.",
        "Vores afgørelse meddeler vi dig med en begrundelse. Du kan få den efterprøvet ad vejen under [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Hvad der ikke er omfattet",
      paragraphs: ["Denne politik gælder ikke ved:"],
      list: [
        "forhold, der var beskrevet i opslaget eller kunne ses på billederne;",
        "ubetydelige afvigelser, der ikke påvirker brugen (f.eks. en anden vægfarve eller en anden sofa);",
        "midlertidige forstyrrelser, som udbyderen udbedrer inden for rimelig tid;",
        "forhold uden for indkvarteringen, som udbyderen ikke har indflydelse på — vejr, trafik, kommunens byggepladser, lukning af seværdigheder (herom gælder [Politik for alvorlige forstyrrelser](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen));",
        "problemer, som du eller dine medrejsende har forvoldt;",
        "bookinger, der er indgået eller betalt uden om platformen.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Forholdet til dine lovbestemte rettigheder",
      paragraphs: [
        "Denne politik er et frivilligt tilsagn fra myBestDays. Dine lovbestemte krav mod udbyderen — navnlig forholdsmæssigt afslag og erstatning — berøres ikke og kan gå videre.",
        "For så vidt vi refunderer dig, overgår tilsvarende krav mod udbyderen til os.",
      ],
    },
  ],
};
