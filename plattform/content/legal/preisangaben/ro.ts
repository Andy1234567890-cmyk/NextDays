import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Prețuri, clasare și recomandări",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Această pagină explică modul în care sunt afișate prețurile pe myBestDays, de ce depinde ordinea rezultatelor căutării și cum iau naștere recomandările. Ea îndeplinește obligațiile de transparență prevăzute la articolul 6a din Directiva 2005/29/CE, articolul 5 din Regulamentul (UE) 2019/1150 și articolul 27 din Regulamentul (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Cum sunt afișate prețurile",
      paragraphs: [
        "De îndată ce perioada și numărul de călători sunt stabilite, afișăm prețul total pentru întreaga ședere, inclusiv impozitele și toate comisioanele decontate prin Platformă.",
        "Atât timp cât nu este aleasă o perioadă, afișăm un preț pe noapte cu titlu orientativ și îl marcăm ca atare.",
        "Costurile datorate abia la fața locului le indicăm separat înainte de finalizarea rezervării. Ele nu fac parte din prețul total, dar sunt vizibile înainte de rezervare.",
        "Dacă afișăm un preț de comparație tăiat, acesta este cel mai mic preț solicitat de furnizor pentru același serviciu în ultimele 30 de zile anterioare reducerii (articolul 6a din Directiva 98/6/CE).",
        "Prețurile sunt aceleași pentru toți oaspeții. Nu adaptăm prețul la persoana dumneavoastră, la dispozitivul dumneavoastră sau la comportamentul dumneavoastră anterior de căutare.",
      ],
    },
    {
      id: "ranking",
      heading: "2. De ce depinde ordinea rezultatelor căutării",
      paragraphs: [
        "În sortarea standard, ordinea este determinată de următoarele caracteristici, în ordinea descrescătoare a importanței:",
      ],
      list: [
        "concordanța cu căutarea dumneavoastră — disponibilitatea în perioada căutată, capacitatea pentru numărul de călători, amplasarea în zona căutată și filtrele setate;",
        "caracterul complet și calitatea anunțului — descriere, fotografii, informații întreținute despre dotări;",
        "recenziile — nota generală și numărul de recenzii;",
        "fiabilitatea furnizorului — comportamentul de răspuns, rata de acceptare și anulările din partea furnizorului;",
        "actualitatea prețurilor și a disponibilităților;",
        "raportul calitate-preț în comparație cu anunțuri similare din aceeași zonă.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Poziționare plătită",
      paragraphs: [
        "Un furnizor nu își poate cumpăra un loc mai bun în sortarea standard. Cuantumul comisionului de serviciu nu influențează ordinea.",
        "Dacă în viitor vom oferi poziționări plătite, le vom marca fără echivoc drept publicitate și le vom separa vizibil de celelalte rezultate.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Schimbarea sortării",
      paragraphs: [
        "Puteți schimba sortarea oricând, de exemplu după preț sau după recenzie. Sortarea activă este afișată deasupra listei de rezultate.",
        "Vă stă la dispoziție cel puțin o sortare care nu se bazează pe crearea de profiluri în sensul articolului 4 punctul 4 din Regulamentul (UE) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Recomandări",
      paragraphs: [
        "Dacă vă afișăm sugestii („v-ar putea plăcea”, „unități de cazare similare”), acestea se bazează pe căutarea curentă, pe anunțurile vizualizate anterior și pe caracteristici ale unor unități de cazare similare.",
        "Puteți dezactiva recomandările personalizate în contul dumneavoastră. Ulterior veți vedea sugestii bazate exclusiv pe căutarea curentă.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Recenziile în clasare",
      paragraphs: [
        "Cum iau naștere și cum sunt verificate recenziile este descris în [Politica privind recenziile](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Recenziile influențează ordinea, dar nici nu ponderăm recenzii individuale mai mult, nici nu suprimăm recenziile negative.",
      ],
    },
  ],
};
