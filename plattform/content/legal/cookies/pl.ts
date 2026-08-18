import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Polityka plików cookie",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsza polityka wyjaśnia, jakie pliki cookie i podobne technologie stosuje myBestDays, w jakim celu, jak długo są przechowywane i jak mogą Państwo nimi zarządzać.",
    "Uzupełnia [Politykę prywatności](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Czym są pliki cookie",
      paragraphs: [
        "Pliki cookie to niewielkie pliki tekstowe zapisywane przez stronę internetową w Państwa przeglądarce. Podobnymi technologiami są pamięć lokalna przeglądarki i piksele zliczające w wiadomościach e-mail.",
        "Pliki cookie ściśle niezbędne do działania platformy możemy zapisywać bez Państwa zgody. W przypadku wszystkich pozostałych pobieramy Państwa zgodę (art. 5 ust. 3 dyrektywy 2002/58/WE).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Pliki cookie niezbędne",
      paragraphs: [
        "Te pliki cookie są niezbędne do działania i nie można ich wyłączyć. Obecnie zapisujemy:",
      ],
      list: [
        "„nd_access” — utrzymuje Państwa zalogowanie. Odczytywalny wyłącznie przez serwer (HttpOnly), czas życia odpowiadający ważności sesji.",
        "„nd_refresh” — odnawia zalogowanie, aby nie trzeba było logować się wciąż na nowo. Odczytywalny wyłącznie przez serwer, czas życia 30 dni.",
        "„nd_gast_locale” — zapamiętuje wybrany język. Czas życia jeden rok.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Pliki cookie funkcjonalne, statystyczne i marketingowe",
      paragraphs: [
        "myBestDays nie zapisuje obecnie plików cookie do celów statystycznych, pomiaru zasięgu ani reklamy i nie osadza sieci reklamowych ani usług analitycznych.",
        "Gdyby to się zmieniło, uprzednio pobralibyśmy Państwa zgodę za pomocą okna wyboru, w którym odmowa jest równie prosta jak zgoda, i uzupełnilibyśmy niniejszą politykę o konkretne pliki cookie.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Osadzone treści podmiotów trzecich",
      paragraphs: [
        "Na stronach szczegółowych mogą być osadzone mapy. Takie treści wczytujemy dopiero po ich wyraźnym aktywowaniu przez Państwa; dopiero wtedy dane mogą zostać przekazane danemu dostawcy.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Jak zarządzać plikami cookie",
      paragraphs: [
        "Zgodę mogą Państwo w każdej chwili zmienić lub wycofać w ustawieniach plików cookie w stopce.",
        "Ponadto mogą Państwo usuwać lub blokować pliki cookie w przeglądarce. Usunięcie plików niezbędnych spowoduje wylogowanie, a platforma będzie działać w ograniczonym zakresie.",
      ],
    },
  ],
};
