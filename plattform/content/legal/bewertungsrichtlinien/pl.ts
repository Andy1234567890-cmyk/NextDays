import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zasady dotyczące opinii",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Opinie są dla gości najważniejszym niezależnym źródłem informacji. Niniejsze zasady opisują, kto może wystawiać opinie, jak zapewniamy, że pochodzą one od rzeczywistych gości, i kiedy usuwamy opinię.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Jak zapewniamy autentyczność",
      paragraphs: [
        "Opinię może wystawić wyłącznie osoba, która zarezerwowała zakwaterowanie przez myBestDays i której okres pobytu się rozpoczął. Opinia jest technicznie powiązana z konkretną rezerwacją.",
        "Spełniamy w ten sposób obowiązek wynikający z pkt 23b załącznika I do dyrektywy 2005/29/WE, aby jako opinie gości prezentować wyłącznie te, wobec których podjęliśmy rozsądne kroki w celu sprawdzenia, że pochodzą od rzeczywistych gości.",
        "Nie kupujemy opinii, nie zlecamy ich i nie zamieszczamy opinii fałszywych. Nie tolerujemy też takiego postępowania dostawców.",
      ],
    },
    {
      id: "frist",
      heading: "2. Termin i publikacja",
      paragraphs: [
        "Po wyjeździe mają Państwo 14 dni na wystawienie opinii. Dostawca może w tym samym terminie wystawić opinię o Państwu.",
        "Obie opinie publikowane są jednocześnie, gdy tylko obie zostaną wystawione albo upłynie termin. Dzięki temu żadna ze stron nie wpływa na drugą.",
        "Wystawioną opinię mogą Państwo wycofać w terminie. Po publikacji zmiana nie jest już możliwa; mogą Państwo wystąpić o jej usunięcie.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Odpowiedź dostawcy",
      paragraphs: [
        "Dostawca może publicznie odpowiedzieć na opinię. Do odpowiedzi stosuje się te same zasady co do samej opinii.",
        "Odpowiedź nie zmienia opinii i nie wpływa na ocenę łączną.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Kiedy usuwamy opinię",
      paragraphs: [
        "Nie usuwamy opinii dlatego, że jest negatywna, ani dlatego, że dostawca jest z niej niezadowolony. Usuwamy ją, gdy:",
      ],
      list: [
        "narusza [Zasady dotyczące odpowiednich treści](https://mybestdays.dk/rechtliches/inhaltsrichtlinien);",
        "zawiera dane osobowe osób trzecich;",
        "wyraźnie odnosi się do innego zakwaterowania lub innego pobytu;",
        "dotyczy w istocie okoliczności, na które ani gość, ani dostawca nie mieli wpływu (np. pogoda, gminna budowa, ruch drogowy przy dojeździe) — w takim wypadku usuwamy tylko daną część, jeżeli da się ją wydzielić;",
        "wyraźnie służy wymuszeniu, na przykład dlatego, że powiązano ją z żądaniem;",
        "została uzyskana za pomocą zachęt lub wystawiona w sposób skoordynowany.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Zachęty są niedopuszczalne",
      paragraphs: [
        "Dostawcy nie mogą oferować pieniędzy, rabatów, podwyższenia standardu, prezentów ani innych korzyści za opinię — ani za jej niewystawienie.",
        "Dostawcy mogą zapraszać gości do wystawienia opinii, nie wpływając na ocenę. Zaproszenie, które zachęca do opinii tylko w razie pozytywnego doświadczenia, jest niedopuszczalne.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Jak prezentujemy opinie",
      paragraphs: [
        "Ocena łączna to nieważona średnia wszystkich opublikowanych opinii o danym zakwaterowaniu. Nie ważymy żadnej opinii wyżej dlatego, że jest korzystniejsza.",
        "Sortowanie domyślne pokazuje najpierw najnowsze opinie. Mogą Państwo przełączyć się na inne sortowania; aktywne sortowanie jest wskazane.",
        "Podajemy, na ilu opiniach opiera się ocena łączna. Przy mniej niż trzech opiniach nie prezentujemy oceny łącznej, lecz wyłącznie poszczególne opinie.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Reklamacja od decyzji",
      paragraphs: [
        "Jeżeli usuniemy Państwa opinię albo odmówimy usunięcia opinii, uzasadniamy to i wskazujemy drogę reklamacyjną — zob. [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};
