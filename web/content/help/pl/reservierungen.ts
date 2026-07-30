import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezerwacje i pobyty",
  description: "Zarządzaj rezerwacjami, przesuwaj je i anuluj.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezerwacje",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Ręczne wprowadzanie rezerwacji",
          excerpt:
            "Jak wprowadzić bezpośrednio w myNextDays rezerwację przyjętą telefonicznie lub przez e-mail.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Kiedy wprowadzać ręcznie" },
            {
              type: "p",
              text: "Nie każda rezerwacja przychodzi przez portal albo Twoją własną platformę — zapytania telefoniczne, e-mailowe lub na miejscu musisz utworzyć samodzielnie, aby obiekt był w myNextDays poprawnie zablokowany i nie doszło do podwójnego obłożenia.",
            },
            {
              type: "steps",
              items: [
                "Otwórz Rezerwacje i kliknij „Nowa rezerwacja”.",
                "Wybierz obiekt — każdy obiekt w myNextDays to jedna jednostka do rezerwacji, czyli konkretny pokój lub obiekt wakacyjny.",
                "Ustal datę przyjazdu i wyjazdu oraz liczbę gości.",
                "Wprowadź dane gościa (imię i nazwisko, kontakt, ewentualnie adres do faktury).",
                "Sprawdź proponowaną cenę i w razie potrzeby dostosuj ją.",
                "Zapisz rezerwację — noce zostaną natychmiast zablokowane w kalendarzu.",
              ],
            },
            { type: "h2", text: "Płatność i potwierdzenie" },
            {
              type: "p",
              text: "Po zapisaniu obowiązują te same zasady płatności co przy rezerwacjach online. Jeśli podłączony jest dostawca płatności, możesz od razu wysłać gościowi link do płatności lub ręcznie oznaczyć płatność jako otrzymaną.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Wpisz specjalne życzenia (wczesny przyjazd, dodatkowe łóżka) od razu w notatkach — zespół zobaczy je na osi czasu rezerwacji.",
            },
            { type: "h2", text: "Po utworzeniu" },
            {
              type: "p",
              text: "Nowa rezerwacja pojawia się natychmiast na [osi czasu rezerwacji](/hilfe/reservierungen/buchungs-zeitleiste) wraz ze wszystkimi kolejnymi krokami, takimi jak wiadomości, zadania i płatności, w jednym miejscu.",
            },
            {
              type: "ul",
              items: [
                "Kalendarz i portale są automatycznie synchronizowane zaraz po zapisaniu.",
                "Gość w razie potrzeby otrzymuje automatyczną wiadomość potwierdzającą.",
                "Zmiany terminów wprowadzasz przez „Przesuń rezerwację”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Oś czasu rezerwacji",
          excerpt:
            "Oś czasu rezerwacji zbiera cały przebieg rezerwacji w jednym miejscu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Co pokazuje oś czasu" },
            {
              type: "p",
              text: "Każda rezerwacja ma własną oś czasu, która przedstawia chronologicznie cały przebieg — od zapytania o rezerwację lub importu z portalu aż po wymeldowanie. Dzięki temu na pierwszy rzut oka widzisz, co już się wydarzyło i co jest kolejnym krokiem.",
            },
            {
              type: "ul",
              items: [
                "Wiadomości z gościem",
                "Zadania, na przykład sprzątanie lub przygotowanie",
                "Płatności i faktury",
                "Zarezerwowane dodatki i usługi dodatkowe",
                "Przesunięcia (Move) i anulowania",
              ],
            },
            { type: "h2", text: "Korzystanie z osi czasu na co dzień" },
            {
              type: "steps",
              items: [
                "Otwórz Rezerwacje i wybierz żądaną rezerwację.",
                "Przejdź do zakładki „Oś czasu”.",
                "Przewiń chronologicznie przez wszystkie zdarzenia.",
                "Skorzystaj z szybkich akcji, aby od razu wysłać wiadomość lub utworzyć zadanie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jeśli rezerwacja zostanie przesunięta lub anulowana, ten krok również pojawia się na osi czasu — łącznie ze zwolnionymi w kalendarzu nocami.",
            },
            { type: "h2", text: "Dlaczego to ważne" },
            {
              type: "p",
              text: "Ponieważ zespół, właściciel i wsparcie widzą tę samą oś czasu, nie powstają luki informacyjne między wiadomościami, zadaniami i płatnościami. Szczegóły dotyczące zwrotów znajdziesz w artykule [Zwroty płatności](/hilfe/zahlungen/rueckerstattungen), a dotyczące usług dodatkowych w artykule [Dodatki i usługi dodatkowe](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Przesuwanie rezerwacji",
          excerpt:
            "Jak przesunąć istniejącą rezerwację na nowy okres, nie wprowadzając zamieszania w kalendarzu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Sprawdź przed przesunięciem" },
            {
              type: "p",
              text: "Zanim przesuniesz rezerwację, sprawdź dostępność w nowym okresie dla zarezerwowanego obiektu. myNextDays zwalnia pierwotnie zarezerwowane noce dopiero wtedy, gdy nowy okres zostanie potwierdzony — dzięki temu nie powstaje luka, w której obiekt byłby błędnie uznany za wolny lub podwójnie obłożony.",
            },
            {
              type: "steps",
              items: [
                "Otwórz rezerwację w sekcji Rezerwacje.",
                "Wybierz „Przesuń” i wprowadź nowy okres.",
                "Sprawdź wyświetloną dostępność dla nowych dat.",
                "Potwierdź przesunięcie.",
                "Sprawdź, czy nowa liczba nocy zmienia cenę, i w razie potrzeby dostosuj ją.",
              ],
            },
            { type: "h2", text: "Co dzieje się automatycznie" },
            {
              type: "p",
              text: "Po potwierdzeniu stare noce zostają poprawnie zwolnione w kalendarzu, a nowe noce zablokowane, a połączone portale są aktualizowane. Cały proces jest odnotowywany na osi czasu rezerwacji.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jeśli rezerwacja została odebrana przez portal, przesunięcie może tam podlegać własnym zasadom — sprawdź zasady portalu, zanim wprowadzisz większe zmiany.",
            },
            { type: "h2", text: "Różnice w płatnościach" },
            {
              type: "p",
              text: "Jeśli cena zmienia się w wyniku przesunięcia, dostosuj odpowiednio zasady płatności — zobacz [Zasady płatności](/hilfe/zahlungen/zahlungsregeln). Więcej o całym przebiegu rezerwacji znajdziesz w artykule [Oś czasu rezerwacji](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Anulowanie i zwrot płatności",
          excerpt:
            "Jak poprawnie anulować rezerwację i w razie potrzeby zainicjować zwrot płatności.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Anulowanie rezerwacji" },
            {
              type: "p",
              text: "Anulowanie natychmiast zwalnia obiekt na zarezerwowany okres — zarówno w Twoim kalendarzu, jak i na wszystkich połączonych portalach. Przed anulowaniem sprawdź, jakie warunki anulowania obowiązują dla tej rezerwacji.",
            },
            {
              type: "steps",
              items: [
                "Otwórz rezerwację w sekcji Rezerwacje.",
                "Wybierz „Anuluj” i podaj powód.",
                "Sprawdź proponowaną kwotę zwrotu.",
                "Potwierdź anulowanie.",
              ],
            },
            { type: "h2", text: "Inicjowanie zwrotu płatności" },
            {
              type: "p",
              text: "Jeśli płatność została zrealizowana przez połączonego dostawcę płatności, możesz zainicjować zwrot bezpośrednio z poziomu rezerwacji. Kwota jest podawana w walucie zapisanej dla tego obiektu. Szczegóły przebiegu znajdziesz w artykule [Zwroty płatności](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Możliwy pełny lub częściowy zwrot",
                "Proces pojawia się na osi czasu rezerwacji",
                "Przy rezerwacjach z portali dodatkowo obowiązują zasady danego portalu",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Anulowania nie da się cofnąć. Sprawdź dokładnie okres i dane gościa, zanim potwierdzisz.",
            },
            { type: "h2", text: "Po anulowaniu" },
            {
              type: "p",
              text: "Obiekt jest od razu ponownie możliwy do zarezerwowania, a otwarte zadania związane z rezerwacją — na przykład przygotowanie — są automatycznie oznaczane jako już niepotrzebne. Cały proces pozostaje możliwy do prześledzenia na [osi czasu rezerwacji](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Zameldowanie i wymeldowanie",
          excerpt: "Jak dokumentować przyjazd i wyjazd gościa w myNextDays.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Rejestrowanie zameldowania" },
            {
              type: "p",
              text: "Zameldowanie oznacza początek pobytu i jest szczególnie przydatne przy samodzielnym zameldowaniu lub przekazaniu kluczy przez zespół, aby utrzymywać aktualny status każdej rezerwacji.",
            },
            {
              type: "steps",
              items: [
                "Otwórz rezerwację w sekcji Rezerwacje.",
                "Wybierz „Zameldowanie” w dniu przyjazdu.",
                "W razie potrzeby dodaj notatkę, na przykład godzinę lub szczegóły.",
              ],
            },
            { type: "h2", text: "Wymeldowanie i przekazanie" },
            {
              type: "p",
              text: "Przy wymeldowaniu oznaczasz pobyt jako zakończony. W wielu przypadkach uruchamia to automatycznie zadanie sprzątania obiektu, aby przygotować go na kolejną rezerwację.",
            },
            {
              type: "ul",
              items: [
                "Zameldowanie i wymeldowanie są częścią osi czasu rezerwacji",
                "Godziny można zdefiniować dla każdego obiektu w ustawieniach obiektu",
                "Przy dostępie mobilnym zespół może rejestrować zameldowanie i wymeldowanie bezpośrednio na miejscu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pominięte wymeldowanie nie blokuje automatycznie kolejnych zadań — regularnie sprawdzaj zaległe statusy w Rezerwacjach.",
            },
            { type: "h2", text: "Powiązanie z zadaniami" },
            {
              type: "p",
              text: "Zameldowanie i wymeldowanie są ściśle powiązane z zadaniami i osią czasu. Więcej o całym przebiegu przeczytasz w artykule [Oś czasu rezerwacji](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Dodatki i usługi dodatkowe",
          excerpt:
            "Jak oferować gościom możliwe do zarezerwowania usługi dodatkowe, takie jak śniadanie czy transfer, i uwzględniać je w rezerwacji.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Czym są dodatki" },
            {
              type: "p",
              text: "Dodatki to opcjonalne usługi dodatkowe do rezerwacji — na przykład śniadanie, wczesny przyjazd, transfer lub późne wymeldowanie. Są zapisywane dla poszczególnych obiektów i mogą być dodawane do rezerwacji przez samego gościa albo przez Twój zespół.",
            },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i utwórz w sekcji „Dodatki” żądane usługi dodatkowe wraz z ceną.",
                "Otwórz istniejącą rezerwację w sekcji Rezerwacje.",
                "Wybierz „Dodaj dodatek” i wybierz żądaną usługę.",
                "Potwierdź ilość i termin realizacji usługi.",
              ],
            },
            { type: "h2", text: "Rozliczanie" },
            {
              type: "p",
              text: "Dodatki są rozliczane w walucie danego obiektu i pojawiają się jako osobna pozycja na fakturze. Już opłacone dodatki można przy anulowaniu proporcjonalnie zwrócić.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Zapisz popularne dodatki raz, centralnie przy obiekcie — dzięki temu przy każdej nowej rezerwacji można je dodać za pomocą kilku kliknięć.",
            },
            { type: "h2", text: "Widoczność dla gościa" },
            {
              type: "p",
              text: "Jeśli platforma lub własna strona internetowa jest aktywna, goście mogą często wybrać odpowiednie dodatki już podczas samej rezerwacji. Każde uzupełnienie pojawia się potem na [osi czasu rezerwacji](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Dodatki można nazywać i wyceniać indywidualnie dla każdego obiektu",
                "Dodanie w późniejszym terminie jest w każdej chwili możliwe z poziomu rezerwacji",
                "Anulowane dodatki są zwracane proporcjonalnie",
              ],
            },
          ],
        },
      ],
    },
  ],
};
