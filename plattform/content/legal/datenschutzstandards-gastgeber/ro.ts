import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Standarde de protecție a datelor pentru gazde",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Când oferiți prin myBestDays, primiți date cu caracter personal ale oaspeților dumneavoastră. Pentru prelucrarea acestora sunteți operator independent în sensul Regulamentului (UE) 2016/679 (RGPD). Prezentele standarde descriu ce așteptăm de la dumneavoastră în acest sens.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Limitarea legată de scop",
      paragraphs: [
        "Utilizați datele oaspeților exclusiv pentru a derula rezervarea, a comunica cu oaspetele și a vă îndeplini obligațiile legale (de exemplu fișa de cazare, taxa de stațiune, obligațiile fiscale și de păstrare).",
        "Orice altă utilizare — în special publicitate, buletine informative, transmiterea către terți, includerea într-o bază proprie de date de oaspeți pentru rezervări directe ulterioare — necesită un temei juridic propriu, de regulă consimțământul oaspetelui.",
        "Nu utilizați datele oaspeților pentru a determina oaspetele să facă o rezervare în afara Platformei.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Reducerea la minimum a datelor",
      paragraphs: [
        "Colectați numai datele de care aveți efectiv nevoie. Copii ale actelor de identitate solicitați numai atunci când o dispoziție legală o impune, și le stocați doar atât timp cât prevede dispoziția.",
        "Date de plată nu solicitați. Plățile se derulează prin Platformă.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Securitate",
      paragraphs: [
        "Protejați datele oaspeților prin măsuri tehnice și organizatorice adecvate — acces doar pentru persoanele care au nevoie de date, dispozitive protejate, transmitere criptată.",
        "Dacă folosiți angajați, personal de curățenie sau co-gazde, îi obligați la confidențialitate și le dați numai datele de care au nevoie pentru sarcina lor.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Păstrare și ștergere",
      paragraphs: [
        "Ștergeți datele oaspeților de îndată ce scopul a încetat și nu mai există o obligație de păstrare.",
        "Fișele de cazare și documentele relevante fiscal le păstrați atât timp cât prevede legislația țării dumneavoastră — nu mai mult.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Drepturile oaspeților",
      paragraphs: [
        "Dacă un oaspete vi se adresează cu o cerere de acces, rectificare, ștergere sau opoziție, o soluționați în termen. Dacă privește date aflate la noi, îl îndrumați către noi.",
        "Vă informați oaspeții cu privire la modul în care le prelucrați datele, în măsura în care depășiți derularea rezervării.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Incidente de securitate a datelor",
      paragraphs: [
        "Dacă survine o încălcare a securității datelor oaspeților, informați fără întârziere autoritatea de supraveghere competentă și, acolo unde este necesar, oaspeții vizați.",
        "Dacă incidentul privește date primite prin Platformă, ne informați suplimentar și pe noi, pentru a ne putea verifica propriile obligații.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Camere și dispozitive de înregistrare",
      paragraphs: [
        "În spațiile interioare cu așteptare legitimă de intimitate — dormitoare, băi — camerele și microfoanele sunt inadmisibile, chiar și oprite.",
        "Toate celelalte camere, detectoare de mișcare cu înregistrare, sonerii cu cameră și senzori de zgomot le dezvăluiți în anunț, cu indicarea amplasării și a ceea ce se înregistrează.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Consecințele încălcărilor",
      paragraphs: [
        "Încălcările prezentelor standarde le tratăm ca încălcări ale [Condițiilor suplimentare pentru gazde](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) și putem lua măsuri până la blocarea contului.",
      ],
    },
  ],
};
