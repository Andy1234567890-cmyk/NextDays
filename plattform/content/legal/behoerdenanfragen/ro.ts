import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica pentru cererile autorităților și ale organelor de urmărire penală",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Prezenta politică se adresează autorităților, instanțelor și organelor de urmărire penală care solicită de la myBestDays date sau adresează un ordin împotriva unui conținut. Ea este publică aici pentru ca și utilizatorii să poată citi în ce condiții furnizăm date.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principiu",
      paragraphs: [
        "Furnizăm date ale utilizatorilor numai atunci când există un temei juridic valabil și cererea îndeplinește cerințele formale. O simplă solicitare informală de date nu este suficientă.",
        "Verificăm fiecare cerere sub aspectul competenței, temeiului juridic, caracterului determinat și proporționalității și furnizăm numai datele indicate în cerere.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Cerințe privind o cerere",
      paragraphs: ["O cerere ar trebui să conțină:"],
      list: [
        "autoritatea solicitantă, numărul de dosar și datele de contact ale persoanei care instrumentează, pe hârtie cu antet oficial;",
        "temeiul juridic conform dreptului național sau dreptului Uniunii;",
        "o desemnare exactă a persoanei vizate sau a contului vizat — adresă de e-mail, număr de rezervare sau URL-ul anunțului;",
        "datele exact desemnate și perioada;",
        "după caz, ordinul unei instanțe, în măsura în care legea aplicabilă îl impune;",
        "o mențiune, dacă informarea persoanei vizate ar periclita ancheta, cu indicarea temeiului juridic.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Ordine conform Regulamentului (UE) 2022/2065",
      paragraphs: [
        "Ordinele de a acționa împotriva conținutului ilegal (articolul 9) și ordinele de a furniza informații (articolul 10) trebuie să conțină elementele menționate acolo, în special temeiul juridic, locația electronică exactă, motivarea, căile de atac și limba.",
        "Confirmăm primirea și comunicăm autorității emitente ce măsuri am luat și când.",
        "Despre un ordin informăm persoana vizată cel târziu la momentul punerii în aplicare, cu excepția cazului în care autoritatea dispune o amânare cu indicarea temeiului juridic.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Situații de urgență",
      paragraphs: [
        "Dacă există un pericol iminent pentru viață sau integritatea corporală, furnizăm datele necesare înlăturării acestuia și fără un ordin formal prealabil. Marcați o astfel de cerere în mod expres ca urgentă și descrieți pericolul.",
        "Dacă există indicii privind o infracțiune care generează un pericol pentru viața sau siguranța unei persoane, informăm din proprie inițiativă autoritățile competente (articolul 18 din Regulamentul (UE) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Ce date deținem",
      paragraphs: [
        "Ce categorii de date prelucrăm și cât timp le stocăm este descris în [Politica de confidențialitate](https://mybestdays.dk/rechtliches/datenschutz). Dincolo de termenele menționate acolo nu deținem date.",
        "Nu are loc o stocare a datelor dincolo de necesitate. O solicitare de a conserva temporar date pentru o procedură în curs o punem în aplicare în limitele permise de lege.",
        "Date de plată complete nu deținem; acestea trebuie solicitate de la prestatorul de servicii de plată.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Informarea persoanei vizate",
      paragraphs: [
        "Informăm utilizatorii vizați cu privire la o cerere care privește datele lor, cu excepția cazului în care o dispoziție legală sau un ordin motivat al unei autorități interzice acest lucru ori există un pericol iminent pentru viață sau integritatea corporală.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Unde se adresează cererile",
      paragraphs: [
        "Cererile se adresează punctului unic de contact pentru autorități, menționat în [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa). Le prelucrăm în limbile germană și engleză.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparență",
      paragraphs: [
        "Numărul și tipul ordinelor autorităților le indicăm în raportul nostru anual de transparență; a se vedea [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
