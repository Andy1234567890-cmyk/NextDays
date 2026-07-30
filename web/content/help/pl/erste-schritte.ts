import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Pierwsze kroki",
  description: "Skonfiguruj konto i zacznij działać w kilka minut.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Konfiguracja",
      articles: [
        {
          slug: "willkommen",
          title: "Witamy w myNextDays",
          excerpt: "Przegląd systemu PMS, menedżera kanałów, platformy i aplikacji.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays to Twoja centralna platforma do zarządzania obiektami wakacyjnymi i hotelami. Zamiast wielu odrębnych narzędzi zarządzasz dostępnością, cenami, rezerwacjami i komunikacją z gośćmi w jednym miejscu — niezależnie od tego, czy prowadzisz pojedynczy dom wakacyjny, czy kilka pokoi hotelowych.",
            },
            { type: "h2", text: "Cztery elementy składowe" },
            {
              type: "ul",
              items: [
                "PMS (system zarządzania obiektem): obiekty, kalendarz, ceny, rezerwacje, zadania i płatności.",
                "Menedżer kanałów: połączenie z portalami takimi jak Booking, Airbnb i inne — jedno wprowadzenie danych, wiele portali zsynchronizowanych.",
                "Platforma myNextDays: własny rynek myNextDays, równorzędny kanał rezerwacji obok portali.",
                "Aplikacja: aplikacja mobilna dla gości, właścicieli i pracowników z tymi samymi danymi co w wersji webowej.",
              ],
            },
            { type: "h2", text: "Jak elementy współdziałają" },
            {
              type: "p",
              text: "Obiekt, ceny i dostępność uzupełniasz raz, centralnie w systemie PMS. Stamtąd myNextDays automatycznie rozprowadza dane do wszystkich aktywnych kanałów. Rezerwacja — niezależnie od kanału, z którego pochodzi — natychmiast blokuje odpowiednie noce wszędzie, dzięki czemu podwójne rezerwacje są wykluczone.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Zacznij od konfiguracji konta i danych firmy, a następnie dodaj pierwszy obiekt — taka kolejność oszczędzi Ci później poprawek.",
            },
            { type: "h2", text: "Kolejne kroki" },
            {
              type: "steps",
              items: [
                "Otwórz w menu Konto i uzupełnij dane swojej firmy.",
                "W sekcji Obiekty dodaj swój pierwszy obiekt.",
                "Sprawdź kompletność wyposażenia, zdjęć i cen.",
                "Kliknij Opublikuj, aby udostępnić obiekt na wszystkich kanałach.",
              ],
            },
            {
              type: "p",
              text: "Więcej o poszczególnych krokach znajdziesz w artykułach [Konfiguracja konta i firmy](/hilfe/erste-schritte/konto-einrichten) oraz [Dodawanie pierwszego obiektu](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Konfiguracja konta i firmy",
          excerpt: "Poprawne wprowadzenie danych podstawowych, adresu do faktur i waluty.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Zanim dodasz obiekty, skonfiguruj swoją firmę w ustawieniach konta. Te dane są potrzebne do faktur, portali i rozliczeń z myNextDays, dlatego powinny być kompletne i poprawne.",
            },
            { type: "h2", text: "Wprowadzanie danych podstawowych" },
            {
              type: "steps",
              items: [
                "Otwórz w menu Konto.",
                "W sekcji Dane podstawowe wpisz nazwę firmy lub imię i nazwisko jednoosobowej działalności, adres i dane kontaktowe.",
                "Uzupełnij adres do faktur — pojawi się on na wszystkich wystawianych fakturach.",
                "Wybierz swoją walutę bazową. Obowiązuje ona dla wszystkich cen, dopóki nie zmienisz jej celowo dla danego obiektu.",
              ],
            },
            { type: "h2", text: "Dlaczego waluta jest ważna" },
            {
              type: "p",
              text: "Waluta nie jest zgadywana ani uzupełniana automatycznie: jeśli jej brakuje, żadna cena nie może zostać poprawnie wyświetlona ani rozliczona. Dlatego myNextDays wymaga świadomego wyboru podczas konfiguracji, zamiast wstawiać wartość domyślną.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jeśli zmienisz walutę obiektu w późniejszym czasie, wszystkie powiązane z nim plany cenowe zostaną przestawione. Po zmianie sprawdź jeszcze raz ceny.",
            },
            { type: "h2", text: "Adres do faktur i rozliczenia" },
            {
              type: "p",
              text: "W sekcji Rozliczenia w Koncie znajdziesz bieżące faktury oraz zapisany adres do faktur. Utrzymuj go aktualnym, zwłaszcza przy zmianie formy prawnej lub adresu, aby faktury były wystawiane poprawnie.",
            },
            {
              type: "ul",
              items: [
                "Nazwa firmy lub imię i nazwisko jednoosobowej działalności",
                "Adres do faktur wraz z krajem",
                "Numer NIP lub numer VAT UE, jeśli dotyczy",
                "Waluta bazowa dla nowych obiektów",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Dodawanie pierwszego obiektu",
          excerpt: "Krok po kroku: jak dodać pierwszy obiekt do rezerwacji.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Obiekt w myNextDays to zawsze dokładnie jedna jednostka do rezerwacji: albo pojedynczy pokój w hotelu, albo cały obiekt wakacyjny. Jeśli prowadzisz hotel z kilkoma pokojami, dodaj osobny obiekt dla każdego pokoju.",
            },
            { type: "h2", text: "Dodawanie obiektu" },
            {
              type: "steps",
              items: [
                "Otwórz w menu Obiekty.",
                "Kliknij Dodaj obiekt.",
                "Wybierz rodzaj obiektu: kategorię, typ nieruchomości i rodzaj oferty.",
                "Uzupełnij adres, obłożenie i cenę bazową w zapisanej walucie.",
                "Zapisz obiekt jako wersję roboczą, aby uzupełnić go później.",
              ],
            },
            { type: "h2", text: "Czego jeszcze brakuje potem" },
            {
              type: "p",
              text: "Nowo dodany obiekt jest początkowo wersją roboczą i nie jest widoczny na żadnym kanale. Uzupełnij wyposażenie, zdjęcia, opis i dostępność w kalendarzu przed publikacją — tylko kompletny obiekt można wiarygodnie sprzedawać.",
            },
            {
              type: "ul",
              items: [
                "Wybierz cechy wyposażenia z listy kategorii",
                "Dodaj co najmniej jedno zdjęcie tytułowe i opis",
                "Wpisz poprawne obłożenie (dorośli, dzieci, łóżka)",
                "Sprawdź cenę bazową i dostępność w kalendarzu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jeśli prowadzisz kilka typów pokoi, powtórz ten proces dla każdego pokoju osobno — nie ma nadrzędnego poziomu budynku z pokojami pod nim.",
            },
            {
              type: "p",
              text: "Gdy wszystkie wymagane pola są wypełnione, możesz opublikować obiekt — zobacz [Publikowanie obiektu](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Publikowanie obiektu",
          excerpt: "Jedno kliknięcie włącza jednocześnie platformę myNextDays, portale i stronę internetową.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Publikacja sprawia, że obiekt jest widoczny i możliwy do zarezerwowania. Zwykle wystarczy jedno kliknięcie, aby aktywować wszystkie trzy kanały sprzedaży jednocześnie — widoczność dla każdego kanału możesz jednak w każdej chwili dostosować osobno.",
            },
            { type: "h2", text: "Jak opublikować" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w sekcji Obiekty.",
                "Sprawdź w zakładce Przegląd, czy wszystkie wymagane dane są oznaczone na zielono.",
                "Kliknij Opublikuj.",
                "Potwierdź okno dialogowe — platforma myNextDays, portale i strona internetowa zostaną aktywowane.",
              ],
            },
            { type: "h2", text: "Sterowanie kanałami osobno" },
            {
              type: "p",
              text: "Po publikacji w zakładce Widoczność znajdziesz trzy osobne przełączniki: Strona internetowa, Platforma myNextDays i Portale. Jeśli chcesz oferować obiekt na przykład tylko na własnej stronie internetowej, ale nie przez portale, po prostu wyłącz odpowiedni przełącznik.",
            },
            {
              type: "ul",
              items: [
                "Strona internetowa: widoczność na Twojej własnej stronie myNextDays",
                "Platforma myNextDays: widoczność na globalnej platformie myNextDays",
                "Portale: widoczność na Booking, Airbnb i innych",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Te trzy przełączniki są niezależne od statusu obiektu (aktywny/nieaktywny). Aktywny obiekt może mimo to być niewidoczny na pojedynczych kanałach.",
            },
            { type: "h2", text: "Tymczasowe blokowanie obiektu" },
            {
              type: "p",
              text: "Jeśli chcesz zablokować pojedynczy dzień zamiast całego obiektu, użyj funkcji Stop sprzedaży w kalendarzu — blokuje ona dzień na wszystkich kanałach jednocześnie, niezależnie od przełączników widoczności.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Trzy kanały sprzedaży w skrócie",
          excerpt: "Portale, platforma myNextDays i aplikacja w skrócie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays sprzedaje każdy obiekt jednocześnie przez kilka równorzędnych kanałów. Zrozumienie, jak one współdziałają, pomaga Ci celowo sterować widocznością i cenami.",
            },
            { type: "h2", text: "Portale" },
            {
              type: "p",
              text: "Za pomocą menedżera kanałów łączysz swój obiekt z dużymi portalami rezerwacyjnymi, takimi jak Booking, Airbnb i inne. Dostępność i ceny są synchronizowane automatycznie, więc nie musisz ręcznie prowadzić wielu kalendarzy portali.",
            },
            { type: "h2", text: "Platforma myNextDays" },
            {
              type: "p",
              text: "Platforma myNextDays to własny, globalny kanał rezerwacji — porównywalny z Booking czy Airbnb, ale będący częścią tej samej platformy. Nie jest to zamiennik „rezerwacji bezpośredniej”, lecz równorzędny kanał z własną osią widoczności.",
            },
            { type: "h2", text: "Aplikacja" },
            {
              type: "p",
              text: "Aplikacja mobilna daje gościom, właścicielom i pracownikom dostęp do tych samych danych co wersja webowa — na przykład szczegółów rezerwacji, wiadomości lub zadań, w zależności od danej roli.",
            },
            { type: "h2", text: "Trzy osobne osie widoczności" },
            {
              type: "ul",
              items: [
                "Strona internetowa — Twoja własna strona myNextDays",
                "Platforma myNextDays — globalna platforma myNextDays",
                "Portale — Booking, Airbnb i inne poprzez menedżera kanałów",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Wszystkie trzy osie można włączać niezależnie od siebie. Stop sprzedaży oraz status obiektu działają natomiast na wszystkie trzy jednocześnie, niezależnie od kanału.",
            },
          ],
        },
      ],
    },
  ],
};
