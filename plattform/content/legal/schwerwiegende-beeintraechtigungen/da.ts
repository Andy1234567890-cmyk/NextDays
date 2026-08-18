import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politik for alvorlige forstyrrelser",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Nogle gange forhindrer en begivenhed rejsen eller opholdet, som hverken gæsten eller udbyderen kan gøre for. Denne politik beskriver, hvilke begivenheder det er, og hvad der da gælder.",
    "Den har forrang for det afbestillingsvilkår, der er valgt i opslaget.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Hvilke begivenheder der er omfattet",
      paragraphs: [
        "Omfattet er begivenheder, der indtræder efter bookingen, var uforudsigelige for begge parter og gør rejsen eller opholdet umuligt eller retligt utilladeligt:",
      ],
      list: [
        "myndighedsbestemte rejse- eller opholdsforbud, udgangsforbud og grænselukninger, der vedrører rejsemålet eller afrejsestedet;",
        "naturkatastrofer og naturbegivenheder, der rammer rejsemålet — jordskælv, oversvømmelse, storm, storbrand, vulkanudbrud;",
        "krig, væbnede konflikter, terrorangreb og uroligheder på rejsemålet;",
        "en myndighedsfastslået epidemi eller pandemi med foranstaltninger, der forbyder opholdet;",
        "svigt i forsyningen med el, vand eller varme på rejsemålet over en længere periode;",
        "fuldstændigt bortfald af muligheden for at rejse til rejsemålet som følge af en af de førnævnte begivenheder.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Hvilke begivenheder der ikke er omfattet",
      paragraphs: ["Ikke omfattet er navnlig:"],
      list: [
        "sygdom eller tilskadekomst hos gæsten eller dennes pårørende — hertil er en rejseforsikring beregnet;",
        "arbejdsmæssig forhindring, eksamensdatoer eller bortfald af ferien;",
        "aflysning af et arrangement, som rejsen var booket for, hvis indkvarteringen fortsat kan bruges;",
        "vejr, der ikke udgør en naturkatastrofe — regn, kulde, varme, manglende sne;",
        "bortfald af enkelte transportmidler, så længe en rimelig anrejse fortsat er mulig;",
        "aflysning af en flyafgang eller en strejke hos en transportvirksomhed — herfor består krav mod transportvirksomheden.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Hvad der gælder, når en omfattet begivenhed indtræder",
      paragraphs: [
        "Rammer begivenheden perioden for din booking, kan du afbestille uden omkostninger. Du får det beløb, der er betalt via platformen, fuldt refunderet.",
        "Er opholdet allerede påbegyndt, refunderer vi andelen for de nætter, der ikke længere kan bruges.",
        "Udbyderen påføres ingen ulemper ved vurderingen af sin pålidelighed som følge af en sådan afbestilling.",
        "Alternativt kan du aftale en udskydelse med udbyderen; vi hjælper med ombookingen.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Sådan påberåber du dig politikken",
      paragraphs: [
        "Henvend dig ad kontaktvejene under [Klager og tvistbilæggelse](https://mybestdays.dk/rechtliches/beschwerden) og oplys bookingnummer og begivenhed.",
        "Vi vurderer sagen på grundlag af offentligt tilgængelige kilder — myndighedspåbud, officielle advarsler, rapporter fra anerkendte nyhedskilder — og træffer afgørelse hurtigt.",
        "Kan situationen endnu ikke vurderes endeligt, afventer vi udviklingen indtil kort før ankomstdagen og træffer da afgørelse. Din booking består uændret indtil da.",
      ],
    },
  ],
};
