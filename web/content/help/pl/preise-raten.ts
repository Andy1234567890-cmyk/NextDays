import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Ceny i plany cenowe",
  description: "Plany cenowe, ceny sezonowe i ceny dynamiczne.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Ustalanie cen",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Cena bazowa i waluta",
          excerpt: "Jak ustalić cenę bazową i przypisać obiektowi właściwą walutę.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Każdy obiekt w myNextDays to dokładnie jedna jednostka do rezerwacji — pojedynczy pokój albo obiekt wakacyjny. Dla tej jednostki wprowadzasz cenę bazową oraz centralną walutę, która obowiązuje dla całego obiektu.",
            },
            { type: "h2", text: "Centralne ustalanie waluty" },
            {
              type: "p",
              text: "Waluta obiektu jest ustawiana raz dla obiektu i automatycznie obowiązuje dla wszystkich planów cenowych, które dla niego tworzysz. Nie ma osobnej waluty domyślnej — jeśli brakuje waluty, nie możesz zapisać cen.",
            },
            {
              type: "steps",
              items: [
                "Otwórz swój obiekt w sekcji „Obiekty”.",
                "Przejdź do zakładki „Ceny”.",
                "W polu „Waluta obiektu” wybierz odpowiednią walutę.",
                "Wpisz cenę bazową dla standardowego obłożenia.",
                "Zapisz zmiany.",
              ],
            },
            { type: "h2", text: "Co się dzieje przy zmianie waluty" },
            {
              type: "p",
              text: "Jeśli zmienisz walutę obiektu w późniejszym czasie, wpłynie to na wszystkie istniejące plany cenowe tego obiektu, ponieważ zawsze są one prowadzone w walucie obiektu. Sprawdź potem swoje ceny, zanim ponownie przekażesz je do portali.",
            },
            {
              type: "ul",
              items: [
                "Obiekt ma dokładnie jedną walutę — nie kilka dla każdego planu cenowego.",
                "Cena bazowa jest wartością wyjściową dla stawek pochodnych.",
                "Kwoty są zawsze wyświetlane w zapisanej walucie obiektu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez zapisanej waluty nie można zapisać żadnej ceny ani przekazać żadnej stawki do portali. Sprawdź to najpierw, gdy zmiana ceny się nie powiedzie.",
            },
            {
              type: "note",
              variant: "info",
              text: "Więcej o stawkach pochodnych znajdziesz w artykule [Stawki pochodne](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Tworzenie planów cenowych",
          excerpt: "Plany cenowe łączą cenę, warunki anulowania i wyżywienie dla obiektu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Plan cenowy określa, na jakich warunkach można zarezerwować obiekt: cenę, zasady anulowania, wyżywienie i minimalny pobyt. Obiekt może jednocześnie oferować kilka planów cenowych, na przykład plan elastyczny i plan bezzwrotny.",
            },
            { type: "h2", text: "Tworzenie nowego planu cenowego" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i przejdź do zakładki „Ceny”.",
                "Kliknij „Utwórz nowy plan cenowy”.",
                "Nadaj nazwę mówiącą, np. „Elastyczny” lub „Bezzwrotny”.",
                "Określ, czy plan jest stawką bazową, czy stawką pochodną.",
                "Wprowadź warunki anulowania i wyżywienie.",
                "Zapisz i aktywuj plan cenowy.",
              ],
            },
            { type: "h2", text: "Stawka bazowa a inne plany cenowe" },
            {
              type: "p",
              text: "Najpierw utwórz swoją stawkę bazową (często nazywaną „BAR”, Best Available Rate). Wszystkie kolejne plany cenowe mogą być prowadzone samodzielnie albo wyprowadzone z tej stawki bazowej.",
            },
            {
              type: "ul",
              items: [
                "Stawka bazowa: ręcznie prowadzona cena podstawowa za noc.",
                "Kolejne plany cenowe: samodzielne albo jako dopłata/rabat względem stawki bazowej.",
                "Każdy plan cenowy można osobno przekazać do portali.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Utrzymuj liczbę planów cenowych dla obiektu na rozsądnym poziomie — zbyt wiele wariantów utrudnia gościom porównanie i zwiększa nakład pracy przy ich prowadzeniu.",
            },
            {
              type: "note",
              variant: "info",
              text: "Szczegóły dotyczące dopłat i rabatów znajdziesz w artykule [Stawki pochodne](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Stawki pochodne",
          excerpt: "Pochodne plany cenowe są obliczane automatycznie na podstawie stawki bazowej.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Stawka pochodna to plan cenowy, którego cena nie jest prowadzona ręcznie, lecz obliczana automatycznie na podstawie stawki bazowej — jako stała dopłata, rabat lub procent. Oszczędza to nakład pracy, ponieważ zmiana ceny stawki bazowej automatycznie aktualizuje wszystkie plany pochodne.",
            },
            { type: "h2", text: "Typowy przykład" },
            {
              type: "p",
              text: "Częstym wzorcem jest plan ze śniadaniem, wyprowadzony ze stawki bazowej bez wyżywienia: cena śniadania jest definiowana jako dopłata za noc i osobę do stawki bazowej. Jeśli zmienisz stawkę bazową, cena śniadania dostosowuje się automatycznie.",
            },
            { type: "h2", text: "Konfiguracja stawki pochodnej" },
            {
              type: "steps",
              items: [
                "Otwórz wybrany plan cenowy w zakładce „Ceny”.",
                "Jako źródło ceny wybierz „Pochodna z …” oraz odpowiednią stawkę bazową.",
                "Określ, czy różnica jest kwotą stałą, czy procentem.",
                "Ustal, czy chodzi o dopłatę, czy o rabat.",
                "Zapisz przypisanie.",
              ],
            },
            {
              type: "ul",
              items: [
                "Dopłata: np. wyżywienie, późniejsza możliwość anulowania.",
                "Rabat: np. plan bezzwrotny z korzystniejszą ceną.",
                "Stawka bazowa pozostaje jedynym ręcznie prowadzonym źródłem.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stawki pochodnej nie można jednocześnie nadpisać ręcznie. Jeśli chcesz ustawić odbiegającą cenę pojedynczą, najpierw usuń powiązanie pochodne.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Ceny sezonowe i weekendowe",
          excerpt: "Celowe dostosowanie cen dla okresów sezonowych i weekendów.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Popyt zmienia się w ciągu roku i w ciągu tygodnia. Za pomocą cen sezonowych i weekendowych dostosowujesz cenę bazową dla określonych okresów lub dni tygodnia, bez konieczności wchodzenia do kalendarza osobno dla każdego dnia.",
            },
            { type: "h2", text: "Tworzenie okresu sezonowego" },
            {
              type: "steps",
              items: [
                "Otwórz w obiekcie zakładkę „Ceny” i sekcję „Ceny sezonowe”.",
                "Utwórz nowy okres z datą początkową i końcową.",
                "Wprowadź cenę lub procentowe odchylenie od ceny bazowej dla tego okresu.",
                "Zapisz okres sezonowy.",
              ],
            },
            { type: "h2", text: "Ceny weekendowe" },
            {
              type: "p",
              text: "Dodatkowo możesz nałożyć własną dopłatę na pojedyncze dni tygodnia, na przykład piątek i sobotę. Dopłata ta działa dodatkowo do obowiązującej w danym momencie ceny sezonowej lub bazowej.",
            },
            {
              type: "ul",
              items: [
                "Ceny sezonowe działają dla ciągłych okresów.",
                "Ceny weekendowe działają dla poszczególnych dni tygodnia, niezależnie od sezonu.",
                "Obie reguły można łączyć.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jeśli kilka okresów sezonowych się nakłada, obowiązuje reguła utworzona jako ostatnia lub najbardziej szczegółowa. Sprawdź kalendarz po zapisaniu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Do automatycznych, opartych na popycie dostosowań przyda się dodatkowo [Ceny dynamiczne](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Ceny dynamiczne",
          excerpt: "Automatyczne dostosowanie cen do popytu, czasu wyprzedzenia i obłożenia.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Ceny dynamiczne automatycznie dostosowują cenę bazową na podstawie czynników takich jak wyprzedzenie rezerwacji, aktualne obłożenie i popyt — podobnie jak robią to duże portale przy własnych rekomendacjach cenowych. Dzięki temu reagujesz na zmiany rynkowe bez ręcznego dostosowywania każdego dnia.",
            },
            { type: "h2", text: "Aktywacja cen dynamicznych" },
            {
              type: "steps",
              items: [
                "Otwórz w obiekcie zakładkę „Ceny” i sekcję „Ceny dynamiczne”.",
                "Aktywuj funkcję dla stawki bazowej obiektu.",
                "Ustal dolną i górną granicę ceny.",
                "Określ, jak mocno obłożenie może wpływać na cenę.",
                "Zapisz ustawienia.",
              ],
            },
            { type: "h2", text: "Granice i bezpieczeństwo" },
            {
              type: "p",
              text: "Dolna i górna granica ceny zapobiegają temu, aby automatyczny algorytm ustalał ceny nieopłacalne dla Twojej działalności. Pochodne plany cenowe automatycznie podążają za dynamicznie obliczaną stawką bazową.",
            },
            {
              type: "ul",
              items: [
                "Dolna granica ceny chroni przed zbyt niskimi cenami przy słabym popycie.",
                "Górna granica ceny chroni przed zawyżonymi cenami przy wysokim popycie.",
                "Stawki pochodne automatycznie przejmują nową stawkę bazową.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ceny dynamiczne działają tylko na stawkę bazową. Plany cenowe ustawione ręcznie na stałe, bez powiązania pochodnego, nie zmieniają się automatycznie.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Rabaty za długość pobytu",
          excerpt: "Konfiguracja rabatów za dłuższe pobyty i wczesne rezerwacje.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Rabaty za długość pobytu nagradzają gości za dłuższe rezerwacje lub wczesne rezerwowanie. Są stosowane jako procent od całkowitej ceny pobytu i można je konfigurować niezależnie dla każdego obiektu.",
            },
            { type: "h2", text: "Rodzaje rabatów" },
            {
              type: "ul",
              items: [
                "Rabat za długi pobyt: od określonej liczby nocy, np. od 7 lub 28 nocy.",
                "Rabat za wczesną rezerwację: przy rezerwacji z odpowiednim wyprzedzeniem.",
                "Rabat last minute: przy rezerwacji krótko przed datą przyjazdu.",
              ],
            },
            { type: "h2", text: "Konfiguracja rabatu" },
            {
              type: "steps",
              items: [
                "Otwórz w obiekcie zakładkę „Ceny” i sekcję „Rabaty”.",
                "Wybierz żądany rodzaj rabatu.",
                "Ustal próg, np. minimalną liczbę nocy lub wyprzedzenie czasowe.",
                "Wprowadź rabat w procentach.",
                "Zapisz regułę.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Rabaty działają na całkowitą cenę danego planu cenowego i są pokazywane gościowi już w podsumowaniu ceny.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Połącz rabaty za długi pobyt z zasadą [Minimalny i maksymalny pobyt](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), aby celowo zachęcać do dłuższych rezerwacji.",
            },
          ],
        },
      ],
    },
  ],
};
