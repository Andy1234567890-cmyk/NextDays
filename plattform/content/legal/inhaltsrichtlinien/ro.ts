import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Reguli privind conținutul adecvat",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Prezentele reguli se aplică oricărui conținut publicat de utilizatori pe myBestDays: anunțuri, fotografii, recenzii, mesaje, date de profil și răspunsuri la recenzii.",
    "Ele fac parte din [Condițiile de utilizare](https://mybestdays.dk/rechtliches/nutzungsbedingungen). O încălcare poate duce la eliminarea conținutului și la măsuri împotriva contului.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Ce nu este permis",
      paragraphs: ["Pe myBestDays este inadmisibil în special următorul conținut:"],
      list: [
        "conținut ilegal de orice fel, în special îndemnuri la infracțiuni, conținut terorist și reprezentări ale abuzului sexual asupra copiilor;",
        "conținut care incită la ură sau la violență împotriva unor persoane sau grupuri pe motive de origine, culoarea pielii, religie, convingeri, sex, identitate de gen, orientare sexuală, handicap sau vârstă;",
        "insulte, amenințări, hărțuire și expunerea publică țintită a unor persoane;",
        "date cu caracter personal ale terților fără consimțământul acestora, în special nume, adrese, numere de telefon, date de identitate sau de plată;",
        "informații înșelătoare despre o unitate de cazare, amplasarea, dotările, suprafața sau disponibilitatea acesteia;",
        "fotografii, texte sau mărci ale altora fără drepturile necesare;",
        "publicitate, spam și conținut care conduce către alte căi de rezervare în afara Platformei;",
        "programe malițioase, tentative de phishing și linkuri către un astfel de conținut;",
        "anunțuri pentru altceva decât un serviciu de cazare.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotografii",
      paragraphs: [
        "Fotografiile trebuie să prezinte unitatea de cazare efectiv oferită și să fie realizate într-o stare care corespunde celei actuale.",
        "Fotografiile nu pot prezenta persoane identificabile fără consimțământul acestora. Prelucrarea este admisibilă în măsura în care nu denaturează impresia asupra unității de cazare — o luminare da, o construcție vecină retușată nu.",
        "Supravegherea video în unitatea de cazare trebuie dezvăluită în anunț. În spațiile interioare în care oaspeții au o așteptare legitimă de intimitate — dormitoare, băi — camerele sunt inadmisibile, chiar și oprite.",
      ],
    },
    {
      id: "melden",
      heading: "3. Semnalarea conținutului",
      paragraphs: [
        "Dacă apreciați un conținut ca fiind ilegal sau contrar prezentelor reguli, îl puteți semnala prin funcția de semnalare disponibilă la fiecare anunț, fiecare recenzie și fiecare mesaj.",
        "Procedura de semnalare conform articolului 16 din Regulamentul (UE) 2022/2065 și modul de tratare a semnalărilor sunt descrise în [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Cum aplicăm regulile",
      paragraphs: [
        "Verificăm fiecare conținut semnalat și alegem cea mai blândă măsură adecvată: atenționare, eliminarea părții vizate, eliminarea întregului conținut, restrângerea vizibilității, blocarea unei funcții sau blocarea contului.",
        "Încălcările repetate sau grave cântăresc mai mult. În cazul conținutului vădit ilegal sau al pericolului pentru persoane acționăm imediat.",
        "Fiecare măsură o motivăm față de persoana vizată și indicăm calea de plângere. Plângerea este prelucrată de oameni.",
      ],
    },
  ],
};
