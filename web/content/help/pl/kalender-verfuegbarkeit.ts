import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalendarz i dostępność",
  description: "Plan obłożenia, stop sprzedaży i minimalny pobyt.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalendarz",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Odczytywanie planu obłożenia",
          excerpt: "Jak poprawnie odczytać rezerwacje, dostępność i ceny w planie obłożenia.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Plan obłożenia pokazuje na pierwszy rzut oka, które noce są zarezerwowane, dostępne lub zablokowane. W przypadku obiektów wakacyjnych widzisz jeden wiersz na obiekt, w przypadku hoteli — widok zagnieżdżony z jednym wierszem dla każdej kategorii pokoju i planu cenowego.",
            },
            { type: "h2", text: "Budowa widoku" },
            {
              type: "steps",
              items: [
                "Otwórz kalendarz przez pozycję menu „Plan obłożenia”.",
                "Wybierz na górze okres, który chcesz przejrzeć.",
                "W razie potrzeby filtruj według pojedynczych obiektów lub kategorii pokoi.",
                "Kliknij dzień, aby otworzyć szczegóły dotyczące ceny i dostępności.",
                "Kliknij zajęty okres, aby otworzyć powiązaną rezerwację.",
              ],
            },
            { type: "h2", text: "Kolory i symbole" },
            {
              type: "ul",
              items: [
                "Zajęte: okres jest zarezerwowany przez rezerwację.",
                "Dostępne: dzień można zarezerwować na wszystkich aktywnych kanałach.",
                "Zablokowane: dzień nie jest dostępny do rezerwacji z powodu stop sprzedaży lub ręcznej blokady.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Każdy wiersz w planie obłożenia oznacza dokładnie jedną jednostkę do rezerwacji — pokój lub obiekt wakacyjny. Nie ma wiersza-kontenera dla kilku pokoi jednocześnie.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Więcej o celowym otwieraniu i zamykaniu pojedynczych dni znajdziesz w artykule [Ustawianie dostępności](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Ustawianie dostępności",
          excerpt: "Celowe otwieranie i zamykanie pojedynczych dni lub okresów.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Dostępność określa, czy obiekt można zarezerwować w danym dniu. Możesz otwierać lub zamykać pojedyncze dni albo całe okresy bezpośrednio w planie obłożenia.",
            },
            { type: "h2", text: "Edycja okresu" },
            {
              type: "steps",
              items: [
                "Otwórz plan obłożenia wybranego obiektu.",
                "Zaznacz żądany okres, klikając i przeciągając.",
                "W menu akcji wybierz „Zmień dostępność”.",
                "Potwierdź, czy okres ma zostać otwarty, czy zamknięty.",
                "Zapisz zmianę.",
              ],
            },
            { type: "h2", text: "Wpływ na kanały" },
            {
              type: "p",
              text: "Zmiana dostępności wpływa na wszystkie kanały sprzedaży, na których obiekt jest widoczny: portale takie jak Booking, Airbnb i inne, własna platforma oraz aplikacja. Przekazanie danych do portali odbywa się automatycznie w tle.",
            },
            {
              type: "ul",
              items: [
                "Otwarcie: dzień staje się możliwy do zarezerwowania na wszystkich aktywnych kanałach.",
                "Zamknięcie: dzień znika z możliwości rezerwacji, ale pozostaje widoczny w kalendarzu.",
                "Istniejące już rezerwacje nie są dotknięte zmianą dostępności.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nie zamykaj okresu z zamiarem trwałego i całkowitego wyłączenia go ze sprzedaży — do tego służy funkcja Stop sprzedaży, zobacz [Stop sprzedaży](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop sprzedaży",
          excerpt: "Stop sprzedaży natychmiast blokuje dzień na wszystkich kanałach sprzedaży jednocześnie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Stop sprzedaży to najszybszy sposób na całkowite wycofanie pojedynczego dnia ze sprzedaży. W przeciwieństwie do zwykłej zmiany dostępności, Stop sprzedaży działa twardo i natychmiast na wszystkich kanałach jednocześnie — na portalach, własnej platformie i w aplikacji.",
            },
            { type: "h2", text: "Ustawianie stop sprzedaży" },
            {
              type: "steps",
              items: [
                "Otwórz plan obłożenia dotkniętego obiektu.",
                "Wybierz żądany dzień lub okres.",
                "Kliknij w menu akcji „Aktywuj stop sprzedaży”.",
                "Potwierdź blokadę.",
              ],
            },
            { type: "h2", text: "Kiedy stop sprzedaży ma sens" },
            {
              type: "ul",
              items: [
                "Krótkoterminowe prace konserwacyjne lub problemy techniczne w obiekcie.",
                "Szczególny przypadek, w którym natychmiast i bez wyjątku nie chcesz żadnej nowej rezerwacji.",
                "Szybka, obejmująca całą platformę blokada awaryjna, bez konieczności obsługi każdego kanału osobno.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop sprzedaży nie zna wyjątku dla poszczególnych kanałów: jeśli dzień jest zablokowany, żaden gość nie może zarezerwować przez żaden kanał, także nie przez recepcję ani zapytanie bezpośrednie.",
            },
            {
              type: "note",
              variant: "info",
              text: "Do trwałego użytku własnego lub zaplanowanej konserwacji lepiej nadaje się [Ręczna blokada](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimalny i maksymalny pobyt",
          excerpt: "Jak długo goście mogą rezerwować co najmniej lub co najwyżej.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Za pomocą minimalnego i maksymalnego pobytu określasz, ile nocy gość może zarezerwować co najmniej lub co najwyżej dla danego dnia przyjazdu. Pomaga to unikać krótkich rezerwacji wypełniających luki lub celowo pozycjonować obiekt pod dłuższe pobyty.",
            },
            { type: "h2", text: "Konfiguracja reguły" },
            {
              type: "steps",
              items: [
                "Otwórz w obiekcie plan obłożenia lub zakładkę „Ceny”.",
                "Wybierz dotknięty okres.",
                "W polu „Minimalny pobyt” wpisz minimalną liczbę nocy.",
                "Opcjonalnie w polu „Maksymalny pobyt” wpisz maksymalną liczbę nocy.",
                "Zapisz regułę.",
              ],
            },
            { type: "h2", text: "Typowe zastosowania" },
            {
              type: "ul",
              items: [
                "Wysoki sezon: wyższy minimalny pobyt, aby skupić dni zmiany gości.",
                "Niski sezon: niższy minimalny pobyt, aby umożliwić więcej rezerwacji.",
                "Maksymalny pobyt: przydatny, gdy obiekt musi być potem wolny na konserwację lub inne wykorzystanie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reguła obowiązuje dla dnia przyjazdu: gość nie może przyjechać w dniu z minimalnym pobytem trzech nocy tylko na dwie noce, nawet jeśli poszczególne dni są dostępne.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Połącz dłuższe minimalne pobyty z artykułem [Rabaty za długość pobytu](/hilfe/preise-raten/aufenthaltsrabatte), aby zwiększyć zachętę dla gości.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Ręczna blokada",
          excerpt: "Celowa rezerwacja okresów na użytek własny lub konserwację.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Ręczna blokada rezerwuje okres w kalendarzu bez rzeczywistej rezerwacji gościa — na przykład na użytek własny, zaplanowane prace konserwacyjne lub remonty. Okres jest przedstawiany w planie obłożenia jak rezerwacja, ale jest wyraźnie oznaczony jako blokada.",
            },
            { type: "h2", text: "Tworzenie blokady" },
            {
              type: "steps",
              items: [
                "Otwórz plan obłożenia dotkniętego obiektu.",
                "Zaznacz żądany okres.",
                "W menu akcji wybierz „Zablokuj ręcznie”.",
                "Podaj powód, np. „Użytek własny” lub „Konserwacja”.",
                "Zapisz blokadę.",
              ],
            },
            { type: "h2", text: "Różnica względem stop sprzedaży" },
            {
              type: "p",
              text: "Ręczna blokada rezerwuje konkretnie okres w określonym, udokumentowanym celu i można ją później ponownie zwolnić. Do natychmiastowej, obejmującej całą platformę blokady awaryjnej bez udokumentowanego okresu przeznaczona jest natomiast funkcja Stop sprzedaży.",
            },
            {
              type: "ul",
              items: [
                "Ręczna blokada: zaplanowana, z podanym powodem, na użytek własny lub konserwację.",
                "Zwolnienie możliwe w każdej chwili, gdy okres nie jest już potrzebny.",
                "Zablokowane noce nie liczą się jako rezerwacja gościa i nie pojawiają się w przeglądzie przychodów.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Usuń ręczną blokadę, gdy tylko powód przestanie obowiązywać — w przeciwnym razie obiekt pozostaje niepotrzebnie zablokowany na wszystkich kanałach.",
            },
            {
              type: "note",
              variant: "info",
              text: "Do natychmiastowej blokady bez zaplanowanego okresu użyj [Stop sprzedaży](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
