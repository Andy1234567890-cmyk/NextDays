import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica pentru perturbări grave",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Uneori un eveniment împiedică călătoria sau șederea, fără vina oaspetelui sau a furnizorului. Prezenta politică descrie care sunt aceste evenimente și ce se aplică atunci.",
    "Ea prevalează față de condiția de anulare aleasă în anunț.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Ce evenimente sunt acoperite",
      paragraphs: [
        "Sunt acoperite evenimentele care survin după rezervare, au fost imprevizibile pentru ambele părți și fac imposibilă sau ilegală călătoria ori șederea:",
      ],
      list: [
        "interdicții administrative de călătorie sau de ședere, restricții de circulație și închideri de frontiere care privesc destinația sau locul de origine;",
        "catastrofe naturale și fenomene naturale care privesc destinația — cutremur, inundație, furtună, incendiu de amploare, erupție vulcanică;",
        "război, conflicte armate, atentate teroriste și tulburări la destinație;",
        "o epidemie sau pandemie constatată de autorități, cu măsuri care interzic șederea;",
        "întreruperea alimentării cu energie electrică, apă sau căldură la destinație pe o perioadă mai lungă;",
        "imposibilitatea totală de a ajunge la destinație din cauza unuia dintre evenimentele menționate.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Ce evenimente nu sunt acoperite",
      paragraphs: ["Nu sunt acoperite în special:"],
      list: [
        "boala sau accidentarea oaspetelui ori a rudelor sale — pentru aceasta este prevăzută o asigurare de călătorie;",
        "impedimente profesionale, date de examene sau anularea concediului;",
        "anularea unui eveniment pentru care a fost rezervată călătoria, dacă unitatea de cazare rămâne utilizabilă;",
        "vremea care nu constituie o catastrofă naturală — ploaie, frig, caniculă, lipsa zăpezii;",
        "anularea unor mijloace de transport individuale, atât timp cât rămâne posibilă o deplasare rezonabilă;",
        "anularea unui zbor sau o grevă la o întreprindere de transport — pentru acestea există pretenții față de întreprinderea de transport.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Ce se aplică atunci când survine un eveniment acoperit",
      paragraphs: [
        "Dacă evenimentul privește perioada rezervării dumneavoastră, puteți anula gratuit. Primiți rambursarea integrală a sumei plătite prin Platformă.",
        "Dacă șederea a început deja, rambursăm partea aferentă nopților care nu mai pot fi utilizate.",
        "Pentru furnizor, dintr-o astfel de anulare nu decurg dezavantaje în evaluarea fiabilității sale.",
        "Ca alternativă puteți conveni cu furnizorul o amânare; vă ajutăm la remodificare.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Cum invocați această politică",
      paragraphs: [
        "Contactați-ne prin căile din [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden) și indicați numărul rezervării și evenimentul.",
        "Verificăm pe baza unor surse public accesibile — dispoziții ale autorităților, avertismente oficiale, relatări ale unor surse de știri recunoscute — și decidem prompt.",
        "Dacă situația nu poate fi încă apreciată definitiv, așteptăm evoluția până cu puțin timp înainte de ziua sosirii și decidem atunci. Rezervarea dumneavoastră rămâne până atunci neschimbată.",
      ],
    },
  ],
};
