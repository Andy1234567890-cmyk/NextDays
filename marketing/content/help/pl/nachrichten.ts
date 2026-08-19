import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Wiadomości i goście",
  description: "Skrzynka odbiorcza, szablony i komunikacja z gośćmi.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Komunikacja",
      articles: [
        {
          slug: "posteingang",
          title: "Skrzynka odbiorcza platformy",
          excerpt: "Wszystkie wiadomości gości z Twoich obiektów gromadzą się centralnie w skrzynce odbiorczej platformy.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Jedna skrzynka odbiorcza dla wszystkich obiektów" },
            {
              type: "p",
              text: "Skrzynka odbiorcza platformy zbiera wszystkie wiadomości od Twoich gości w jednym miejscu — niezależnie od tego, przez który obiekt lub okres przebiega konwersacja. Otwierasz ją w /nachrichten i widzisz tam każdą rozmowę jako osobny wątek.",
            },
            { type: "h2", text: "Budowa skrzynki odbiorczej" },
            {
              type: "ul",
              items: [
                "Lewa kolumna: lista wszystkich konwersacji, najnowsze na górze",
                "Środkowa kolumna: aktywna historia wiadomości z gościem",
                "Prawa kolumna: kontekst rezerwacji — okres, obiekt, dane gościa",
              ],
            },
            { type: "h2", text: "Odpowiadanie na wiadomość" },
            {
              type: "steps",
              items: [
                "Otwórz /nachrichten i wybierz żądaną konwersację.",
                "Napisz odpowiedź w polu tekstowym lub skorzystaj z szybkiej odpowiedzi.",
                "Wyślij wiadomość — gość otrzyma ją tą samą drogą, którą napisał.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Skrzynka odbiorcza platformy pokazuje wyłącznie bezpośrednią komunikację między Tobą a Twoimi gośćmi w myNextDays — wiadomości z portali nadal obsługujesz tam.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Szybkie odpowiedzi",
          excerpt: "Szablony dla częstych pytań oszczędzają czas w kontakcie z gośćmi.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Czym są szybkie odpowiedzi" },
            {
              type: "p",
              text: "Szybkie odpowiedzi to wcześniej sformułowane bloki tekstu dla powtarzających się pytań — na przykład dotyczących przyjazdu, hasła Wi-Fi lub sytuacji parkingowej. Zamiast pisać każdą odpowiedź od nowa, wstawiasz odpowiedni szablon jednym kliknięciem w [skrzynce odbiorczej platformy](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Tworzenie szybkiej odpowiedzi" },
            {
              type: "steps",
              items: [
                "Otwórz /nachrichten i kliknij „Zarządzaj szybkimi odpowiedziami”.",
                "Kliknij „Nowy szablon” i nadaj tytuł, na przykład „Informacje o zameldowaniu”.",
                "Napisz treść odpowiedzi; symbole zastępcze, takie jak imię gościa czy data przyjazdu, są automatycznie wstawiane przy wysyłaniu.",
                "Zapisz szablon — jest on od razu dostępny w każdej konwersacji.",
              ],
            },
            { type: "h2", text: "Korzystanie z szybkich odpowiedzi na co dzień" },
            {
              type: "p",
              text: "W oknie wiadomości otwierasz listę szablonów przez ikonę błyskawicy, wybierasz odpowiednią odpowiedź i w razie potrzeby dostosowujesz ją indywidualnie przed wysłaniem.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Utwórz szablony dla pięciu do dziesięciu najczęstszych pytań — w praktyce pokrywa to większość przychodzących wiadomości.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatyczne wiadomości",
          excerpt: "Potwierdzenia, informacje o zameldowaniu i przypomnienia można wysyłać do gości automatycznie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Automatyzacja powtarzających się wiadomości" },
            {
              type: "p",
              text: "Zamiast ręcznie wysyłać potwierdzenia rezerwacji, informacje o zameldowaniu czy wiadomości z podziękowaniem, zapisujesz je raz jako regułę — myNextDays wysyła je wtedy automatycznie w odpowiednim momencie przed, w trakcie lub po pobycie.",
            },
            { type: "h2", text: "Typowe wyzwalacze automatycznych wiadomości" },
            {
              type: "ul",
              items: [
                "Bezpośrednio po rezerwacji — potwierdzenie z najważniejszymi danymi",
                "Kilka dni przed przyjazdem — informacje o zameldowaniu i kod dostępu",
                "W dniu wyjazdu — podziękowanie i prośba o opinię",
              ],
            },
            { type: "h2", text: "Konfiguracja automatycznej wiadomości" },
            {
              type: "steps",
              items: [
                "Otwórz /nachrichten, sekcja „Automatyczne wiadomości”.",
                "Wybierz wyzwalacz, na przykład „X dni przed przyjazdem”.",
                "Wprowadź tekst — symbole zastępcze, takie jak imię gościa, obiekt czy data przyjazdu, są wypełniane automatycznie.",
                "Aktywuj regułę; obowiązuje ona dla wszystkich obiektów, o ile nie ograniczono jej inaczej.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatyczne wiadomości pojawiają się normalnie w [skrzynce odbiorczej platformy](/hilfe/nachrichten/posteingang) i można je tam w każdej chwili później przejrzeć.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blokowanie wiadomości",
          excerpt: "Możesz zablokować osobę bezpośrednio z historii wiadomości, uniemożliwiając jej dalszy kontakt.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Kiedy blokada ma sens" },
            {
              type: "p",
              text: "W przypadku obraźliwych wiadomości, nękania lub wielokrotnie niewłaściwego zachowania możesz zablokować osobę bezpośrednio z wątku wiadomości. Zablokowana osoba nie może już wtedy pisać do Ciebie nowych wiadomości ani tworzyć u Ciebie nowej rezerwacji.",
            },
            { type: "h2", text: "Blokowanie osoby z wątku" },
            {
              type: "steps",
              items: [
                "Otwórz dotkniętą konwersację w [skrzynce odbiorczej platformy](/hilfe/nachrichten/posteingang).",
                "Kliknij u góry wątku menu i wybierz „Zablokuj osobę”.",
                "Potwierdź proces — blokada obowiązuje natychmiast.",
              ],
            },
            { type: "h2", text: "Co oznacza blokada — a czego nie" },
            {
              type: "ul",
              items: [
                "Nowe wiadomości od zablokowanej osoby nie są już dostarczane",
                "Nowe zapytania o rezerwację od tej osoby są odrzucane",
                "Jeśli aktualnie trwa rezerwacja tej osoby, komunikacja pozostaje wyjątkowo możliwa na czas trwania pobytu",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokadę można w każdej chwili ponownie znieść w przeglądzie „Zablokowane osoby” w Koncie. Przed zablokowaniem sprawdź, czy nie istnieje już trwająca rezerwacja.",
            },
          ],
        },
      ],
    },
  ],
};
