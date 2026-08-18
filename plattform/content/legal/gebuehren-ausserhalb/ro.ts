import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Taxe în afara platformei",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Prezenta politică reglementează ce sume poate solicita un furnizor în afara Platformei și care nu. Ea protejează oaspeții de a fi confruntați la fața locului cu pretenții care nu au figurat în anunț.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principiu",
      paragraphs: [
        "Tot ce este de plătit pentru serviciul rezervat trebuie indicat în anunț înainte de finalizarea rezervării — fie ca parte a prețului total, fie ca poziție de cost la fața locului.",
        "O sumă care nu a fost indicată nici în prețul total, nici ca și cost la fața locului nu este datorată de oaspete.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Ce poate fi solicitat la fața locului",
      paragraphs: ["La fața locului pot fi solicitate exclusiv:"],
      list: [
        "sume indicate expres în anunț ca fiind costuri la fața locului (de exemplu curățenia finală, pachetul de lenjerie, locul de parcare);",
        "taxe locale precum taxa de stațiune, în măsura în care, conform dispozițiilor locale, se achită la fața locului;",
        "o garanție indicată în anunț;",
        "servicii pe care oaspetele le adaugă abia la fața locului și în mod voluntar, la un preț comunicat în prealabil;",
        "despăgubirea pentru daunele dovedite cauzate de oaspete.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Ce nu poate fi solicitat",
      paragraphs: ["Este inadmisibil în special:"],
      list: [
        "o pretenție suplimentară asupra prețului cazării după finalizarea rezervării;",
        "o taxă pentru faptul că rezervarea s-a făcut prin myBestDays;",
        "un comision de procesare, de rezervare sau de card care nu a fost indicat în anunț;",
        "solicitarea de a anula rezervarea și de a rezerva din nou aceeași unitate de cazare în afara Platformei;",
        "solicitarea de a achita prețul sau o parte a acestuia prin transfer, numerar sau serviciu de plată în afara Platformei, atunci când anunțul prevede plata prin Platformă.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Eludarea Platformei",
      paragraphs: [
        "Dacă contactul dintre oaspete și furnizor s-a stabilit prin Platformă, rezervarea nu poate fi derulată în afara acesteia. Aceasta se aplică ambelor părți.",
        "Cine eludează Platforma pierde protecția acesteia: plățile nu sunt asigurate, politicile noastre de anulare și rambursare nu se aplică, iar în caz de litigiu nu putem media.",
        "Încălcările pot duce la blocarea contului. În cazul furnizorilor putem solicita suplimentar comisionul de serviciu nerealizat.",
      ],
    },
    {
      id: "melden",
      heading: "5. Semnalare",
      paragraphs: [
        "Dacă la fața locului vi se solicită o sumă care nu a figurat în anunț, nu o plătiți și semnalați-ne acest lucru prin căile de contact din [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden). Dacă ați plătit deja, vă ajutăm la recuperare.",
      ],
    },
  ],
};
