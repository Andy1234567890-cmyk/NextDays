import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Comisioane de serviciu",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "myBestDays se finanțează printr-un comision de serviciu asupra rezervărilor intermediate. Această pagină explică cine îl plătește, cum se calculează și unde este indicat.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Cine plătește comisionul de serviciu",
      paragraphs: [
        "Comisionul de serviciu este suportat de furnizor. El este reținut din valoarea rezervării și reduce plata către acesta; oaspetele nu îl plătește suplimentar.",
        "Dacă în mod excepțional pentru o rezervare intervine un comision de serviciu pentru oaspete, îl indicăm înainte de finalizarea rezervării ca poziție distinctă în prețul total. Fără această indicare nu intervine niciun comision pentru oaspete.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Cum se calculează",
      paragraphs: [
        "Comisionul de serviciu este un procent din valoarea rezervării decontate prin Platformă. Cota aplicabilă rezervărilor dumneavoastră este indicată în contul dumneavoastră de gazdă și în acordul pe care l-ați acceptat la înregistrare.",
        "Baza de calcul este prețul cazării plus suplimentele decontate prin Platformă. Nu se includ pozițiile de tranzit care nu reprezintă o contraprestație a furnizorului — în special taxa de stațiune și garanția.",
        "Comisionul de serviciu se calculează și se indică în moneda anunțului.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Taxa pe valoarea adăugată",
      paragraphs: [
        "Asupra comisionului de serviciu se datorează TVA, în măsura în care este datorată legal. Dacă este evidențiată sau se aplică taxarea inversă depinde de sediul și de statutul furnizorului.",
        "Pentru comisionul de serviciu emitem furnizorului un decont, disponibil în contul său.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Anulare și rambursare",
      paragraphs: [
        "Dacă o rezervare este rambursată integral, rambursăm comisionul de serviciu proporțional, în măsura în care se rambursează valoarea rezervării.",
        "Dacă furnizorul anulează fără un motiv important, comisionul de serviciu nu se anulează automat; ne rezervăm dreptul de a solicita costurile generate de anulare.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Modificarea comisionului de serviciu",
      paragraphs: [
        "O modificare a cotei o anunțăm furnizorilor cu cel puțin 30 de zile înainte de intrarea în vigoare, pe un suport durabil; aceasta corespunde articolului 3 alineatul (2) din Regulamentul (UE) 2019/1150.",
        "Pentru rezervările deja confirmate se aplică cota în vigoare la momentul rezervării.",
      ],
    },
  ],
};
