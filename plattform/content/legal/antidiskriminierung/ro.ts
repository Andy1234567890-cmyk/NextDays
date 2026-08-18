import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica împotriva discriminării",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "myBestDays este deschis tuturor. Cine rezervă sau oferă prin Platformă nu poate trata pe nimeni mai puțin favorabil din cauza unor caracteristici personale.",
    "Prezenta politică face parte din [Condițiile de utilizare](https://mybestdays.dk/rechtliches/nutzungsbedingungen) și se aplică atât oaspeților, cât și furnizorilor.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principiu",
      paragraphs: [
        "Pe myBestDays este inadmisibil ca o persoană să fie dezavantajată din cauza originii, culorii pielii, cetățeniei, apartenenței etnice, religiei sau convingerilor, sexului, identității de gen, orientării sexuale, unui handicap, vârstei sau stării civile.",
        "Aceasta se aplică acceptării sau respingerii rezervărilor, prețurilor și condițiilor, comportamentului din timpul șederii și comunicării prin Platformă.",
        "Suplimentar se aplică articolul 20 din Regulamentul (UE) 2018/302: furnizorii nu pot limita accesul la oferta lor din cauza cetățeniei, domiciliului sau locului de stabilire al unui oaspete în interiorul Uniunii.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Ce înseamnă aceasta pentru furnizori",
      paragraphs: ["În calitate de furnizor nu aveți voie în special:"],
      list: [
        "să respingeți o cerere de rezervare din cauza uneia dintre caracteristicile menționate;",
        "să solicitați prețuri, garanții sau condiții diferite de la oaspeți pentru că îndeplinesc una dintre caracteristici;",
        "să declarați în anunț sau în mesaje că anumite grupuri de persoane sunt nedorite;",
        "să refuzați câini de asistență sau câini-ghid, chiar dacă regulile casei dumneavoastră exclud animalele;",
        "să tratați diferit un oaspete din cauza domiciliului său într-un alt stat membru al Uniunii.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Ce rămâne admisibil",
      paragraphs: [
        "Puteți stabili ocuparea maximă, o vârstă minimă pentru persoana care rezervă principal și reguli obiective ale casei (de exemplu interdicția de a fuma sau orele de liniște), atât timp cât se aplică în mod egal tuturor oaspeților.",
        "Dacă locuiți dumneavoastră înșivă în unitatea de cazare și împărțiți spațiul locativ cu oaspetele, puteți preciza aceasta clar în anunț; caracteristicile de la secțiunea 1 nu justifică însă un refuz.",
        "Puteți respinge o rezervare atunci când există indicii concrete privind o încălcare a regulilor casei sau o fraudă. Motivul trebuie să se refere la comportament, nu la persoană.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Accesibilitate",
      paragraphs: [
        "Informațiile privind accesibilitatea unei unități de cazare trebuie să corespundă realității. A descrie ca fiind accesibilă o unitate de cazare care nu este constituie totodată o încălcare a [Regulilor privind conținutul adecvat](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Atunci când o adaptare este posibilă fără efort disproporționat, ne așteptăm ca furnizorii să o realizeze.",
      ],
    },
    {
      id: "melden",
      heading: "5. Semnalarea discriminării",
      paragraphs: [
        "Dacă ați trăit sau ați observat o discriminare, semnalați-ne acest lucru prin funcția de semnalare sau prin căile de contact din [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden).",
        "Verificăm fiecare semnalare. Dacă se confirmă o încălcare, luăm măsuri până la blocarea definitivă a contului. Dacă din acest motiv v-a fost refuzată o rezervare, vă ajutăm să găsiți o unitate de cazare comparabilă.",
      ],
    },
  ],
};
