import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica privind drepturile de autor",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "myBestDays respectă drepturile terților și așteaptă același lucru de la utilizatorii săi. Prezenta politică descrie cum semnalați o încălcare a dreptului de autor și cum o tratăm.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principiu",
      paragraphs: [
        "Cine publică conținut pe Platformă garantează că deține drepturile necesare în acest scop. Aceasta se aplică în special fotografiilor, planurilor, textelor și fragmentelor de hartă din anunțuri.",
        "Publicarea de conținut al altora fără permisiune este o încălcare a [Condițiilor de utilizare](https://mybestdays.dk/rechtliches/nutzungsbedingungen) și a [Regulilor privind conținutul adecvat](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Semnalarea unei încălcări",
      paragraphs: [
        "Semnalați o încălcare a dreptului de autor prin funcția de semnalare de la conținutul vizat sau prin punctul de contact menționat în [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa). O semnalare ar trebui să conțină:",
      ],
      list: [
        "o desemnare exactă a conținutului contestat, în special adresa URL;",
        "o descriere a operei protejate și dovada calității dumneavoastră de titular de drepturi sau a împuternicirii de a acționa pentru titular;",
        "o motivare a faptului că utilizarea nu este permisă;",
        "numele dumneavoastră și o adresă de contact;",
        "declarația că informațiile dumneavoastră sunt, după cea mai bună știință, corecte și complete.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Cum prelucrăm semnalările",
      paragraphs: [
        "Confirmăm primirea semnalării dumneavoastră fără întârziere și decidem prompt și cu diligență.",
        "Dacă apreciem semnalarea ca fiind întemeiată, eliminăm conținutul sau blocăm accesul la el și informăm persoana care l-a publicat, indicând motivele și calea de plângere.",
        "Dacă apreciem semnalarea ca fiind neîntemeiată, vă comunicăm acest lucru cu o motivare.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Contestația persoanei vizate",
      paragraphs: [
        "Dacă conținutul dumneavoastră a fost eliminat și considerați acest lucru nejustificat, puteți depune gratuit plângere în termen de șase luni. Expuneți de ce sunteți îndreptățit la utilizare.",
        "Dacă plângerea se dovedește întemeiată, restabilim conținutul.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Încălcări repetate",
      paragraphs: [
        "Conturile prin care se publică în mod repetat conținut care încalcă drepturi le blocăm după o avertizare prealabilă. Aceasta corespunde articolului 23 din Regulamentul (UE) 2022/2065.",
        "De asemenea blocăm funcția de semnalare pentru persoanele care depun în mod repetat semnalări vădit neîntemeiate.",
      ],
    },
  ],
};
