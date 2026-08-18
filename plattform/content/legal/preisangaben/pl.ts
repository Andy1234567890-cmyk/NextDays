import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ceny, pozycjonowanie i rekomendacje",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsza strona wyjaśnia, jak prezentowane są ceny w myBestDays, co decyduje o kolejności wyników wyszukiwania i jak powstają rekomendacje. Realizuje obowiązki przejrzystości wynikające z art. 6a dyrektywy 2005/29/WE, art. 5 rozporządzenia (UE) 2019/1150 i art. 27 rozporządzenia (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Jak prezentowane są ceny",
      paragraphs: [
        "Gdy tylko znane są okres i liczba podróżnych, prezentujemy cenę całkowitą za cały pobyt, obejmującą podatki i wszystkie opłaty rozliczane przez platformę.",
        "Dopóki okres nie został wybrany, prezentujemy orientacyjną cenę za noc i oznaczamy ją jako taką.",
        "Koszty należne dopiero na miejscu wskazujemy odrębnie przed finalizacją rezerwacji. Nie wchodzą one w skład ceny całkowitej, lecz są widoczne przed rezerwacją.",
        "Jeżeli prezentujemy przekreśloną cenę porównawczą, jest to najniższa cena stosowana przez dostawcę za tę samą usługę w ciągu 30 dni przed obniżką (art. 6a dyrektywy 98/6/WE).",
        "Ceny są jednakowe dla wszystkich gości. Nie dostosowujemy ceny do Państwa osoby, urządzenia ani dotychczasowej historii wyszukiwania.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Co decyduje o kolejności wyników wyszukiwania",
      paragraphs: [
        "W sortowaniu domyślnym o kolejności decydują następujące czynniki, w malejącym znaczeniu:",
      ],
      list: [
        "zgodność z Państwa wyszukiwaniem — dostępność w poszukiwanym okresie, pojemność dla liczby podróżnych, położenie w poszukiwanym obszarze i ustawione filtry;",
        "kompletność i jakość ogłoszenia — opis, zdjęcia, utrzymywane informacje o wyposażeniu;",
        "opinie — ocena łączna i liczba opinii;",
        "rzetelność dostawcy — czas reakcji, wskaźnik akceptacji i anulowania po jego stronie;",
        "aktualność cen i dostępności;",
        "stosunek jakości do ceny w porównaniu z podobnymi ogłoszeniami w tym samym obszarze.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Płatne pozycjonowanie",
      paragraphs: [
        "Dostawca nie może kupić lepszej pozycji w sortowaniu domyślnym. Wysokość opłaty serwisowej nie wpływa na kolejność.",
        "Gdybyśmy w przyszłości oferowali płatne pozycjonowanie, oznaczylibyśmy je jednoznacznie jako reklamę i widocznie oddzielili od pozostałych wyników.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Zmiana sortowania",
      paragraphs: [
        "Sortowanie mogą Państwo zmienić w każdej chwili, na przykład według ceny lub oceny. Aktywne sortowanie jest wskazane nad listą wyników.",
        "Dostępne jest co najmniej jedno sortowanie nieoparte na profilowaniu w rozumieniu art. 4 pkt 4 rozporządzenia (UE) 2016/679.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Rekomendacje",
      paragraphs: [
        "Jeżeli prezentujemy Państwu propozycje („może Cię zainteresować”, „podobne obiekty”), opierają się one na bieżącym wyszukiwaniu, wcześniej oglądanych ogłoszeniach i cechach podobnych obiektów.",
        "Rekomendacje spersonalizowane mogą Państwo wyłączyć na swoim koncie. Zobaczą wtedy Państwo propozycje oparte wyłącznie na bieżącym wyszukiwaniu.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Opinie w pozycjonowaniu",
      paragraphs: [
        "Sposób powstawania i weryfikacji opinii opisano w [Zasadach dotyczących opinii](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Opinie wpływają na kolejność, lecz nie ważymy pojedynczych opinii wyżej ani nie ukrywamy negatywnych.",
      ],
    },
  ],
};
