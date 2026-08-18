import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Najem krótkoterminowy i obowiązki rejestracyjne",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "W wielu miastach i regionach krótkoterminowy najem lokali mieszkalnych wymaga zezwolenia, rejestracji lub zgłoszenia. Niniejsza strona wyjaśnia, co to oznacza dla dostawców i dla gości.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Ramy prawne",
      paragraphs: [
        "Rozporządzenie (UE) 2024/1028 w sprawie gromadzenia i wymiany danych dotyczących usług krótkoterminowego najmu zakwaterowania tworzy jednolite ramy: tam, gdzie państwo członkowskie lub jednostka lokalna wprowadziły procedurę rejestracji, każda jednostka otrzymuje numer rejestracyjny.",
        "Platformy muszą prezentować ten numer, wyrywkowo weryfikować jego ważność i w regularnych odstępach przekazywać właściwym organom dane o działalności.",
        "Poza tym nadal obowiązują przepisy krajowe i lokalne — na przykład o zmianie przeznaczenia lokali mieszkalnych, maksymalnej liczbie dni najmu, ochronie przeciwpożarowej i meldunku gości.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Co muszą zrobić dostawcy",
      paragraphs: [
        "Przed publikacją prosimy sprawdzić, czy dla Państwa zakwaterowania istnieje obowiązek rejestracji, zezwolenia lub zgłoszenia, i go dopełnić.",
        "Numer rejestracyjny, jeżeli istnieje, prosimy wpisać w obiekcie. Prezentujemy go w ogłoszeniu.",
        "Prosimy przestrzegać maksymalnej liczby dni najmu i innych ograniczeń lokalnych. Ich nadzorowanie jest Państwa zadaniem, nie naszym.",
        "Nie możemy trwale prezentować ogłoszenia bez wymaganego numeru rejestracyjnego. Jeżeli go brakuje lub okaże się nieważny, monitujemy o niego; w razie braku informacji dezaktywujemy ogłoszenie.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Co to oznacza dla gości",
      paragraphs: [
        "Jeżeli dla zakwaterowania istnieje obowiązek rejestracji, zobaczą Państwo numer rejestracyjny w ogłoszeniu. Wskazuje on, że najem zgłoszono właściwemu organowi.",
        "W miejscu docelowym może być wymagany meldunek (karta meldunkowa, dane dokumentu tożsamości, deklaracja opłaty miejscowej). Dostawca poprosi o niezbędne dane; prosimy przekazać je w odpowiednim czasie.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Przekazywanie danych organom",
      paragraphs: [
        "W zakresie, w jakim przewiduje to rozporządzenie (UE) 2024/1028 lub prawo krajowe, przekazujemy właściwym organom dane o działalności najmu — w szczególności numer rejestracyjny, adres jednostki, liczbę zajętych nocy i liczbę gości.",
        "Przekazanie następuje w celu wypełnienia obowiązku prawnego zgodnie z art. 6 ust. 1 lit. c) rozporządzenia (UE) 2016/679. Szczegóły zawiera [Polityka prywatności](https://mybestdays.dk/rechtliches/datenschutz).",
        "Odrębnie od tego istnieje obowiązek raportowania podatkowego zgodnie z DAC7; zob. [Politykę podatkową](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Zgłaszanie naruszeń",
      paragraphs: [
        "Jeżeli mają Państwo przesłanki, że zakwaterowanie oferowane jest bez wymaganego zezwolenia lub rejestracji, prosimy zgłosić to przez funkcję zgłaszania przy ogłoszeniu. Rozpatrujemy każde zgłoszenie.",
      ],
    },
  ],
};
