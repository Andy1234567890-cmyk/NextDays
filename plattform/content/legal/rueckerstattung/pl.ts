import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zasady przekwaterowania i zwrotów",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsze zasady mają zastosowanie, gdy z zakwaterowaniem zarezerwowanym przez myBestDays jest coś zasadniczo nie tak — stanowią zatem zobowiązanie wykraczające poza warunek anulowania dostawcy.",
    "Dotyczą rezerwacji zawartych i opłaconych przez platformę.",
  ],
  sections: [
    {
      id: "wann",
      heading: "1. Kiedy niniejsze zasady mają zastosowanie",
      paragraphs: [
        "Mają zastosowanie, gdy przed pobytem lub w jego trakcie wystąpi jedno z następujących zdarzeń:",
      ],
      list: [
        "Dostawca anuluje rezerwację.",
        "Dostawca jest nieosiągalny przy przyjeździe albo nie otrzymują Państwo dostępu do zakwaterowania.",
        "Zakwaterowanie nie nadaje się do zamieszkania — np. z powodu braku ogrzewania przy chłodzie, braku bieżącej wody, niedostatecznej czystości lub zagrożenia dla zdrowia.",
        "Zakwaterowanie istotnie odbiega od ogłoszenia — inna liczba miejsc do spania lub pomieszczeń, inna lokalizacja, faktyczny brak przyrzeczonego w ogłoszeniu kluczowego wyposażenia.",
        "W zakwaterowaniu przebywa inny, niezapowiedziany gość.",
      ],
    },
    {
      id: "was-sie-tun",
      heading: "2. Co muszą zrobić Państwo",
      paragraphs: [
        "Prosimy zgłosić problem możliwie najwcześniej, najpóźniej jednak w ciągu 24 godzin od jego stwierdzenia — przy problemach w dniu przyjazdu zatem tego samego dnia.",
        "Prosimy zgłosić go najpierw dostawcy przez funkcję wiadomości i dać mu możliwość usunięcia. W razie zagrożenia dla Państwa zdrowia albo gdy dostawca jest nieosiągalny, obowiązek ten odpada.",
        "Prosimy w miarę możliwości udokumentować problem zdjęciami, nagraniami lub wiadomościami. Bez dowodów często nie możemy ustalić stanu faktycznego.",
      ],
    },
    {
      id: "was-wir-tun",
      heading: "3. Co robimy my",
      paragraphs: [
        "Jeżeli problem się potwierdzi, mają Państwo wybór między porównywalnym zakwaterowaniem zastępczym a zwrotem.",
        "Jeżeli wybiorą Państwo zakwaterowanie zastępcze, pokrywamy różnicę ceny w stosunku do pierwotnej rezerwacji, o ile zakwaterowanie zastępcze jest porównywalne pod względem położenia, wyposażenia i wielkości.",
        "Jeżeli wybiorą Państwo zwrot, przy problemie przed przyjazdem zwracamy pełną kwotę zapłaconą przez platformę. Jeżeli problem powstanie w trakcie pobytu, zwracamy część przypadającą na noce, z których nie można skorzystać, oraz stosowną kwotę za uciążliwość już spędzonych nocy.",
        "O naszej decyzji informujemy Państwa wraz z uzasadnieniem. Mogą Państwo poddać ją weryfikacji drogą wskazaną w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "4. Czego nie obejmują",
      paragraphs: ["Niniejsze zasady nie mają zastosowania przy:"],
      list: [
        "okolicznościach opisanych w ogłoszeniu lub widocznych na zdjęciach;",
        "nieznacznych odstępstwach niewpływających na korzystanie (np. inny kolor ścian lub inna sofa);",
        "przejściowych usterkach usuwanych przez dostawcę w rozsądnym terminie;",
        "okolicznościach poza zakwaterowaniem, na które dostawca nie ma wpływu — pogoda, ruch drogowy, gminne place budowy, zamknięcie atrakcji (w tym zakresie obowiązują [Zasady przy poważnych zakłóceniach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen));",
        "problemach spowodowanych przez Państwa lub współpodróżnych;",
        "rezerwacjach zawartych lub opłaconych poza platformą.",
      ],
    },
    {
      id: "verhaeltnis",
      heading: "5. Stosunek do Państwa praw ustawowych",
      paragraphs: [
        "Niniejsze zasady stanowią dobrowolne zobowiązanie myBestDays. Państwa roszczenia ustawowe wobec dostawcy — w szczególności obniżenie ceny i odszkodowanie — pozostają nienaruszone i mogą sięgać dalej.",
        "W zakresie, w jakim dokonujemy zwrotu, odpowiednie roszczenia wobec dostawcy przechodzą na nas.",
      ],
    },
  ],
};
