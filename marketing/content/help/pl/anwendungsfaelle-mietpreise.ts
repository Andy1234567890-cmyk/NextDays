import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Ceny wynajmu",
  description: "Optymalne ustalanie cen wynajmu.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Ceny wynajmu",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optymalizacja cen na wysoki sezon",
          excerpt: "Jak celowo podnieść ceny na okresy o wysokim popycie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "W wysokim sezonie popyt wyraźnie rośnie, podczas gdy Twoja cena bazowa przyjmuje te same wartości co w pozostałej części roku. Bez dostosowania sezonowego tracisz przychód w najsilniejszym okresie roku — dostosowanie odbywa się przez plan cenowy Twojego obiektu, a nie przez ręczne nadpisywanie pojedynczych dni.",
            },
            {
              type: "steps",
              items: [
                "Otwórz plan cenowy dotkniętego obiektu i utwórz regułę sezonową dla żądanego okresu.",
                "Ustaw dopłatę jako wartość procentową lub stałą kwotę powyżej ceny bazowej — plan cenowy automatycznie przejmuje walutę obiektu.",
                "Sprawdź w kalendarzu, że nowa cena dla okresu wysokiego sezonu jest wyświetlana poprawnie, zanim ją aktywujesz.",
                "Skontroluj minimalny pobyt dla wysokiego sezonu — często sensowny jest wyższy minimalny czas rezerwacji, aby utrzymać przewidywalne obłożenie.",
                "Po aktywacji obserwuj sytuację rezerwacji przez pierwsze dni i w razie potrzeby dostosuj dopłatę.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Reguła sezonowa działa na wszystkie kanały jednocześnie: na portalach, platformie i stronie internetowej. Szczegóły dotyczące budowy reguł znajdziesz w artykule [Plany cenowe](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Wspieranie dłuższych pobytów rabatem",
          excerpt: "Jak nagradzać gości za dłuższy czas pobytu i zmniejszyć nakład pracy przy zmianach.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Krótkie pobyty oznaczają więcej przyjazdów i wyjazdów, więcej sprzątań i większe ryzyko pustostanu między rezerwacjami. Stopniowany rabat za długość pobytu czyni dłuższe rezerwacje bardziej atrakcyjnymi dla gości i wyraźnie zmniejsza ten nakład pracy.",
            },
            {
              type: "steps",
              items: [
                "Otwórz plan cenowy obiektu i utwórz rabat za długość pobytu.",
                "Zdefiniuj co najmniej jeden próg, na przykład od 7 nocy lub od 28 nocy, z odpowiednią stawką rabatu.",
                "Sprawdź, że progi się nie nakładają i że rabat obowiązuje dopiero od odpowiedniej minimalnej długości.",
                "Przetestuj w kalendarzu przykładową rezerwację przekraczającą próg rabatu, aby potwierdzić poprawne zastosowanie.",
                "Aktywuj rabat i obserwuj wpływ na średnią długość pobytu i obłożenie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Rabaty za długość pobytu można łączyć z regułami sezonowymi — plan cenowy oblicza oba dostosowania razem. Więcej na ten temat w artykule [Plany cenowe](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
