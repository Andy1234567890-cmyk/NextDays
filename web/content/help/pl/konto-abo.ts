import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konto i abonament",
  description: "Dane podstawowe, taryfa, bezpieczeństwo i weryfikacja dwuetapowa.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konto",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Dane podstawowe firmy",
          excerpt: "Centralne prowadzenie nazwy firmy, adresu i danych kontaktowych.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "W sekcji /konto myNextDays łączy wszystkie funkcje firmy i konta jako sekcje na jednej stronie — nie musisz przełączać się między wieloma podstronami. Dane podstawowe firmy stanowią przy tym podstawę: nazwa firmy, forma prawna, adres i dane kontaktowe, wykorzystywane do faktur, portali i komunikacji z gośćmi.",
            },
            { type: "h2", text: "Otwieranie i edycja danych podstawowych" },
            {
              type: "steps",
              items: [
                "Otwórz /konto.",
                "Przejdź do sekcji „Dane podstawowe firmy”.",
                "Sprawdź nazwę firmy, adres, numer telefonu i adres e-mail do zapytań zwrotnych.",
                "Wprowadź swoje zmiany.",
                "Zapisz sekcję.",
              ],
            },
            { type: "h2", text: "Dlaczego te dane są ważne" },
            {
              type: "p",
              text: "Dane podstawowe firmy trafiają do faktur, do rejestracji w podłączonych portalach oraz do prawnie obowiązkowych informacji, takich jak stopka redakcyjna. Niekompletny lub nieaktualny adres może spowodować, że faktury zostaną wystawione błędnie lub podłączenia do portali ulegną opóźnieniu.",
            },
            {
              type: "ul",
              items: [
                "Nazwa firmy i forma prawna pojawiają się na wszystkich wystawianych fakturach.",
                "Adres jest potrzebny do rejestracji w portalach.",
                "Dane kontaktowe służą jako droga zapasowa, jeśli powiadomienia systemowe nie docierają.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jeśli zmienisz swój adres do faktur, sprawdź następnie już wystawione faktury w artykule [Rozliczenia i kalkulator taryf](/hilfe/konto-abo/abrechnung-tarifrechner) — istniejące dokumenty nie są dostosowywane wstecz.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonament i taryfa",
          excerpt: "Twoja taryfa określa limit obiektów — aktualnie zarezerwowaną liczbę obiektów widzisz zawsze w Koncie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Twój abonament myNextDays obejmuje limit obiektów: maksymalną liczbę obiektów (pokoi lub obiektów wakacyjnych), które możesz jednocześnie aktywnie zarządzać. Aktualnie zarezerwowana liczba obiektów jest wyświetlana w sekcji „Abonament i taryfa” w /konto, wraz z pozostałym limitem.",
            },
            { type: "h2", text: "Kontrola limitu" },
            {
              type: "p",
              text: "Limit jest egzekwowany po stronie serwera: gdy osiągniesz górną granicę swojej taryfy, nie możesz dodać kolejnego obiektu, dopóki nie dezaktywujesz istniejącego obiektu lub nie rozszerzysz swojej taryfy. Dotyczy to niezależnie od tego, czy nowy obiekt to pokój, czy obiekt wakacyjny — oba liczą się jednakowo do limitu.",
            },
            {
              type: "steps",
              items: [
                "Otwórz /konto i sekcję „Abonament i taryfa”.",
                "Sprawdź zarezerwowaną liczbę obiektów w stosunku do limitu Twojej taryfy.",
                "W razie potrzeby wybierz większą taryfę, aby dodać więcej obiektów.",
                "Potwierdź zmianę taryfy.",
              ],
            },
            {
              type: "ul",
              items: [
                "Każdy obiekt liczy się osobno do limitu, niezależnie od rodzaju obiektu.",
                "Zmiana taryfy działa natychmiast na dostępny limit.",
                "Obniżenie taryfy jest możliwe tylko wtedy, gdy aktywna liczba obiektów pasuje do nowego limitu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Obniżenie taryfy do mniejszego limitu jest odrzucane, dopóki aktywnych jest więcej obiektów, niż pozwala nowa taryfa. Najpierw dezaktywuj nadmiarowe obiekty.",
            },
            {
              type: "note",
              variant: "info",
              text: "Szczegóły dotyczące faktur i obliczania taryf znajdziesz w artykule [Rozliczenia i kalkulator taryf](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Rozliczenia i kalkulator taryf",
          excerpt: "Adres do faktur, dotychczasowe faktury i kalkulator taryf dla Twojego limitu obiektów.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Sekcja „Rozliczenia i kalkulator taryf” w /konto łączy wszystko związane z wystawianiem faktur: Twój adres do faktur, listę dotychczasowych faktur do pobrania oraz kalkulator taryf, za pomocą którego możesz sprawdzić koszty swojego obecnego lub większego limitu obiektów.",
            },
            { type: "h2", text: "Adres do faktur i faktury" },
            {
              type: "p",
              text: "Adres do faktur może różnić się od adresu Twojej firmy, na przykład gdy dokumenty otrzymuje biuro rachunkowe. Już wystawione faktury znajdziesz posortowane chronologicznie; każdą można pobrać jako PDF.",
            },
            { type: "h2", text: "Korzystanie z kalkulatora taryf" },
            {
              type: "steps",
              items: [
                "Otwórz /konto i sekcję „Rozliczenia i kalkulator taryf”.",
                "Wprowadź w kalkulatorze taryf żądaną liczbę obiektów.",
                "Porównaj wynikowe koszty dla każdego poziomu taryfy.",
                "W razie potrzeby przełącz się bezpośrednio z kalkulatora na odpowiednią taryfę.",
              ],
            },
            {
              type: "ul",
              items: [
                "Kalkulator taryf pokazuje koszty w walucie zapisanej dla Twojego konta.",
                "Faktury są trwale dostępne do pobrania.",
                "Adres do faktur można prowadzić niezależnie od danych podstawowych firmy.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Sprawdzaj regularnie za pomocą kalkulatora taryf, czy Twój limit obiektów nadal pasuje do rzeczywiście zarezerwowanej liczby obiektów — zobacz [Abonament i taryfa](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Zmiana hasła i e-maila",
          excerpt: "Zmiany krytyczne dla bezpieczeństwa wymagają ponownego zalogowania i kroku potwierdzającego.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Hasło i adres e-mail należą do najbardziej krytycznych dla bezpieczeństwa danych Twojego konta. myNextDays wymaga dlatego przy obu zmianach ponownego uwierzytelnienia — potwierdzasz zmianę swoim aktualnym hasłem, nawet jeśli jesteś już zalogowany.",
            },
            { type: "h2", text: "Zmiana hasła" },
            {
              type: "steps",
              items: [
                "Otwórz /konto i sekcję „Zmiana hasła i e-maila”.",
                "Wprowadź swoje aktualne hasło jako potwierdzenie.",
                "Ustaw nowe hasło i powtórz je.",
                "Zapisz zmianę.",
              ],
            },
            { type: "h2", text: "Zmiana adresu e-mail" },
            {
              type: "p",
              text: "Zmiana adresu e-mail przebiega jako podwójne potwierdzenie: po potwierdzeniu aktualnego hasła otrzymujesz link potwierdzający na NOWY adres. Dopiero po kliknięciu tego linku zmiana staje się skuteczna — stary adres pozostaje do tego czasu aktywny, aby dostęp do Twojego konta nigdy nie został przerwany.",
            },
            {
              type: "ul",
              items: [
                "Bez aktualnego hasła nie da się zmienić ani hasła, ani e-maila.",
                "Link potwierdzający dla nowego adresu e-mail jest ważny przez ograniczony czas.",
                "Do momentu potwierdzenia dotychczasowy adres e-mail pozostaje aktywny do logowania i powiadomień.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Po zmianie e-maila sprawdź również weryfikację dwuetapową — zobacz [Weryfikacja dwuetapowa](/hilfe/konto-abo/zwei-faktor) — jeśli kody odzyskiwania były powiązane ze starym adresem.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Weryfikacja dwuetapowa",
          excerpt: "Dodatkowy krok logowania chroni Twoje konto przed nieautoryzowanym dostępem.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Weryfikacja dwuetapowa (2FA) uzupełnia Twoje hasło o drugi czynnik za pomocą aplikacji uwierzytelniającej. Dzięki temu samo skradzione hasło już nie wystarcza, aby zalogować się na Twoje konto myNextDays.",
            },
            { type: "h2", text: "Konfiguracja 2FA" },
            {
              type: "steps",
              items: [
                "Otwórz /konto i sekcję „Weryfikacja dwuetapowa”.",
                "Potwierdź swoje aktualne hasło w celu ponownego uwierzytelnienia.",
                "Zeskanuj wyświetlony kod QR aplikacją uwierzytelniającą.",
                "Wprowadź wygenerowany kod w celu potwierdzenia.",
                "Zapisz wyświetlone kody odzyskiwania w bezpiecznym miejscu.",
              ],
            },
            { type: "h2", text: "Wyłączanie 2FA" },
            {
              type: "p",
              text: "Wyłączenie weryfikacji dwuetapowej również wymaga ponownego uwierzytelnienia aktualnym hasłem. W ten sposób myNextDays zapobiega temu, aby ktoś z już otwartą sesją mógł po prostu wyłączyć Twoje zabezpieczenie.",
            },
            {
              type: "ul",
              items: [
                "Kody odzyskiwania umożliwiają dostęp, jeśli aplikacja uwierzytelniająca zostanie utracona.",
                "Każdy kod odzyskiwania można wykorzystać tylko raz.",
                "Włączanie i wyłączanie 2FA są jednakowo powiązane z potwierdzeniem hasła.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Przechowuj swoje kody odzyskiwania osobno od urządzenia z aplikacją uwierzytelniającą, na przykład w menedżerze haseł.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Historia urządzeń",
          excerpt: "Miej wgląd w to, z jakich urządzeń zalogowane jest Twoje konto.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Historia urządzeń w /konto pokazuje, na jakich urządzeniach Twoje konto jest obecnie zalogowane — z rodzajem urządzenia, przybliżoną lokalizacją i czasem ostatniej aktywności. Dzięki temu szybko rozpoznasz, czy dane logowanie rzeczywiście pochodzi od Ciebie.",
            },
            { type: "h2", text: "Sprawdzanie historii urządzeń" },
            {
              type: "steps",
              items: [
                "Otwórz /konto i sekcję „Historia urządzeń”.",
                "Przejrzyj listę zalogowanych urządzeń.",
                "Jeśli rozpoznasz nieznane urządzenie, wyloguj je.",
                "Następnie dla bezpieczeństwa zmień swoje hasło.",
              ],
            },
            { type: "h2", text: "Kiedy warto to sprawdzić" },
            {
              type: "p",
              text: "Sprawdzaj historię urządzeń szczególnie po zmianie hasła lub e-maila, a także po korzystaniu z obcego lub publicznego urządzenia. Nieznany wpis to wyraźny sygnał ostrzegawczy przed nieautoryzowanym dostępem.",
            },
            {
              type: "ul",
              items: [
                "Każdy wpis pokazuje rodzaj urządzenia, przybliżoną lokalizację i ostatnią aktywność.",
                "Poszczególne urządzenia można celowo wylogować, bez wpływu na pozostałe.",
                "Nierozpoznane urządzenie jest powodem do natychmiastowej zmiany hasła.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jeśli nie rozpoznajesz urządzenia, wyloguj je natychmiast, a następnie zmień hasło w artykule [Zmiana hasła i e-maila](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Ochrona danych",
          excerpt: "Steruj indeksowaniem przez wyszukiwarki dla każdego obiektu i eksportuj swoje dane.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "W sekcji „Ochrona danych” w /konto sterujesz dwiema rzeczami: czy strony Twoich obiektów mogą być indeksowane przez wyszukiwarki, oraz jak wyeksportować dane zapisane u myNextDays.",
            },
            { type: "h2", text: "Indeksowanie przez wyszukiwarki dla każdego obiektu" },
            {
              type: "p",
              text: "Domyślnie indeksowanie przez wyszukiwarki jest wyłączone dla nowych obiektów. Dopiero gdy świadomie włączysz je dla danego obiektu, wyszukiwarki takie jak Google mogą uwzględnić publiczną stronę obiektu w swoim indeksie. Dzięki temu zachowujesz kontrolę nad tym, które obiekty są możliwe do znalezienia poza portalami i własną platformą.",
            },
            {
              type: "steps",
              items: [
                "Otwórz /konto i sekcję „Ochrona danych”.",
                "Wybierz żądany obiekt z listy.",
                "Włącz lub wyłącz indeksowanie przez wyszukiwarki.",
                "Przy kilku obiektach skorzystaj z przełącznika zbiorczego, aby ustawić wszystkie obiekty jednolicie.",
              ],
            },
            { type: "h2", text: "Eksport danych" },
            {
              type: "p",
              text: "Za pomocą funkcji eksportu danych zamawiasz pełną kopię danych zapisanych na Twoim koncie. Eksport zostaje przygotowany, a następnie udostępniony Ci do pobrania.",
            },
            {
              type: "ul",
              items: [
                "Indeksowanie można sterować osobno dla każdego obiektu, z przełącznikiem zbiorczym dla wszystkich obiektów.",
                "Nowe obiekty zasadniczo startują bez indeksowania przez wyszukiwarki.",
                "Eksport danych zawiera dane Twojego konta i obiektów w formie uporządkowanej.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Indeksowanie przez wyszukiwarki jest niezależne od widoczności na portalach i na własnej platformie — dotyczy wyłącznie publicznej strony obiektu w wyszukiwarkach.",
            },
          ],
        },
      ],
    },
  ],
};
