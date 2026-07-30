import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Rozliczenia właścicieli",
  description: "Twórz rozliczenia dla właścicieli.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Rozliczenia właścicieli",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Tworzenie zestawienia dla właściciela",
          excerpt: "Jak utworzyć dla właściciela przejrzyste rozliczenie za jego okres.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Jeśli zarządzasz obiektami dla właścicieli, potrzebują oni regularnie zrozumiałego przeglądu przychodów, odliczonej prowizji i wypłaty dla swoich obiektów za określony okres — zestawienie dla właściciela automatycznie łączy te dane.",
            },
            {
              type: "steps",
              items: [
                "Otwórz w Koncie sekcję Właściciele i wybierz dotkniętego właściciela.",
                "Wybierz okres rozliczeniowy, dla którego ma zostać utworzone zestawienie.",
                "Sprawdź, czy wszystkie obiekty tego właściciela są poprawnie przypisane, ponieważ tylko przypisane obiekty trafiają do zestawienia.",
                "Utwórz zestawienie i skontroluj kompletność wymienionych rezerwacji.",
                "Udostępnij zestawienie właścicielowi przez dostęp dla właściciela lub wyeksportuj je jako dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zestawienie pokazuje każdą rezerwację z kwotą w odpowiedniej walucie obiektu — nie ma żadnej ogólnej wzmianki o walucie, ponieważ kilka obiektów może prowadzić także różne waluty. Więcej o przypisywaniu w artykule [Przypisywanie obiektu do właściciela](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Rozliczanie prowizji z właścicielem",
          excerpt: "Jak zapewnić, że Twoja prowizja jest poprawnie obliczana z przychodów właściciela.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Twoja prowizja za zarządzanie obiektem jest zapisana w taryfie właściciela i przy każdym zestawieniu jest automatycznie odliczana od przychodów brutto. Aby rozliczenie się zgadzało, stawka prowizji musi być poprawnie ustawiona przed pierwszą rezerwacją w danym okresie.",
            },
            {
              type: "steps",
              items: [
                "Otwórz w Koncie taryfę dotkniętego właściciela i sprawdź zapisaną stawkę prowizji.",
                "W razie potrzeby dostosuj stawkę, zanim wpłyną nowe rezerwacje w nadchodzącym okresie rozliczeniowym.",
                "Utwórz zestawienie dla właściciela za dany okres i sprawdź, czy prowizja jest poprawnie wykazana dla każdej rezerwacji.",
                "Skontroluj wiarygodność sumy przychodów brutto, odliczonej prowizji i wypłaty netto.",
                "Rozbieżności wyjaśnij bezpośrednio z właścicielem przed zatwierdzeniem zestawienia, zamiast zmieniać zestawienie w późniejszym terminie.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Późniejsza zmiana stawki prowizji działa tylko na przyszłe okresy, nie wstecz na już utworzone zestawienia. Sprawdź więc stawkę odpowiednio wcześnie przed rozpoczęciem nowego okresu rozliczeniowego — zobacz również [Rozliczenie właściciela (zestawienie)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
