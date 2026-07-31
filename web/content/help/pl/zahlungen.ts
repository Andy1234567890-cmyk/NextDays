import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Płatności i faktury",
  description: "Dostawcy płatności, zasady płatności i faktury.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Płatności",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Łączenie dostawcy płatności",
          excerpt:
            "Jak połączyć Stripe lub PayPal z myNextDays, aby automatycznie obsługiwać płatności.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Dostępni dostawcy" },
            {
              type: "p",
              text: "myNextDays obsługuje płatności za pośrednictwem połączonych dostawców płatności. Obecnie wspierane są Stripe i PayPal — możesz połączyć jednego lub obu dostawców jednocześnie i korzystać z nich zależnie od obiektu lub życzenia gościa.",
            },
            {
              type: "steps",
              items: [
                "Otwórz Konto i przejdź do sekcji „Płatności”.",
                "Wybierz żądanego dostawcę — Stripe lub PayPal.",
                "Postępuj zgodnie z oknem połączenia i zaloguj się u dostawcy lub utwórz nowe konto.",
                "Potwierdź połączenie — status zmieni się na „połączono”.",
              ],
            },
            { type: "h2", text: "Co się dzieje potem" },
            {
              type: "p",
              text: "Gdy dostawca zostanie połączony, możesz wysyłać linki do płatności, pobierać zaliczki i inicjować zwroty bezpośrednio z poziomu rezerwacji. Wszystkie kwoty są przetwarzane w walucie zapisanej dla danego obiektu.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez połączonego dostawcy możesz jedynie ręcznie oznaczać płatności jako otrzymane — automatyczne pobranie nie jest wtedy możliwe.",
            },
            { type: "h2", text: "Wiele obiektów, jeden dostawca" },
            {
              type: "p",
              text: "Raz nawiązane połączenie obowiązuje dla całego konta, dla wszystkich Twoich obiektów. Jak dokładnie przebiega pobranie płatności, ustalasz przez [Zasady płatności](/hilfe/zahlungen/zahlungsregeln). Wypłaty dla Ciebie odbywają się następnie za pośrednictwem danego dostawcy, zobacz [Wypłaty](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe nadaje się do płatności kartą i wielu lokalnych metod płatności",
                "PayPal oferuje gościom znaną alternatywę",
                "Obu dostawców można niezależnie od siebie odłączyć i połączyć na nowo",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Zasady płatności",
          excerpt: "Ustal, kiedy zaliczka i płatność końcowa za rezerwację stają się wymagalne.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Zaliczka i płatność końcowa" },
            {
              type: "p",
              text: "Zasady płatności określają, jak rezerwacja jest rozliczana finansowo — na przykład zaliczka przy rezerwacji i płatność końcowa przed przyjazdem, albo pełna płatność od razu. Zasady obowiązują dla poszczególnych obiektów i można je w każdej chwili dostosować.",
            },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i przejdź do sekcji „Zasady płatności”.",
                "Wybierz, czy pobierana jest zaliczka, i ustal jej udział.",
                "Określ, kiedy płatność końcowa staje się wymagalna, na przykład określona liczba dni przed przyjazdem.",
                "Zapisz ustawienia.",
              ],
            },
            { type: "h2", text: "Automatyczne pobranie" },
            {
              type: "p",
              text: "Jeśli dostawca płatności jest połączony, myNextDays automatycznie pobiera zaliczkę i płatność końcową w zapisanym terminie i wcześniej informuje gościa wiadomością.",
            },
            {
              type: "note",
              variant: "info",
              text: "Zasady płatności działają tylko przy rezerwacjach z połączonym dostawcą płatności. Bez dostawcy oznaczasz płatności ręcznie w rezerwacji.",
            },
            { type: "h2", text: "Różnice w zależności od kanału" },
            {
              type: "p",
              text: "Na portalach może obowiązywać odmiennie ich własna obsługa płatności — sprawdź w takim przypadku warunki danego portalu. Dla rezerwacji przez własną platformę lub stronę internetową zawsze obowiązują ustalone tutaj zasady. Szczegóły dotyczące połączenia z dostawcą znajdziesz w artykule [Łączenie dostawcy płatności](/hilfe/zahlungen/zahlungsanbieter-verbinden), a dotyczące wystawiania faktur w artykule [Tworzenie faktur](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Zaliczka jako kwota stała lub procent",
                "Termin płatności końcowej można dowolnie ustalić",
                "Zmiany działają tylko na nowe rezerwacje, nie wstecz",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Tworzenie faktur",
          excerpt: "Jak utworzyć fakturę do rezerwacji z poprawnym adresem do faktury.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Tworzenie faktury" },
            {
              type: "p",
              text: "Do każdej rezerwacji można utworzyć fakturę — dla samego gościa lub dla innej firmy, jeśli rezerwacja odbywa się w celach biznesowych.",
            },
            {
              type: "steps",
              items: [
                "Otwórz rezerwację w sekcji Rezerwacje.",
                "Wybierz „Utwórz fakturę”.",
                "Sprawdź lub uzupełnij adres do faktury.",
                "Sprawdź wymienione pozycje — nocleg, dodatki, opłaty.",
                "Utwórz fakturę i wyślij ją do gościa.",
              ],
            },
            { type: "h2", text: "Prowadzenie adresu do faktury" },
            {
              type: "p",
              text: "Adres do faktury możesz wprowadzić bezpośrednio w rezerwacji lub pozwolić, aby gość uzupełnił go za pomocą potwierdzenia rezerwacji. Bez pełnego adresu w niektórych krajach nie można wystawić prawnie ważnej faktury.",
            },
            {
              type: "note",
              variant: "warn",
              text: "U klientów biznesowych sprawdź zwłaszcza nazwę firmy i adres — późniejsze poprawki wymagają faktury korygującej.",
            },
            { type: "h2", text: "Kwoty i waluta" },
            {
              type: "p",
              text: "Wszystkie pozycje są podawane w walucie zapisanej dla obiektu. Już dokonane płatności są odnotowywane na fakturze jako wpłata. Jak powstają zaliczka i płatność końcowa, przeczytasz w artykule [Zasady płatności](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Faktury można pobrać jako PDF",
                "Faktury korygujące są w każdej chwili możliwe przy zmianach",
                "Dodatki pojawiają się jako osobna pozycja",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Zwroty płatności",
          excerpt:
            "Jak zwrócić płatność w całości lub częściowo, gdy rezerwacja zostaje anulowana lub zmieniona.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Kiedy potrzebny jest zwrot" },
            {
              type: "p",
              text: "Zwrot płatności jest zazwyczaj potrzebny przy anulowaniu, ale może być też konieczny przy późniejszej korekcie ceny lub anulowanym dodatku.",
            },
            {
              type: "steps",
              items: [
                "Otwórz dotkniętą rezerwację w sekcji Rezerwacje.",
                "Wybierz „Zwrot płatności” w sekcji płatności rezerwacji.",
                "Wprowadź kwotę do zwrotu — w całości lub częściowo.",
                "Potwierdź zwrot.",
              ],
            },
            { type: "h2", text: "Przebieg przez dostawcę płatności" },
            {
              type: "p",
              text: "Zwrot jest realizowany za pośrednictwem dostawcy użytego przy płatności — Stripe lub PayPal — i przekazywany bezpośrednio na pierwotną metodę płatności gościa. Proces jest automatycznie odnotowywany na osi czasu rezerwacji.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez połączonego dostawcy płatności nie da się automatycznie zainicjować zwrotu — w takim przypadku ustal zwrot bezpośrednio z gościem.",
            },
            { type: "h2", text: "Wpływ na prowizje" },
            {
              type: "p",
              text: "Już rozliczone prowizje platformy lub portalu są przy zwrocie proporcjonalnie korygowane. Więcej na ten temat w artykule [Zrozumieć prowizje](/hilfe/zahlungen/provisionen-verstehen). Szczegóły dotyczące samego anulowania znajdziesz w artykule [Anulowanie i zwrot płatności](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Częściowe zwroty są możliwe dla poszczególnych pozycji",
                "Status realizacji jest w każdej chwili widoczny w rezerwacji",
                "Zwroty przebiegają wyłącznie przez pierwotnie użytego dostawcę",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Wypłaty",
          excerpt:
            "Jak otrzymać wypłatę przychodów z rezerwacji od połączonych dostawców płatności.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Jak działają wypłaty" },
            {
              type: "p",
              text: "Przychodzące płatności gromadzą się najpierw u połączonego dostawcy płatności. Stamtąd wypłata trafia na Twoje zapisane konto bankowe zgodnie z typowym rytmem danego dostawcy.",
            },
            {
              type: "steps",
              items: [
                "Otwórz Konto i przejdź do sekcji „Płatności”.",
                "Sprawdź w sekcji „Wypłaty” status danego dostawcy.",
                "W razie potrzeby otwórz widok szczegółowy dostawcy dla pełnej historii wypłat.",
              ],
            },
            { type: "h2", text: "Co jest odliczane przed wypłatą" },
            {
              type: "p",
              text: "Przed wypłatą uwzględniane są naliczone prowizje platformy i portali oraz opłaty dostawcy. Wypłacona kwota niekoniecznie odpowiada zatem pierwotnej sumie rezerwacji.",
            },
            {
              type: "note",
              variant: "info",
              text: "Dokładną strukturę odliczeń wyjaśnia artykuł [Zrozumieć prowizje](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Wiele obiektów i właścicieli" },
            {
              type: "p",
              text: "Jeśli zarządzasz obiektami dla różnych właścicieli, wypłaty są przypisywane odpowiednio do zapisanych rozliczeń właścicieli. W przypadku rozbieżności sprawdź najpierw status leżących u ich podstaw rezerwacji w Rezerwacjach.",
            },
            {
              type: "ul",
              items: [
                "Rytm i metodę wypłat określa dany dostawca",
                "Kwoty zatrzymane, na przykład przy trwających zwrotach, są oznaczone",
                "Pełna historia jest dostępna do wglądu bezpośrednio u dostawcy",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Zrozumieć prowizje",
          excerpt:
            "Przegląd tego, z czego składają się prowizje platformy i portali oraz gdzie są rozliczane.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            { type: "h2", text: "Dwa rodzaje prowizji" },
            {
              type: "p",
              text: "Przy rezerwacjach przez myNextDays mogą wystąpić dwie różne prowizje: prowizja platformy za rezerwacje przez własną platformę oraz prowizje portali za rezerwacje przychodzące przez podłączone portale, takie jak Booking czy Airbnb. Obie są od siebie niezależne i mogą się różnić w zależności od drogi sprzedaży danej rezerwacji.",
            },
            {
              type: "ul",
              items: [
                "Prowizja platformy: naliczana przy rezerwacjach przez platformę myBestDays",
                "Prowizja portalu: obliczana przez dany portal zgodnie z jego własnymi warunkami",
                "Rezerwacje bezpośrednie przez Twoją własną stronę internetową należy traktować niezależnie od tego",
              ],
            },
            { type: "h2", text: "Gdzie widoczne są prowizje" },
            {
              type: "steps",
              items: [
                "Otwórz Konto i przejdź do sekcji „Rozliczenia”.",
                "Wybierz żądany miesiąc.",
                "Sprawdź zestawienie dla każdej rezerwacji wraz z odpowiednią prowizją.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Przez który kanał przyszła dana rezerwacja, widzisz bezpośrednio przy samej rezerwacji — to wyjaśnia, jaka prowizja została zastosowana.",
            },
            { type: "h2", text: "Powiązanie z wypłatami" },
            {
              type: "p",
              text: "Prowizje są odliczane od sumy rezerwacji przed wypłatą. Szczegóły dotyczące procesu wypłaty znajdziesz w artykule [Wypłaty](/hilfe/zahlungen/auszahlungen). Przy zwrocie płatności powiązana prowizja jest proporcjonalnie korygowana — pełny przebieg rezerwacji pokazuje [Oś czasu rezerwacji](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
