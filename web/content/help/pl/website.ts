import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Kreator strony internetowej",
  description: "Stwórz własną stronę rezerwacyjną za pomocą kreatora.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Kreator strony internetowej",
      articles: [
        {
          slug: "website-erstellen",
          title: "Tworzenie strony internetowej",
          excerpt: "Za pomocą kreatora w kilka minut utworzysz własną stronę rezerwacyjną.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Kreator strony internetowej tworzy dla Ciebie własną stronę rezerwacyjną — dodatkowy kanał sprzedaży obok portali i platformy myBestDays. Zachowujesz pełną kontrolę nad strukturą, treścią i brandingiem.",
            },
            { type: "h2", text: "Jak utworzyć stronę internetową" },
            {
              type: "steps",
              items: [
                "Otwórz w menu Strona internetowa.",
                "Kliknij Utwórz stronę internetową.",
                "Wybierz szablon jako punkt wyjścia dla swojego układu.",
                "Potwierdź przyciskiem Utwórz stronę — przejdziesz bezpośrednio do edytora.",
              ],
            },
            { type: "h2", text: "Co zawiera kreator" },
            {
              type: "ul",
              items: [
                "Wizualny edytor z widokiem stron, warstw i podglądu",
                "Gotowe bloki dla list obiektów, galerii i formularzy kontaktowych",
                "Bezpośrednią ścieżkę rezerwacji opartą na dostępności w Twoim kalendarzu",
                "Możliwość dostosowania kolorów, czcionek i logo do Twojej marki",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Zacznij od szablonu zbliżonego do rodzaju Twojego obiektu — obiekt wakacyjny lub hotel — to zaoszczędzi Ci czasu przy późniejszym dostosowywaniu bloków.",
            },
            { type: "h2", text: "Kolejne kroki" },
            {
              type: "p",
              text: "Po utworzeniu dostosuj strony i układ, zobacz [Edycja stron i układu](/hilfe/website/seiten-layout), oraz wyświetl swoje obiekty na stronie internetowej, zobacz [Wyświetlanie obiektów na stronie internetowej](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Edycja stron i układu",
          excerpt: "Dostosowywanie stron, warstw i bloków w edytorze wizualnym.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Edytor podzielony jest na trzy obszary: po lewej przegląd stron i warstw, na środku podgląd Twojej strony internetowej, po prawej ustawienia aktualnie wybranego bloku.",
            },
            { type: "h2", text: "Edycja strony" },
            {
              type: "steps",
              items: [
                "Po lewej stronie w sekcji Strony wybierz żądaną stronę.",
                "Kliknij w podglądzie na blok, aby go wybrać.",
                "Po prawej stronie dostosuj tekst, obraz lub odstęp bloku.",
                "Przeciągnij bloki metodą „przeciągnij i upuść”, aby zmienić ich kolejność.",
              ],
            },
            { type: "h2", text: "Dodawanie nowych stron i bloków" },
            {
              type: "p",
              text: "Za pomocą przycisku Dodaj stronę tworzysz kolejne podstrony, na przykład O nas lub Kontakt. Wewnątrz strony za pomocą Dodaj blok wstawiasz nowe sekcje, takie jak galeria, opinie lub formularz kontaktowy.",
            },
            {
              type: "ul",
              items: [
                "Strona główna, przegląd obiektów i kontakt są wstępnie ustawione w każdym szablonie",
                "Kolejne strony można dowolnie nazywać i dodawać do nawigacji",
                "Bloki są responsywne i dostosowują się do komputera, tabletu i smartfona",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zmiany w edytorze są początkowo tylko wersją roboczą. Dopiero kliknięcie Opublikuj przenosi je na Twoją publiczną stronę internetową.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Łączenie domeny",
          excerpt: "Połącz własną domenę ze swoją stroną myNextDays.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Domyślnie Twoja strona internetowa jest dostępna pod subdomeną myNextDays. Jeśli zamiast tego chcesz użyć własnej domeny, na przykład twoja-firma.pl, połącz ją w sekcji Domena.",
            },
            { type: "h2", text: "Zapisywanie domeny" },
            {
              type: "steps",
              items: [
                "Otwórz w stronie internetowej ustawienia, a tam sekcję Domena.",
                "Wpisz swoją własną domenę i kliknij Połącz.",
                "Utwórz u swojego dostawcy domeny wyświetlone wpisy DNS.",
                "Poczekaj na potwierdzenie — weryfikacja odbywa się automatycznie w tle.",
              ],
            },
            { type: "h2", text: "Poprawne ustawienie wpisów DNS" },
            {
              type: "p",
              text: "myNextDays pokazuje Ci dokładnie wymagane wpisy dla Twojego dostawcy domeny. Połączenie staje się aktywne dopiero, gdy te wpisy zostaną poprawnie ustawione i rozprzestrzenią się na całym świecie — w zależności od dostawcy może to potrwać kilka godzin.",
            },
            {
              type: "ul",
              items: [
                "Ustaw wpis CNAME lub A zgodnie z wyświetloną instrukcją",
                "Usuń wcześniej istniejące, sprzeczne wpisy dla tej samej domeny",
                "Certyfikat dla https jest wystawiany automatycznie po udanym połączeniu",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez poprawnie ustawionych wpisów DNS Twoja strona internetowa pod własną domeną pozostanie niedostępna — sprawdź dokładnie pisownię względem danych od swojego dostawcy.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Wyświetlanie obiektów na stronie internetowej",
          excerpt: "Które obiekty są widoczne i możliwe do zarezerwowania przez stronę internetową, ustalasz osobno dla każdego obiektu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Aby obiekt pojawił się na Twojej stronie internetowej, musi być dla niego włączona widoczność na stronie internetowej. Ten przełącznik jest niezależny od widoczności na platformie myBestDays lub na portalach.",
            },
            { type: "h2", text: "Udostępnianie obiektu na stronie internetowej" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w sekcji Obiekty.",
                "Przejdź do zakładki Widoczność.",
                "Aktywuj przełącznik Strona internetowa.",
                "Przejdź do strony internetowej i sprawdź blok Przegląd obiektów w podglądzie.",
              ],
            },
            { type: "h2", text: "Dostosowanie kolejności i wyglądu" },
            {
              type: "p",
              text: "W bloku Przegląd obiektów ustalasz, czy obiekty są sortowane automatycznie według dostępności, czy podajesz stałą kolejność. Każdy obiekt pokazuje zdjęcie tytułowe, cenę bazową w zapisanej walucie oraz najważniejsze cechy wyposażenia.",
            },
            {
              type: "ul",
              items: [
                "Automatyczne sortowanie według dostępności lub ręczna kolejność",
                "Opcjonalne filtry według rodzaju obiektu lub wyposażenia",
                "Kroki rezerwacji przebiegają bezpośrednio na stronie internetowej, bez pośrednictwa portalu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Obiekt bez aktywowanej widoczności na stronie internetowej pozostaje ukryty w przeglądzie obiektów, nawet jeśli jest widoczny na platformie lub w portalach.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Publikowanie strony internetowej",
          excerpt: "Wersje robocze stają się publicznie widoczne dopiero po kliknięciu Opublikuj.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Dopóki pracujesz w edytorze, tylko Ty widzisz aktualną wersję roboczą. Dopiero kliknięcie Opublikuj sprawia, że zmiany stają się widoczne dla wszystkich odwiedzających pod Twoją domeną.",
            },
            { type: "h2", text: "Jak opublikować" },
            {
              type: "steps",
              items: [
                "Otwórz w edytorze podgląd i sprawdź wszystkie strony.",
                "Kliknij w prawym górnym rogu Opublikuj.",
                "Potwierdź okno dialogowe — strona internetowa jest natychmiast potem aktywna.",
                "Otwórz swoją domenę w nowej karcie, aby sprawdzić rezultat.",
              ],
            },
            { type: "h2", text: "Wersje robocze i przywracanie" },
            {
              type: "p",
              text: "Dopóki jeszcze nie opublikowałeś, możesz w każdej chwili wrócić do ostatniej opublikowanej wersji, bez ostatecznej utraty wersji roboczej — skorzystaj w tym celu z opcji Odrzuć wersję roboczą w ustawieniach strony internetowej.",
            },
            {
              type: "ul",
              items: [
                "Opublikowane zmiany są od razu widoczne pod Twoją domeną",
                "Niepublikowana wersja robocza pozostaje wewnętrzna, dopóki jej nie potwierdzisz",
                "Każda publikacja jest odnotowywana z datą w historii",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Przed publikacją sprawdź w podglądzie widok mobilny — większość gości otwiera strony rezerwacyjne przez smartfon.",
            },
          ],
        },
      ],
    },
  ],
};
