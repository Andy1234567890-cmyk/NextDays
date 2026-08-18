import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Declarație de accesibilitate",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "myBestDays trebuie să poată fi utilizat de toți. Prezenta declarație descrie stadiul accesibilității Platformei, limitările cunoscute și modul de a ne semnala bariere.",
    "Ea se referă la cerințele Directivei (UE) 2019/882 privind cerințele de accesibilitate aplicabile produselor și serviciilor, care de la 28 iunie 2025 se aplică serviciilor de comerț electronic.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stadiul accesibilității",
      paragraphs: [
        "Ne orientăm după standardul armonizat EN 301 549 și după Ghidul de accesibilitate a conținutului web (WCAG) 2.1 care stă la baza acestuia, la nivelul de conformitate AA.",
        "Sunt implementate printre altele: utilizarea consecventă cu tastatura, focus vizibil, structură semantică a titlurilor, etichete la toate câmpurile de formular, alternative textuale pentru elementele de comandă, contrast cromatic suficient, scalabilitatea textului fără pierderea conținutului, precum și o afișare care se adaptează dimensiunii ecranului.",
        "Textele juridice sunt disponibile în toate cele 24 de limbi oficiale ale Uniunii și sunt marcate lingvistic corect, pentru ca cititoarele de ecran să le redea corect.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Limitări cunoscute",
      paragraphs: ["În prezent nu sunt accesibile în special:"],
      list: [
        "Fotografiile și descrierile din anunțuri provin de la furnizori; alternativele textuale la fotografii pot lipsi sau pot fi insuficiente. Îi îndemnăm pe furnizori să le completeze.",
        "Reprezentările cartografice încorporate ale terților pot fi utilizate doar limitat cu tastatura. Toate datele de amplasare sunt disponibile suplimentar și sub formă de text.",
        "Documentele încărcate de furnizori (de exemplu regulile casei în format PDF) nu sunt marcate în mod consecvent într-o formă accesibilă.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Accesibilitatea unităților de cazare",
      paragraphs: [
        "Prezenta declarație privește Platforma, nu unitățile de cazare. Informațiile privind accesibilitatea constructivă a unei unități de cazare provin de la furnizor.",
        "Dacă depindeți de anumite caracteristici — acces fără trepte, lățimea ușilor, duș la nivelul podelei, lift —, clarificați-le înainte de rezervare cu furnizorul prin funcția de mesaje. Informațiile inexacte privind accesibilitatea reprezintă o încălcare a regulilor noastre și pot fi semnalate.",
      ],
    },
    {
      id: "melden",
      heading: "4. Semnalarea barierelor",
      paragraphs: [
        `Dacă întâmpinați o barieră, semnalați-ne-o la ${ANBIETER.email} sau prin căile de contact din [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Vă rugăm să descrieți ce pagină este vizată, ce doreați să faceți și ce mijloace ajutătoare folosiți. Confirmăm primirea și vă comunicăm cum și până când vom înlătura bariera.",
        "Dacă aveți nevoie de o informație într-o formă accesibilă, v-o punem la dispoziție la cerere.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Procedura de aplicare",
      paragraphs: [
        "Dacă nu sunteți mulțumit de răspunsul nostru, vă puteți adresa organismului competent pentru supravegherea pieței conform Directivei (UE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (anterior Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danemarca",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
