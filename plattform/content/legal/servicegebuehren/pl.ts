import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Opłaty serwisowe",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "myBestDays finansuje się z opłaty serwisowej od pośredniczonych rezerwacji. Niniejsza strona wyjaśnia, kto ją płaci, jak jest naliczana i gdzie jest wskazana.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kto płaci opłatę serwisową",
      paragraphs: [
        "Opłatę serwisową ponosi dostawca. Jest potrącana z wartości rezerwacji i zmniejsza wypłatę na jego rzecz; gość nie płaci jej dodatkowo.",
        "Jeżeli wyjątkowo dla danej rezerwacji naliczana jest opłata serwisowa po stronie gościa, wskazujemy ją jako odrębną pozycję ceny całkowitej przed finalizacją rezerwacji. Bez takiego wskazania gość nie ponosi żadnej opłaty.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Jak jest naliczana",
      paragraphs: [
        "Opłata serwisowa stanowi procent wartości rezerwacji rozliczanej przez platformę. Stawka obowiązująca dla Państwa rezerwacji znajduje się na koncie gospodarza oraz w umowie zaakceptowanej przy rejestracji.",
        "Podstawą naliczania jest cena noclegu powiększona o dopłaty rozliczane przez platformę. Nie wlicza się pozycji przechodnich, które nie stanowią świadczenia dostawcy — w szczególności opłaty miejscowej i kaucji.",
        "Opłata serwisowa jest naliczana i wskazywana w walucie ogłoszenia.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. VAT",
      paragraphs: [
        "Od opłaty serwisowej naliczany jest VAT w zakresie, w jakim jest należny zgodnie z prawem. To, czy jest wykazywany, czy stosuje się mechanizm odwrotnego obciążenia, zależy od siedziby i statusu dostawcy.",
        "Za opłatę serwisową wystawiamy dostawcy rozliczenie dostępne na jego koncie.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Anulowanie i zwrot",
      paragraphs: [
        "Jeżeli rezerwacja zostaje w całości zwrócona, zwracamy opłatę serwisową proporcjonalnie do zwróconej wartości rezerwacji.",
        "Jeżeli dostawca anuluje bez ważnego powodu, opłata serwisowa nie odpada automatycznie; zastrzegamy sobie dochodzenie kosztów powstałych wskutek anulowania.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Zmiana opłaty serwisowej",
      paragraphs: [
        "Zmianę stawki zapowiadamy dostawcom co najmniej 30 dni przed jej wejściem w życie na trwałym nośniku; odpowiada to art. 3 ust. 2 rozporządzenia (UE) 2019/1150.",
        "Do już potwierdzonych rezerwacji stosuje się stawkę obowiązującą w chwili rezerwacji.",
      ],
    },
  ],
};
