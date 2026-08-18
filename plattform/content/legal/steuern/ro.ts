import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica fiscală",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Această pagină explică ce impozite și taxe pot interveni la o rezervare prin myBestDays, cine le datorează și ce obligații de raportare ne revin în calitate de operator de platformă.",
    "Ea nu constituie consultanță fiscală. Pentru tratamentul dumneavoastră fiscal în cazul concret adresați-vă unui consultant fiscal.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Ce privește oaspeții",
      paragraphs: [
        "Prețul total afișat conține impozitele decontate prin Platformă — în special TVA asupra serviciului de cazare, în măsura în care furnizorul o datorează.",
        "Taxele locale precum taxa de stațiune, taxa pe paturi sau taxa turistică sunt, în funcție de comună, fie decontate prin Platformă, fie percepute la fața locului. Care situație se aplică indicăm înainte de finalizarea rezervării.",
        "Factura pentru serviciul de cazare este emisă de furnizor; el este profesionistul prestator. Dacă aveți nevoie de o factură cu TVA evidențiată, o solicitați de la furnizor.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Ce privește furnizorii",
      paragraphs: [
        "Furnizorii răspund ei înșiși pentru tratamentul fiscal corect al veniturilor lor — impozitul pe venit sau pe profit, TVA și taxele locale.",
        "Dacă o închiriere este supusă TVA și ce cotă se aplică depinde de dreptul statului în care se află unitatea de cazare (locul prestării în cazul bunurilor imobile).",
        "Furnizorii introduc în obiect taxele aplicabile unității lor de cazare, pentru ca acestea să fie indicate corect în anunț.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Raportarea către autoritățile fiscale (DAC7)",
      paragraphs: [
        "În calitate de operator al unei platforme digitale suntem obligați, conform Directivei (UE) 2021/514 („DAC7”) și dispozițiilor naționale de transpunere, să raportăm anual autorității fiscale competente informații privind furnizorii care fac obiectul raportării și remunerațiile obținute de aceștia prin Platformă.",
        "Se raportează în special numele, adresa, codul de identificare fiscală, data nașterii sau numărul de înregistrare, datele contului pentru plată, adresa unității de cazare și remunerațiile plătite pe trimestru, precum și comisioanele reținute.",
        "Furnizorii primesc o copie a datelor raportate care îi privesc.",
        "Dacă un furnizor nu pune la dispoziție informațiile necesare raportării în pofida a două solicitări, suntem obligați să reținem plățile și să blocăm contul.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Rețineri",
      paragraphs: [
        "Dacă dreptul unui stat ne obligă să reținem și să virăm impozite dintr-o plată, o facem și indicăm reținerea în decont.",
      ],
    },
  ],
};
