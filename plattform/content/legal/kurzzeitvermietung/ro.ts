import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Închirierea pe termen scurt și obligațiile de înregistrare",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "În multe orașe și regiuni închirierea pe termen scurt a locuințelor este supusă autorizării, înregistrării sau notificării. Această pagină explică ce înseamnă aceasta pentru furnizori și pentru oaspeți.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Cadrul juridic",
      paragraphs: [
        "Regulamentul (UE) 2024/1028 privind colectarea și schimbul de date referitoare la serviciile de închiriere pe termen scurt a locuințelor creează un cadru unitar: acolo unde un stat membru sau o autoritate teritorială a introdus o procedură de înregistrare, fiecare unitate primește un număr de înregistrare.",
        "Platformele trebuie să afișeze acest număr, să îi verifice valabilitatea prin sondaj și să transmită autorităților competente, la intervale regulate, date privind activitatea.",
        "Pe lângă acestea continuă să se aplice dispoziții naționale și locale — de exemplu privind schimbarea destinației locuințelor, numărul maxim de zile de închiriere, protecția împotriva incendiilor și înregistrarea oaspeților.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Ce trebuie să facă furnizorii",
      paragraphs: [
        "Verificați înainte de publicare dacă pentru unitatea dumneavoastră de cazare există o obligație de înregistrare, de autorizare sau de notificare și îndepliniți-o.",
        "Introduceți numărul de înregistrare în obiect, dacă există unul. Îl afișăm în anunț.",
        "Respectați numărul maxim de zile de închiriere și celelalte limite locale. Monitorizarea acestora este sarcina dumneavoastră, nu a noastră.",
        "Nu avem voie să afișăm permanent un anunț fără numărul de înregistrare necesar. Dacă lipsește sau se dovedește nevalabil, îl solicităm ulterior; dacă informația nu este furnizată, dezactivăm anunțul.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Ce înseamnă aceasta pentru oaspeți",
      paragraphs: [
        "Dacă pentru o unitate de cazare există o obligație de înregistrare, vedeți numărul de înregistrare în anunț. El este o indicație că închirierea a fost notificată autorității competente.",
        "La destinație poate fi necesară o înregistrare (fișă de cazare, date de identitate, declarație privind taxa de stațiune). Furnizorul solicită informațiile necesare; puneți-le la dispoziție în timp util.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Transmiterea datelor către autorități",
      paragraphs: [
        "În măsura în care Regulamentul (UE) 2024/1028 sau dreptul național o prevede, transmitem autorităților competente date privind activitatea de închiriere — în special numărul de înregistrare, adresa unității, numărul de nopți ocupate și numărul de oaspeți.",
        "Această transmitere se face pentru îndeplinirea unei obligații legale conform articolului 6 alineatul (1) litera (c) din Regulamentul (UE) 2016/679. Detaliile sunt descrise în [Politica de confidențialitate](https://mybestdays.dk/rechtliches/datenschutz).",
        "Separat de aceasta există obligația fiscală de raportare conform DAC7; a se vedea [Politica fiscală](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Semnalarea încălcărilor",
      paragraphs: [
        "Dacă aveți indicii că o unitate de cazare este oferită fără autorizarea sau înregistrarea necesară, semnalați-ne acest lucru prin funcția de semnalare de la anunț. Verificăm fiecare semnalare.",
      ],
    },
  ],
};
