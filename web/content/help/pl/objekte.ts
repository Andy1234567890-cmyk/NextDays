import type { HelpCategory } from "../types";

export const objekte: HelpCategory = {
  slug: "objekte",
  title: "Obiekty i wyposażenie",
  description: "Dodawaj i pielęgnuj pokoje oraz obiekty wakacyjne.",
  icon: "ph:house-line",
  collection: "kb",
  sections: [
    {
      heading: "Zarządzanie obiektami",
      articles: [
        {
          slug: "objekt-ist-einheit",
          title: "Obiekt = jedna jednostka do rezerwacji",
          excerpt: "Dlaczego każdy obiekt w myNextDays to dokładnie jedna jednostka do rezerwacji.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "W myNextDays obiekt to zawsze dokładnie jedna jednostka do rezerwacji — pojedynczy pokój w hotelu albo cały obiekt wakacyjny. Ta zasada obowiązuje niezależnie od tego, czy prowadzisz dom wakacyjny, apartament wakacyjny czy hotel, i jest podstawą dla dostępności, cen i rezerwacji.",
            },
            { type: "h2", text: "Żadnego budynku z pokojami pod nim" },
            {
              type: "p",
              text: "Częstym nieporozumieniem jest przedstawianie budynku hotelowego jako jednego obiektu z wieloma pokojami pod nim. W myNextDays nie jest to przewidziane. Jeśli na przykład prowadzisz hotel z ośmioma pokojami dwuosobowymi i czterema jednoosobowymi, dodaj dwanaście osobnych obiektów — nie jeden obiekt z liczbą pokoi.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Celowo nie ma pola takiego jak „Liczba pokoi” na poziomie obiektu. Każdy pokój potrzebuje własnego obiektu z własnym kalendarzem i własnymi cenami.",
            },
            { type: "h2", text: "Obiekty wakacyjne" },
            {
              type: "p",
              text: "W przypadku domu wakacyjnego lub apartamentu wakacyjnego cały obiekt odpowiada jednostce do rezerwacji. Nie ma tu dalszego podziału — obiekt wakacyjny jest zawsze samodzielnym obiektem z własnym kalendarzem.",
            },
            { type: "h2", text: "Dlaczego to ważne" },
            {
              type: "ul",
              items: [
                "Każdy obiekt ma własny kalendarz dostępności — podwójne rezerwacje są wykluczone dokładnie na poziomie obiektu.",
                "Ceny, wyposażenie i zdjęcia obowiązują dla obiektu, a nie dla budynku.",
                "Obiekt zawsze należy dokładnie do jednego właściciela — bez wielokrotnego przypisania.",
                "Widoczność kanałów (strona internetowa, platforma myNextDays, portale) jest sterowana dla każdego obiektu osobno.",
              ],
            },
            {
              type: "p",
              text: "Jak wybrać odpowiedni rodzaj obiektu dla swojego pokoju lub obiektu wakacyjnego, przeczytasz w artykule [Określanie rodzaju obiektu](/hilfe/objekte/objekttyp).",
            },
          ],
        },
        {
          slug: "objekttyp",
          title: "Określanie rodzaju obiektu",
          excerpt: "Poprawne przypisanie kategorii, typu nieruchomości i rodzaju oferty.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Rodzaj obiektu decyduje o tym, jak Twój obiekt jest klasyfikowany i filtrowany na portalach oraz na platformie myNextDays. Składa się z trzech kolejno zależnych od siebie pól wyboru, przez które przechodzisz przy dodawaniu lub edycji obiektu.",
            },
            { type: "h2", text: "Trzy poziomy wyboru" },
            {
              type: "steps",
              items: [
                "Najpierw wybierz kategorię — na przykład nocleg wakacyjny lub hotel.",
                "Na tej podstawie wybierz typ nieruchomości — na przykład apartament wakacyjny, dom wakacyjny, pokój dwuosobowy lub jednoosobowy.",
                "Wybierz rodzaj oferty — na przykład cały obiekt lub prywatny pokój.",
                "Uzupełnij dodatkowe pola wyświetlane w zależności od wyboru, na przykład typ łóżka lub piętro.",
              ],
            },
            { type: "h2", text: "Dlaczego kolejność jest ważna" },
            {
              type: "p",
              text: "Trzy listy rozwijane są od siebie zależne: wybór kategorii ogranicza dostępne typy nieruchomości, a wybór typu nieruchomości ogranicza z kolei rodzaje oferty. Dzięki temu powstają tylko sensowne kombinacje, takie jak stosowane również na dużych portalach.",
            },
            {
              type: "note",
              variant: "info",
              text: "Jeśli zmienisz kategorię w późniejszym czasie, myNextDays sprawdzi, czy typ nieruchomości i rodzaj oferty nadal do niej pasują, i w razie potrzeby poprosi o ponowny wybór.",
            },
            { type: "h2", text: "Edycja rodzaju obiektu" },
            {
              type: "p",
              text: "Otwórz w menu Obiekty wybrany obiekt i przejdź do zakładki Dane podstawowe. Znajdziesz tam trzy listy rozwijane w sekcji Rodzaj obiektu. Po zapisaniu zmiany nowa klasyfikacja zostanie przekazana do wszystkich aktywnych kanałów.",
            },
            {
              type: "ul",
              items: [
                "Kategoria: nadrzędna klasyfikacja (np. nocleg wakacyjny, hotel)",
                "Typ nieruchomości: konkretny rodzaj obiektu (np. apartament wakacyjny, pokój dwuosobowy)",
                "Rodzaj oferty: co dokładnie jest rezerwowane (np. cały obiekt, prywatny pokój)",
              ],
            },
          ],
        },
        {
          slug: "ausstattung",
          title: "Pielęgnacja wyposażenia",
          excerpt: "Wybieraj i aktualizuj cechy wyposażenia.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Wyposażenie obiektu ma istotny wpływ na to, jak dobrze jest on znajdowany i filtrowany na portalach. Goście filtrują celowo według cech takich jak Wi-Fi, kuchnia czy miejsce parkingowe — brakujące dane mogą wykluczyć obiekt z wyników wyszukiwania.",
            },
            { type: "h2", text: "Wybór wyposażenia" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i przejdź do zakładki Wyposażenie.",
                "Wybierz wszystkie pasujące cechy z podanej listy.",
                "W razie potrzeby uzupełnij szczegóły, takie jak liczba miejsc parkingowych lub rodzaj kuchni.",
                "Zapisz zmiany — zostaną one automatycznie przekazane do wszystkich aktywnych portali.",
              ],
            },
            { type: "h2", text: "Skąd pochodzą te cechy" },
            {
              type: "p",
              text: "Lista wyposażenia jest zgodna z katalogiem cech dużych portali, aby Twoje dane mogły zostać tam poprawnie przypisane. Nie przewidziano własnych, dowolnie wymyślonych cech, ponieważ nie dałoby się ich przenieść na portale w uporządkowany sposób.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Sprawdzaj wyposażenie po każdej zmianie budowlanej — na przykład po instalacji nowej klimatyzacji lub dodatkowej łazienki — aby dane pozostawały aktualne na wszystkich kanałach.",
            },
            { type: "h2", text: "Częste grupy cech" },
            {
              type: "ul",
              items: [
                "Wyposażenie podstawowe: Wi-Fi, ogrzewanie, klimatyzacja",
                "Kuchnia i wyżywienie: w pełni wyposażona kuchnia, zmywarka, ekspres do kawy",
                "Łazienka i pranie: własna łazienka, pralka, ręczniki",
                "Przestrzeń zewnętrzna: balkon, taras, ogród, miejsce parkingowe",
              ],
            },
          ],
        },
        {
          slug: "fotos-beschreibung",
          title: "Zdjęcia i opis",
          excerpt: "Przekonujące zdjęcia i teksty dla większej liczby rezerwacji.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Zdjęcia i opis są dla gości najważniejszą podstawą decyzji. Obiekt można opublikować dopiero wtedy, gdy dodano co najmniej jedno zdjęcie tytułowe i opis.",
            },
            { type: "h2", text: "Przesyłanie zdjęć" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i przejdź do zakładki Zdjęcia.",
                "Przeciągnij pliki obrazów do obszaru przesyłania lub wybierz je przez okno wyboru pliku.",
                "Ustaw zdjęcie tytułowe — pojawi się ono w wynikach wyszukiwania i na kafelkach.",
                "Uporządkuj pozostałe zdjęcia przeciąganiem w sensownej kolejności.",
              ],
            },
            { type: "h2", text: "Pisanie opisu" },
            {
              type: "p",
              text: "Przejdź do zakładki Opis i wpisz tytuł oraz tekst główny. Opisz konkretnie lokalizację, cechy szczególne i grupę docelową obiektu — ogólne frazesy działają na portalach mniej przekonująco niż konkretne szczegóły.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Nie wolno używać zdjęć innych obiektów ani pobranych z internetu — portale to sprawdzają i mogą blokować obiekty w przypadku naruszeń.",
            },
            { type: "h2", text: "Zalecenia dotyczące dobrych zdjęć" },
            {
              type: "ul",
              items: [
                "Co najmniej pięć zdjęć, najlepiej po jednym dla każdego pomieszczenia",
                "Format poziomy, dobre oświetlenie, brak znaków wodnych",
                "Zdjęcie tytułowe pokazuje obiekt w sposób możliwie zachęcający i jednoznaczny",
                "Regularna aktualizacja, zwłaszcza po remontach",
              ],
            },
          ],
        },
        {
          slug: "belegung-kapazitaet",
          title: "Obłożenie i pojemność",
          excerpt: "Poprawne wprowadzenie maksymalnej liczby gości i podziału łóżek.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Obłożenie określa, ilu gości może pomieścić obiekt, i jest sprawdzane przy każdym wyszukiwaniu i każdej rezerwacji. Błędne dane prowadzą albo do odrzuconych zapytań, albo do przepełnienia — obu tych sytuacji należy unikać.",
            },
            { type: "h2", text: "Wprowadzanie obłożenia" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i przejdź do zakładki Obłożenie.",
                "Wpisz maksymalną liczbę dorosłych.",
                "Wpisz maksymalną liczbę dzieci, jeśli są dopuszczone.",
                "Uzupełnij podział łóżek w poszczególnych pomieszczeniach, na przykład jedno łóżko dwuosobowe i dwa jednoosobowe.",
              ],
            },
            { type: "h2", text: "Granice obłożenia" },
            {
              type: "p",
              text: "Przy zapytaniu o rezerwację myNextDays automatycznie sprawdza, czy żądana liczba gości mieści się w zapisanym obłożeniu. Zapytania przekraczające maksymalną pojemność są odrzucane lub w ogóle nie są wyświetlane jako możliwe do zarezerwowania.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dodatkowe łóżko lub łóżeczko dla niemowląt zwiększa rzeczywistą pojemność tylko wtedy, gdy uwzględnisz je wyraźnie w podziale łóżek — w przeciwnym razie maksymalna liczba gości pozostaje bez zmian.",
            },
            { type: "h2", text: "Typowe źródła błędów" },
            {
              type: "ul",
              items: [
                "Maksymalna liczba gości ustawiona zbyt wysoko, mimo że dostępnych jest niewiele łóżek",
                "Zapomniano o liczbie dzieci, mimo że obiekt jest kierowany do rodzin",
                "Podział łóżek nieaktualizowany po remoncie",
              ],
            },
            {
              type: "p",
              text: "Jeśli obłożenie i wyposażenie do siebie nie pasują, sprawdź dodatkowo zakładkę [Wyposażenie](/hilfe/objekte/ausstattung).",
            },
          ],
        },
        {
          slug: "status-sichtbarkeit",
          title: "Status obiektu i widoczność",
          excerpt: "Różnica między aktywny/nieaktywny a trzema osiami kanałów.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rozróżnia dwie różne rzeczy, które są często mylone: status obiektu (aktywny lub nieaktywny) oraz widoczność na poszczególnych kanałach sprzedaży. Obie te rzeczy sterujesz niezależnie od siebie.",
            },
            { type: "h2", text: "Status obiektu" },
            {
              type: "p",
              text: "Status active oznacza, że obiekt jest zasadniczo zdolny do sprzedaży. Status inactive wyłącza obiekt całkowicie z użytku — na przykład podczas długotrwałego remontu. Nieaktywny obiekt nie jest możliwy do zarezerwowania na żadnym kanale, niezależnie od przełączników kanałów.",
            },
            { type: "h2", text: "Trzy osie kanałów" },
            {
              type: "p",
              text: "Jeśli obiekt jest aktywny, trzy niezależne przełączniki decydują, gdzie dokładnie jest on widoczny:",
            },
            {
              type: "ul",
              items: [
                "Strona internetowa — widoczność na Twojej własnej stronie myNextDays",
                "Platforma myBestDays — widoczność na globalnej platformie myBestDays",
                "Portale — widoczność na Booking, Airbnb i innych",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Te trzy osie są całkowicie niezależne od statusu obiektu i od siebie nawzajem. Aktywny obiekt może być widoczny np. tylko na stronie internetowej, ale nie na portalach.",
            },
            { type: "h2", text: "Zmiana statusu" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i przejdź do zakładki Przegląd.",
                "Ustaw status na aktywny lub nieaktywny.",
                "W razie potrzeby dostosuj dodatkowo trzy przełączniki kanałów w zakładce Widoczność.",
                "Zapisz zmianę — zacznie ona działać natychmiast na wszystkich dotkniętych kanałach.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Do krótkotrwałej blokady pojedynczych dni użyj zamiast tego funkcji Stop sprzedaży w kalendarzu — blokuje ona celowo dni na wszystkich kanałach, bez dezaktywacji całego obiektu.",
            },
          ],
        },
      ],
    },
  ],
};
