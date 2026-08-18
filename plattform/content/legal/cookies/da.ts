import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cookiepolitik",
  stand: "Opdateret: 18. august 2026",
  intro: [
    "Denne politik forklarer, hvilke cookies og lignende teknologier myBestDays anvender, til hvilket formål, hvor længe de gemmes, og hvordan du styrer dem.",
    "Den supplerer [Privatlivspolitik](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Hvad cookies er",
      paragraphs: [
        "Cookies er små tekstfiler, som et website gemmer i din browser. Lignende teknologier er browserens lokale lager og tællepixels i e-mails.",
        "Cookies, der er strengt nødvendige for driften af platformen, må vi sætte uden dit samtykke. For alle øvrige indhenter vi dit samtykke (artikel 5, stk. 3, i direktiv 2002/58/EF).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Nødvendige cookies",
      paragraphs: [
        "Disse cookies er nødvendige for driften og kan ikke fravælges. Vi sætter i øjeblikket:",
      ],
      list: [
        "„nd_access“ — holder dig logget ind. Kun læsbar for serveren (HttpOnly), levetid svarende til sessionens gyldighed.",
        "„nd_refresh“ — fornyer dit login, så du ikke skal logge ind igen hele tiden. Kun læsbar for serveren, levetid 30 dage.",
        "„nd_gast_locale“ — husker dit valgte sprog. Levetid ét år.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funktionelle, statistiske og markedsføringscookies",
      paragraphs: [
        "myBestDays sætter i øjeblikket ingen cookies til statistik, målgruppemåling eller reklame og indlejrer ingen reklamenetværk eller analysetjenester.",
        "Skulle det ændre sig, indhenter vi først dit samtykke via en valgdialog, hvor det er lige så let at afvise som at acceptere, og udvider denne politik med de konkrete cookies.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Indlejret indhold fra tredjeparter",
      paragraphs: [
        "På detaljesider kan der være indlejret kort. Sådant indhold indlæser vi først, når du udtrykkeligt aktiverer det; først da kan data overføres til den pågældende udbyder.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Sådan styrer du cookies",
      paragraphs: [
        "Dit samtykke kan du til enhver tid ændre eller trække tilbage via cookieindstillingerne i sidefoden.",
        "Desuden kan du slette eller blokere cookies i din browser. Sletter du de nødvendige cookies, bliver du logget ud, og platformen fungerer begrænset.",
      ],
    },
  ],
};
