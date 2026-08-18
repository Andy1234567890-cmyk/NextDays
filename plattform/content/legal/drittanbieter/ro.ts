import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Furnizori terți și servicii de plată",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Pentru exploatarea Platformei, myBestDays utilizează servicii ale unor terți. Această pagină îi menționează și explică ce rol au și ale cui condiții se aplică în fiecare caz.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Principiu",
      paragraphs: [
        "Acolo unde un furnizor terț prestează un serviciu direct către dumneavoastră, se aplică, pe lângă condițiile noastre, condițiile și politica sa de confidențialitate. Semnalăm acest lucru la locul respectiv.",
        "Acolo unde un furnizor terț prelucrează exclusiv din însărcinarea noastră, rămânem noi persoana dumneavoastră de contact. Ce persoane împuternicite utilizăm este indicat în [Politica de confidențialitate](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Prestatorul de servicii de plată",
      paragraphs: [
        "Plățile prin Platformă sunt procesate de Stripe. Stripe colectează și prelucrează datele de plată în mod direct și este operator independent pentru acestea. Se aplică suplimentar [Politica de confidențialitate Stripe](https://stripe.com/privacy).",
        "Pentru plata către gazde, Stripe efectuează verificarea de identitate prevăzută de lege.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Directiva privind serviciile de plată și accesul terților",
      paragraphs: [
        "Directiva (UE) 2015/2366 („PSD2”) impune pentru multe plăți o autentificare strictă a clientului. Aceasta este efectuată de banca dumneavoastră sau de emitentul cardului; fără o autentificare reușită, o plată poate fi respinsă.",
        "myBestDays nu este serviciu de inițiere a plății sau de informare cu privire la conturi și nu accesează conturile dumneavoastră bancare.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Hărți, imagini și conținut încorporat",
      paragraphs: [
        "Pentru reprezentările cartografice și datele de amplasare integrăm servicii de hărți ale unor terți. La încărcarea unui astfel de conținut pot fi transmise date către furnizorul respectiv; detaliile și gestionarea consimțământului sunt descrise în [Politica privind cookie-urile](https://mybestdays.dk/rechtliches/cookies).",
        "Imaginile și descrierile din anunțuri provin de la furnizorul respectiv, nu de la noi.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Pagini către care se face trimitere",
      paragraphs: [
        "Platforma poate conține linkuri către pagini ale unor terți. Asupra conținutului acestora nu avem influență și nu ne asumăm răspunderea pentru el. Îndată ce luăm cunoștință de o încălcare a legii, eliminăm linkul fără întârziere.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Magazine de aplicații",
      paragraphs: [
        "Dacă obțineți aplicația myBestDays printr-un magazin de aplicații, se aplică suplimentar condițiile operatorului magazinului respectiv. Operatorul magazinului nu este parte la contractul dintre dumneavoastră și noi și nu datorează nici asistență, nici garanție pentru aplicație.",
      ],
    },
  ],
};
