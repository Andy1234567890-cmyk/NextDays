import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portale i menedżer kanałów",
  description: "Booking, Airbnb, Expedia i inne — steruj nimi centralnie.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Łączenie portali",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Czym jest menedżer kanałów?",
          excerpt:
            "Menedżer kanałów automatycznie synchronizuje ceny, dostępność i rezerwacje między myNextDays a portalami.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Jedno połączenie dla wszystkich portali" },
            {
              type: "p",
              text: "Menedżer kanałów jest pomostem między myNextDays a dużymi portalami rezerwacyjnymi, takimi jak Booking, Airbnb i inne. Zamiast prowadzić ceny, dostępność i obłożenie osobno w każdym portalu, wprowadzasz wszystko raz w myNextDays — menedżer kanałów rozprowadza to automatycznie do wszystkich połączonych portali.",
            },
            { type: "h2", text: "Co jest synchronizowane automatycznie" },
            {
              type: "ul",
              items: [
                "Dostępność — każda rezerwacja natychmiast blokuje noc na wszystkich portalach",
                "Ceny i minimalne pobyty z Twojego kalendarza cen",
                "Przychodzące rezerwacje z portali są automatycznie importowane do myNextDays",
                "Anulowania i stop sprzedaży działają na wszystkie kanały jednocześnie",
              ],
            },
            { type: "h2", text: "Czego już nie musisz robić ręcznie" },
            {
              type: "p",
              text: "Bez menedżera kanałów musiałbyś po każdej rezerwacji ręcznie blokować noc w każdym portalu — to częsty powód podwójnych rezerwacji. Przy aktywnym menedżerze kanałów myNextDays przejmuje to porównanie w obu kierunkach, wielokrotnie w ciągu dnia i w czasie rzeczywistym przy nowych rezerwacjach.",
            },
            {
              type: "note",
              variant: "info",
              text: "Połączenie z portalami konfigurujesz jednorazowo dla całego konta. Dla każdego pojedynczego obiektu aktywujesz potem tylko mapowanie — więcej na ten temat w artykule [Przypisywanie obiektu do portalu](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Konfiguracja połączenia z portalami",
          excerpt:
            "Połączenie z portalami konfigurujesz jednorazowo dla całego konta — nie osobno dla każdego obiektu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Jednorazowo dla całego konta" },
            {
              type: "p",
              text: "Podłączenie do portali jest ustawieniem obowiązującym dla całego konta: łączysz swoje konto myNextDays z menedżerem kanałów dokładnie raz. Wszystkie obiekty, które dodasz później, automatycznie korzystają z tego jednego połączenia — nie musisz go budować od nowa dla każdego obiektu.",
            },
            { type: "h2", text: "Jak skonfigurować połączenie" },
            {
              type: "steps",
              items: [
                "Otwórz /konto i wybierz sekcję „Portale i menedżer kanałów”.",
                "Kliknij „Skonfiguruj połączenie” i potwierdź dane swojej firmy (adres, kontakt, forma prawna).",
                "Sprawdź automatycznie przejęte dane podstawowe — są one przekazywane do wszystkich portali.",
                "Zakończ konfigurację; status zmieni się na „Połączono”.",
              ],
            },
            { type: "h2", text: "Kolejny krok: przypisywanie obiektów" },
            {
              type: "p",
              text: "Po jednorazowej konfiguracji żaden obiekt nie jest jeszcze widoczny — w tym celu przypisujesz każdy obiekt osobno do portalu (mapowanie) i łączysz żądane portale, takie jak Booking.com czy Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez kompletnych danych podstawowych (adres, informacje podatkowe, kontakt) portale odrzucają połączenie. Sprawdź najpierw te dane w /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Przypisywanie obiektu do portalu",
          excerpt:
            "Po skonfigurowaniu połączenia dla całego konta aktywujesz dla każdego obiektu już tylko mapowanie do danego portalu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Mapowanie zamiast nowego połączenia" },
            {
              type: "p",
              text: "Gdy połączenie z portalami zostanie raz skonfigurowane dla całego konta, każdy obiekt łączysz już tylko przez tak zwane mapowanie: określasz, który obiekt myNextDays odpowiada któremu typowi pokoju lub oferty w portalu. To jednorazowy krok dla każdego obiektu.",
            },
            { type: "h2", text: "Jak przypisać obiekt" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte i przejdź do zakładki „Portale”.",
                "Wybierz żądany portal, na przykład Booking.com lub Airbnb.",
                "Przypisz obiekt do odpowiedniego typu pokoju lub oferty w portalu.",
                "Aktywuj synchronizację — ceny i dostępność będą od tej pory przekazywane.",
              ],
            },
            { type: "h2", text: "Jeden obiekt, wiele portali" },
            {
              type: "p",
              text: "Pojedynczy obiekt może być jednocześnie przypisany do kilku portali. Każde przypisanie jest niezależne — możesz na przykład uczynić obiekt widocznym na Booking.com i Airbnb, a na Expedia pozostawić go tymczasowo wyłączony.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po mapowaniu od razu sprawdź widoczność — zobacz [Widoczność dla poszczególnych portali](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Łączenie z Booking.com",
          excerpt: "Jak włączyć Booking.com jako kanał sprzedaży dla obiektu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Warunek: połączenie dla całego konta" },
            {
              type: "p",
              text: "Zanim aktywujesz Booking.com dla obiektu, musi być skonfigurowane połączenie z portalami dla całego konta (zobacz [Konfiguracja połączenia z portalami](/hilfe/portale-kanalmanager/portal-verbindung)). Potem Booking.com dla każdego kolejnego obiektu jest już tylko kwestią mapowania.",
            },
            { type: "h2", text: "Aktywacja Booking.com" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte, zakładka „Portale”.",
                "Wybierz „Booking.com” z listy dostępnych portali.",
                "Przypisz odpowiedni typ pokoju lub oferty i potwierdź plany cenowe.",
                "Aktywuj widoczność — obiekt zostanie uruchomiony po weryfikacji przez Booking.com.",
              ],
            },
            { type: "h2", text: "Czego Booking.com od Ciebie oczekuje" },
            {
              type: "ul",
              items: [
                "Kompletny opis obiektu, zdjęcia i wyposażenie",
                "Co najmniej jedna stawka z ceną i warunkami anulowania",
                "Ważna metoda płatności dla prowizji",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Weryfikacja przez Booking.com może potrwać kilka godzin. Status w zakładce obiektu „Portale” pokazuje, czy połączenie jest już aktywne.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Łączenie z Airbnb",
          excerpt: "Jak uczynić obiekt możliwym do zarezerwowania na Airbnb przez menedżera kanałów.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Airbnb jako kolejny portal" },
            {
              type: "p",
              text: "Airbnb, tak jak każdy inny portal, jest podłączany przez połączenie dla całego konta. Gdy jest ono skonfigurowane, aktywujesz Airbnb dla każdego obiektu przez mapowanie — niezależnie od tego, czy obiekt jest już widoczny na Booking.com lub innych portalach.",
            },
            { type: "h2", text: "Aktywacja Airbnb dla obiektu" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte, zakładka „Portale”.",
                "Wybierz „Airbnb” z listy dostępnych portali.",
                "Potwierdź kategorię obiektu i przypisany typ oferty.",
                "Sprawdź zdjęcia, wyposażenie i regulamin domu — Airbnb wymaga kompletnych danych przed uruchomieniem.",
                "Aktywuj widoczność dla Airbnb.",
              ],
            },
            { type: "h2", text: "Po aktywacji" },
            {
              type: "p",
              text: "Gdy Airbnb zatwierdzi obiekt, ceny i dostępność przebiegają automatycznie przez menedżera kanałów. Rezerwacje przychodzące na Airbnb pojawiają się następnie automatycznie w Twoim kalendarzu rezerwacji.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez zapisanych warunków anulowania i regulaminu domu Airbnb odrzuca uruchomienie. Uzupełnij najpierw te dane w obiekcie.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Synchronizacja cen i dostępności",
          excerpt:
            "Ceny i dostępność są automatycznie przekazywane do wszystkich połączonych portali.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Jeden kalendarz, wszystkie portale" },
            {
              type: "p",
              text: "Ceny i dostępność prowadzisz wyłącznie w kalendarzu myNextDays danego obiektu. Menedżer kanałów automatycznie przekazuje każdą zmianę do wszystkich portali, dla których obiekt jest aktywnie zmapowany — bez konieczności wprowadzania czegokolwiek podwójnie.",
            },
            { type: "h2", text: "Co jest przekazywane" },
            {
              type: "ul",
              items: [
                "Ceny dzienne z Twojego kalendarza cen lub planów cenowych",
                "Dostępne noce i blokady",
                "Minimalny pobyt i ograniczenia dotyczące przyjazdu/wyjazdu",
                "Dni stop sprzedaży — blokują one automatycznie wszystkie portale",
              ],
            },
            { type: "h2", text: "Jak szybko działa synchronizacja" },
            {
              type: "p",
              text: "Zmiany cen i dostępności są przekazywane do portali w ciągu kilku minut. Nowe rezerwacje natychmiast blokują dotknięte noce, aby ta sama noc nie mogła zostać ponownie sprzedana na żadnym innym kanale.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Więcej o blokowaniu pojedynczych dni na wszystkich kanałach znajdziesz w artykule [Unikanie przepełnienia rezerwacjami](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Odbieranie rezerwacji z portali",
          excerpt: "Rezerwacje z Booking, Airbnb i innych trafiają automatycznie do Twojego kalendarza.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Automatyczny import" },
            {
              type: "p",
              text: "Gdy gość rezerwuje przez portal taki jak Booking.com lub Airbnb, menedżer kanałów automatycznie importuje rezerwację do myNextDays. Nie musisz nic przenosić ręcznie — rezerwacja pojawia się w kalendarzu i na liście rezerwacji dotkniętego obiektu.",
            },
            { type: "h2", text: "Co się dzieje przy rezerwacji z portalu" },
            {
              type: "steps",
              items: [
                "Portal zgłasza nową rezerwację do menedżera kanałów.",
                "myNextDays tworzy rezerwację z danymi gościa, okresem i ceną.",
                "Zarezerwowane noce są natychmiast blokowane na wszystkich pozostałych kanałach.",
                "Otrzymujesz powiadomienie i znajdujesz rezerwację w kalendarzu.",
              ],
            },
            { type: "h2", text: "Anulowania i zmiany" },
            {
              type: "p",
              text: "Jeśli gość anuluje przez portal lub zmieni okres, jest to również automatycznie przekazywane do myNextDays, a dotknięte noce są ponownie zwalniane.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rezerwacje z portali są rozpoznawalne w szczegółach rezerwacji po odznace pochodzenia, na przykład Booking.com lub Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Unikanie przepełnienia rezerwacjami",
          excerpt: "Stop sprzedaży i automatyczne blokady zapobiegają podwójnym rezerwacjom na wielu portalach.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Dlaczego powstaje przepełnienie rezerwacjami" },
            {
              type: "p",
              text: "Bez centralnego sterowania łatwo dochodzi do sprzedania tej samej nocy jednocześnie na dwóch portalach — na przykład gdy ceny i dostępność są prowadzone ręcznie w kilku systemach. Menedżer kanałów zamyka tę lukę, ponieważ każda rezerwacja na każdym kanale natychmiast blokuje wszystkie pozostałe kanały.",
            },
            { type: "h2", text: "Twoje narzędzia przeciwko przepełnieniu rezerwacjami" },
            {
              type: "ul",
              items: [
                "Automatyczna blokada: każda nowa rezerwacja — niezależnie od kanału — blokuje noce wszędzie",
                "Stop sprzedaży: ręcznie blokuje dzień jednocześnie na wszystkich kanałach, na przykład na użytek własny lub konserwację",
                "Minimalny pobyt i ograniczenia przyjazdu zapobiegają niepasującym krótkim rezerwacjom",
              ],
            },
            { type: "h2", text: "Ustawianie stop sprzedaży" },
            {
              type: "steps",
              items: [
                "Otwórz kalendarz obłożenia obiektu.",
                "Zaznacz dotknięty dzień lub okres.",
                "Wybierz „Stop sprzedaży” — dzień jest potem zablokowany na wszystkich portalach oraz na stronie internetowej i platformie.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop sprzedaży obowiązuje bez wyjątku na wszystkich kanałach. Nie ma możliwości zablokowania dnia tylko dla jednego portalu, a pozostawienia go otwartym dla innych.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Widoczność dla poszczególnych portali",
          excerpt: "Każdy portal można włączać lub wyłączać niezależnie od strony internetowej i platformy myNextDays.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Trzy niezależne drogi sprzedaży" },
            {
              type: "p",
              text: "Obiekt może być sprzedawany jednocześnie kilkoma drogami: przez portale (Booking, Airbnb i inne), przez platformę myNextDays oraz przez Twoją własną stronę internetową. Każda droga ma własny przełącznik widoczności — są one całkowicie niezależne od siebie.",
            },
            { type: "h2", text: "Sterowanie widocznością dla każdego portalu" },
            {
              type: "p",
              text: "W obrębie portali dodatkowo każdy pojedynczy portal można przełączać osobno. Obiekt może być na przykład aktywny na Booking.com, a wyłączony na Airbnb — oba przypisania pozostają przy tym nienaruszone.",
            },
            { type: "h2", text: "Jak zmienić widoczność" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w /objekte, zakładka „Portale”.",
                "Włącz lub wyłącz osobno żądany kanał (pojedynczy portal, stronę internetową lub platformę myNextDays).",
                "Zapisz — zmiana zacznie działać w ciągu kilku minut.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Status obiektu (aktywny/nieaktywny) oraz stop sprzedaży działają nadrzędnie na wszystkie kanały. Przełączniki widoczności sterują tylko tym, na jakich dodatkowych kanałach pojawia się już aktywny obiekt.",
            },
          ],
        },
      ],
    },
  ],
};
