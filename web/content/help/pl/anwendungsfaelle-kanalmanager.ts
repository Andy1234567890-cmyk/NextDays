import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Menedżer kanałów",
  description: "Opanuj portale i menedżera kanałów.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Menedżer kanałów",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Łączenie pierwszego portalu",
          excerpt: "Jak po raz pierwszy uruchomić portal dla obiektu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: masz utworzony obiekt, ale jeszcze żaden portal nie jest połączony",
            },
            {
              type: "p",
              text: "Twój obiekt jest w pełni skonfigurowany w myNextDays, ale nie jest jeszcze widoczny na żadnym portalu, takim jak Booking.com czy Airbnb. Zanim portal przyjmie obiekt, Twoje konto potrzebuje jednorazowo połączenia z portalami dla całego konta — potem dla każdego kolejnego obiektu wystarczy już tylko mapowanie.",
            },
            {
              type: "steps",
              items: [
                "Otwórz /konto, sekcja „Portale i menedżer kanałów”, i skonfiguruj połączenie dla całego konta wraz z danymi swojej firmy.",
                "Następnie otwórz obiekt w /objekte i przejdź do zakładki „Portale”.",
                "Wybierz żądany portal i przypisz go do odpowiedniego typu pokoju lub oferty.",
                "Sprawdź zdjęcia, wyposażenie, ceny i warunki anulowania — portale wymagają kompletnych danych.",
                "Aktywuj widoczność; status zmieni się na „Połączono” po weryfikacji przez portal.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Połączenie dla całego konta konfigurujesz tylko raz. Szczegóły w artykułach [Łączenie z Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) i [Łączenie z Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Łączenie z Booking.com",
          excerpt: "Jak uczynić obiekt możliwym do zarezerwowania na Booking.com przez menedżera kanałów.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: Twój obiekt ma dodatkowo stać się widoczny na Booking.com",
            },
            {
              type: "p",
              text: "Booking.com to jeden z portali podłączanych przez menedżera kanałów. Warunkiem jest połączenie z portalami dla całego konta — jeśli jest już skonfigurowane, dla Booking.com potrzebujesz już tylko mapowania dla każdego obiektu.",
            },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte, zakładka „Portale”.",
                "Wybierz „Booking.com” z listy dostępnych portali.",
                "Przypisz odpowiedni typ pokoju lub oferty i potwierdź co najmniej jedną stawkę z ceną i warunkami anulowania.",
                "Wprowadź ważną metodę płatności do rozliczania prowizji.",
                "Aktywuj widoczność dla Booking.com.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Weryfikacja przez Booking.com może potrwać kilka godzin. Status w zakładce „Portale” pokazuje, gdy tylko połączenie stanie się aktywne.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Łączenie z Airbnb",
          excerpt: "Jak uczynić obiekt możliwym do zarezerwowania na Airbnb przez menedżera kanałów.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: Twój obiekt ma dodatkowo stać się widoczny na Airbnb",
            },
            {
              type: "p",
              text: "Airbnb, tak jak każdy inny portal, jest podłączany przez połączenie dla całego konta. Gdy jest ono skonfigurowane, aktywujesz Airbnb dla każdego obiektu przez mapowanie — niezależnie od tego, czy obiekt jest już widoczny na Booking.com lub innych portalach.",
            },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte, zakładka „Portale”.",
                "Wybierz „Airbnb” z listy dostępnych portali.",
                "Potwierdź kategorię obiektu i przypisany typ oferty.",
                "Uzupełnij zdjęcia, wyposażenie i regulamin domu — Airbnb wymaga kompletnych danych przed uruchomieniem.",
                "Aktywuj widoczność dla Airbnb.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez zapisanych warunków anulowania i regulaminu domu Airbnb odrzuca uruchomienie. Uzupełnij najpierw te dane w obiekcie.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Utrzymywanie synchronizacji cen na wszystkich portalach",
          excerpt: "Wystarczy jeden kalendarz — menedżer kanałów automatycznie rozprowadza zmiany cen do wszystkich portali.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: zmieniasz cenę i chcesz mieć pewność, że wszędzie się zgadza",
            },
            {
              type: "p",
              text: "Ceny prowadzisz wyłącznie w kalendarzu myNextDays obiektu — nigdy osobno w samych portalach. Menedżer kanałów automatycznie przekazuje każdą zmianę do wszystkich portali, dla których obiekt jest aktywnie zmapowany.",
            },
            {
              type: "steps",
              items: [
                "Otwórz kalendarz cen lub plany cenowe obiektu.",
                "Dostosuj cenę dzienną, minimalny pobyt lub ograniczenie przyjazdu/wyjazdu.",
                "Zapisz zmianę — działa ona najpierw wewnętrznie w obiekcie.",
                "Sprawdź w zakładce „Portale”, że wszystkie żądane portale są nadal aktywnie zmapowane.",
                "Poczekaj kilka minut, aż zmiana zostanie przekazana do portali.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nigdy nie wprowadzaj cen bezpośrednio w portalu — takie zmiany zostaną nadpisane przez kalendarz myNextDays przy kolejnej synchronizacji.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Import rezerwacji z portalu",
          excerpt: "Rezerwacje z portali trafiają automatycznie do kalendarza — tutaj sprawdzasz, czy import się powiódł.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: gość zarezerwował przez portal, rezerwacja ma trafić do myNextDays",
            },
            {
              type: "p",
              text: "Gdy gość rezerwuje przez Booking.com, Airbnb lub inny połączony portal, menedżer kanałów automatycznie importuje rezerwację — nie musisz nic przenosić ręcznie. Ten przebieg opisuje, jak prześledzić i potwierdzić import.",
            },
            {
              type: "steps",
              items: [
                "Otwórz kalendarz lub listę rezerwacji dotkniętego obiektu.",
                "Znajdź nową rezerwację — nosi ona odznakę pochodzenia portalu, na przykład Booking.com lub Airbnb.",
                "Sprawdź kompletność danych gościa, okresu i ceny.",
                "Skontroluj, czy zarezerwowane noce są wyświetlane jako zablokowane na wszystkich pozostałych kanałach.",
                "W razie potrzeby otwórz szczegóły rezerwacji, aby obsłużyć dodatkowe usługi lub wiadomości gościa.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jeśli gość anuluje przez portal lub zmieni okres, jest to również automatycznie przejmowane, a noce są ponownie zwalniane.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Rozwiązywanie podwójnej rezerwacji",
          excerpt: "Jak postępować, gdy wyjątkowo ta sama noc została sprzedana na dwóch kanałach.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: dwie rezerwacje nakładają się dla tego samego obiektu i tych samych nocy",
            },
            {
              type: "p",
              text: "Menedżer kanałów zwykle natychmiast blokuje zarezerwowane noce na wszystkich kanałach. Podwójna rezerwacja może mimo to powstać, na przykład przy równoczesnych rezerwacjach na dwóch portalach w tym samym momencie lub przy ręcznie utworzonej rezerwacji kolidującej z rezerwacją z portalu.",
            },
            {
              type: "steps",
              items: [
                "Otwórz kalendarz obiektu i zidentyfikuj obie nakładające się rezerwacje.",
                "Sprawdź moment rezerwacji i odznakę pochodzenia obu rezerwacji.",
                "Skontaktuj się z gościem, który zarezerwował później, i zaproponuj obiekt zastępczy lub alternatywny okres.",
                "Anuluj rezerwację, której nie da się utrzymać, w danym portalu, a nie tylko w myNextDays.",
                "Ustaw następnie dla dotkniętych nocy stop sprzedaży, dopóki sprawa nie zostanie w pełni wyjaśniona.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rezerwację z portalu zawsze anuluj przez sam portal — anulowanie tylko w myNextDays zwalnia noc wewnętrznie, ale niezawodnie nie informuje o tym portalu.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Tymczasowe wstrzymanie portalu",
          excerpt: "Wyłącz widoczność dla danego portalu osobno, bez utraty mapowania.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: obiekt ma tymczasowo nie być możliwy do zarezerwowania na danym portalu",
            },
            {
              type: "p",
              text: "Widoczność można przełączać osobno dla każdego portalu — niezależnie od strony internetowej i platformy myNextDays. Jeśli na przykład chcesz krótkotrwale wstrzymać Airbnb, ale pozostawić Booking.com aktywny, wyłącz wyłącznie ten jeden kanał.",
            },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte, zakładka „Portale”.",
                "Znajdź wpis portalu, który chcesz wstrzymać.",
                "Wyłącz widoczność dla tego portalu.",
                "Zapisz — zmiana zacznie działać w ciągu kilku minut, obiekt zniknie z wyników wyszukiwania tego portalu.",
                "Włącz widoczność ponownie, gdy tylko obiekt ma być znowu możliwy do zarezerwowania.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mapowanie pozostaje zachowane przy wstrzymaniu — nie musisz później ponownie konfigurować przypisania do portalu. Do całkowitego zablokowania wszystkich kanałów użyj zamiast tego stop sprzedaży.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Sprawdzanie mapowania obiektu",
          excerpt: "Jak skontrolować, czy Twój obiekt jest wciąż poprawnie przypisany do właściwego typu oferty w portalu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: ceny lub dostępność na portalu nie zgadzają się już z myNextDays",
            },
            {
              type: "p",
              text: "Jeśli wyświetlanie w portalu odbiega od Twojego kalendarza myNextDays, przyczyną jest często błędne lub przerwane mapowanie — powiązanie między Twoim obiektem a typem pokoju lub oferty w portalu.",
            },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte, zakładka „Portale”.",
                "Sprawdź status dotkniętego portalu — powinien pokazywać „Połączono”, a nie „Błąd” lub „Oczekujące”.",
                "Skontroluj, czy przypisany typ pokoju lub oferty w portalu nadal odpowiada rzeczywistemu obiektowi.",
                "W razie rozbieżności: usuń mapowanie i przypisz je na nowo, a następnie ponownie aktywuj widoczność.",
                "Po korekcie poczekaj kilka minut i ponownie sprawdź ceny oraz dostępność w portalu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Obiekt może być jednocześnie przypisany do kilku portali — przy rozbieżnościach sprawdzaj celowo ten jeden dotknięty portal, a nie wszystkie naraz.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Różne stawki dla każdego portalu",
          excerpt: "Jak przypisać portalowi własny plan cenowy, bez wpływu na pozostałe kanały.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: chcesz oferować na jednym portalu inną cenę niż na pozostałych kanałach",
            },
            {
              type: "p",
              text: "Plany cenowe można przypisywać osobno dla każdego portalu, na przykład plan bezzwrotny dla jednego portalu i elastyczny dla innego. Ceny bazowe pozostają prowadzone centralnie w obiekcie, a mapowanie określa, który plan cenowy trafia do którego portalu.",
            },
            {
              type: "steps",
              items: [
                "Utwórz w obiekcie dodatkowy plan cenowy z żądanymi warunkami (cena, warunki anulowania, minimalny pobyt).",
                "Otwórz zakładkę „Portale” i wybierz dotknięty portal.",
                "W mapowaniu przypisz nowy plan cenowy do tego portalu.",
                "Pozostaw pozostałe portale bez zmian na ich dotychczasowym planie cenowym.",
                "Zapisz i po kilku minutach sprawdź wyświetlanie ceny w danym portalu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Każdy plan cenowy jest przekazywany niezależnie — zmiana w jednym planie cenowym nie wpływa na portale przypisane do innego planu cenowego.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Usuwanie częstych błędów portali",
          excerpt: "Typowe przyczyny, gdy portal odrzuca obiekt lub synchronizacja się zacina.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa: status portalu pokazuje błąd lub obiekt nie zostaje przyjęty",
            },
            {
              type: "p",
              text: "Portale zwykle odrzucają połączenie z powodu brakujących danych podstawowych lub niekompletnych danych obiektu. Przejdź po kolei przez najczęstsze przyczyny, zanim skontaktujesz się ze wsparciem.",
            },
            {
              type: "steps",
              items: [
                "Sprawdź w /konto, czy adres, informacje podatkowe i dane kontaktowe są kompletne.",
                "Skontroluj w obiekcie, czy opis, zdjęcia, wyposażenie i co najmniej jedna stawka są kompletne.",
                "Sprawdź, czy zapisana jest ważna metoda płatności dla prowizji.",
                "Otwórz zakładkę „Portale” i przeczytaj dokładny komunikat o błędzie obok dotkniętego portalu.",
                "Usuń wskazany brak i ponownie aktywuj widoczność.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Błąd portalu zawsze dotyczy tylko tego jednego portalu — pozostałe kanały działają niezależnie od tego, dopóki spełnione są ich własne wymagania.",
            },
          ],
        },
      ],
    },
  ],
};
