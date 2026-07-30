import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Aplikacja mobilna",
  description: "Aplikacja myNextDays na wyjazdy i w podróży.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Aplikacja",
      articles: [
        {
          slug: "die-app",
          title: "Aplikacja myNextDays",
          excerpt: "Jedno konto, cztery doświadczenia: gość, agencja, właściciel i pracownik.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Aplikacja myNextDays to mobilna platforma dla całej Twojej działalności. Nie jest osobnym produktem, lecz równorzędnym frontendem Twojego panelu webowego — oba korzystają z tego samego konta i tych samych danych, jedynie interfejs jest zoptymalizowany pod urządzenia mobilne.",
            },
            { type: "h2", text: "Cztery doświadczenia w jednej aplikacji" },
            {
              type: "ul",
              items: [
                "Gość: przeglądanie rezerwacji, komunikacja z firmą, pobieranie informacji o zameldowaniu.",
                "Agencja: zarządzanie wieloma firmami i obiektami w jednym przeglądzie.",
                "Właściciel: wgląd tylko do odczytu we własne obiekty, obłożenie i raporty.",
                "Pracownik: kalendarz, zadania i plany sprzątania na potrzeby codziennej pracy.",
              ],
            },
            { type: "h2", text: "Które doświadczenie widzisz" },
            {
              type: "p",
              text: "Po zalogowaniu aplikacja automatycznie pokazuje odpowiednie doświadczenie dla Twojej roli — tej samej roli, która obowiązuje w panelu webowym. Pracownik z ograniczonymi uprawnieniami widzi w aplikacji dokładnie te same ograniczenia co w przeglądarce, ponieważ uprawnienie jest sprawdzane po stronie serwera.",
            },
            {
              type: "note",
              variant: "info",
              text: "Więcej o rolach i o tym, co każda z nich może widzieć, znajdziesz w artykule [Role i uprawnienia](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nie potrzebujesz osobnej rejestracji dla aplikacji — po prostu zaloguj się swoimi istniejącymi danymi dostępowymi myNextDays.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Instalacja aplikacji i logowanie",
          excerpt: "Jak pobrać aplikację myNextDays i się zalogować.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Aplikacja myNextDays jest dostępna dla iOS i Android. Logowanie odbywa się tymi samymi danymi dostępowymi co w panelu webowym — nie jest potrzebne osobne konto ani ponowna rejestracja.",
            },
            { type: "h2", text: "Instalacja" },
            {
              type: "steps",
              items: [
                "Otwórz App Store (iOS) lub Google Play (Android).",
                "Wyszukaj „myNextDays”.",
                "Zainstaluj aplikację na swoim smartfonie lub tablecie.",
                "Otwórz aplikację po instalacji.",
              ],
            },
            { type: "h2", text: "Logowanie" },
            {
              type: "steps",
              items: [
                "Dotknij „Zaloguj się”.",
                "Wprowadź swój adres e-mail i hasło.",
                "W razie potrzeby potwierdź zapytanie o weryfikację dwuetapową.",
                "Zostaniesz automatycznie przeniesiony do doświadczenia odpowiedniego dla Twojej roli.",
              ],
            },
            {
              type: "ul",
              items: [
                "Dane dostępowe są identyczne z panelem webowym.",
                "Jeśli Twój dostęp zostanie odebrany, logowanie w aplikacji jest natychmiast zablokowane.",
                "Przy problemach z hasłem skorzystaj z „Nie pamiętam hasła” bezpośrednio w aplikacji.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Loguj się wyłącznie przez oficjalny wpis „myNextDays” w sklepie z aplikacjami; aplikacja nigdy nie prosi o dane dostępowe poza ekranem logowania.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Zarządzanie w podróży",
          excerpt: "Obsługuj rezerwacje, wiadomości i zadania bezpośrednio ze smartfona.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Aplikacja myNextDays nadaje się szczególnie do bieżącego prowadzenia działalności w podróży: widzisz aktualne rezerwacje, odpowiadasz na wiadomości gości i realizujesz zadania bez konieczności siedzenia przy komputerze — zmiany pojawiają się w czasie rzeczywistym również w panelu webowym.",
            },
            { type: "h2", text: "Rezerwacje pod kontrolą" },
            {
              type: "p",
              text: "W sekcji „Rezerwacje” widzisz przyjazdy i wyjazdy, obłożenie i status dla każdego obiektu. Pracownik i Sprzątanie widzą przy tym tylko istotne dla nich informacje, bez cen czy szczegółów sprzedażowych.",
            },
            { type: "h2", text: "Wiadomości i zadania" },
            {
              type: "steps",
              items: [
                "Otwórz sekcję „Wiadomości”, aby bezpośrednio odpowiadać na zapytania gości.",
                "Przejdź do „Zadania”, aby zobaczyć przydzielone Ci sprawy do zrobienia.",
                "Dotknij zadanie, aby otworzyć szczegóły i je zakończyć.",
                "Oznaczaj wykonane terminy sprzątania jako zakończone bezpośrednio na miejscu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nowe wiadomości i zadania pojawiają się na żywo, bez ręcznego odświeżania.",
                "Zakończone zadania są od razu widoczne również w panelu webowym.",
                "Właściciele widzą rezerwacje i raporty swoich obiektów, ale wyłącznie do odczytu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Powiadomienia push informują Cię o nowych wiadomościach i przydzielonych zadaniach, gdy tylko zezwolisz na nie w ustawieniach urządzenia.",
            },
          ],
        },
      ],
    },
  ],
};
