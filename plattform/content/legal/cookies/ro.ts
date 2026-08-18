import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politica privind cookie-urile",
  stand: "Actualizat: 18 august 2026",
  intro: [
    "Prezenta politică explică ce cookie-uri și tehnologii similare utilizează myBestDays, în ce scop, cât timp rămân stocate și cum le gestionați.",
    "Ea completează [Politica de confidențialitate](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Ce sunt cookie-urile",
      paragraphs: [
        "Cookie-urile sunt fișiere text mici pe care un site web le stochează în browserul dumneavoastră. Tehnologii similare sunt stocarea locală a browserului și pixelii de urmărire din e-mailuri.",
        "Cookie-urile strict necesare pentru funcționarea Platformei le putem plasa fără consimțământul dumneavoastră. Pentru toate celelalte solicităm consimțământul dumneavoastră (articolul 5 alineatul (3) din Directiva 2002/58/CE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Cookie-uri necesare",
      paragraphs: [
        "Aceste cookie-uri sunt necesare pentru funcționare și nu pot fi dezactivate. Utilizăm în prezent:",
      ],
      list: [
        "„nd_access” — menține autentificarea dumneavoastră. Lizibil doar pentru server (HttpOnly), durată corespunzătoare valabilității sesiunii.",
        "„nd_refresh” — reînnoiește autentificarea dumneavoastră, pentru a nu fi nevoit să vă autentificați permanent din nou. Lizibil doar pentru server, durată 30 de zile.",
        "„nd_gast_locale” — reține limba aleasă de dumneavoastră. Durată un an.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Cookie-uri funcționale, statistice și de marketing",
      paragraphs: [
        "myBestDays nu utilizează în prezent cookie-uri pentru statistică, măsurarea audienței sau publicitate și nu integrează rețele publicitare sau servicii de analiză.",
        "Dacă acest lucru se va schimba, vom solicita în prealabil consimțământul dumneavoastră printr-un dialog de selecție în care refuzul este la fel de simplu ca acceptarea, și vom completa prezenta politică cu cookie-urile concrete.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Conținut încorporat al terților",
      paragraphs: [
        "Pe paginile de detalii pot fi încorporate hărți. Un astfel de conținut îl încărcăm abia după ce îl activați în mod expres; abia atunci pot fi transmise date către furnizorul respectiv.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Cum gestionați cookie-urile",
      paragraphs: [
        "Consimțământul dumneavoastră îl puteți modifica sau retrage oricând prin setările pentru cookie-uri din subsol.",
        "În plus, puteți șterge sau bloca cookie-urile în browserul dumneavoastră. Dacă ștergeți cookie-urile necesare, veți fi deconectat, iar Platforma va funcționa limitat.",
      ],
    },
  ],
};
