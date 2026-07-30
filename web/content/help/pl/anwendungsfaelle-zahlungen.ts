import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Płatności",
  description: "Poprawnie obsługuj płatności.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Płatności",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Konfiguracja zaliczki",
          excerpt: "Jak przy rezerwacji wymagać tylko części kwoty zamiast pełnej sumy.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Zamiast pobierać od razu całą kwotę rezerwacji, możesz ustalić zaliczkę jako zasadę płatności. Gość płaci przy rezerwacji tylko część kwoty przez Stripe lub PayPal, resztę później w ramach płatności końcowej.",
            },
            {
              type: "steps",
              items: [
                "Otwórz w obiekcie sekcję „Zasady płatności”.",
                "Utwórz nową regułę typu „Zaliczka”.",
                "Ustal kwotę zaliczki jako procent lub stałą kwotę całkowitej sumy.",
                "Określ, kiedy zaliczka staje się wymagalna, zwykle bezpośrednio przy rezerwacji.",
                "Zapisz regułę i sprawdź ją na rezerwacji testowej.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zaliczka jest obsługiwana przez dostawcę płatności zapisanego dla obiektu. Odpowiednią kwotę do sumy pozostałej ustalasz w artykule [Automatyzacja płatności końcowej](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatyzacja płatności końcowej",
          excerpt: "Jak sprawić, aby pozostała kwota była automatycznie pobierana przed przyjazdem.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Po zaliczce pozostaje niezapłacona kwota końcowa. Zamiast śledzić ją ręcznie, konfigurujesz zasadę płatności, która automatycznie pobiera płatność końcową w ustalonym terminie przed przyjazdem przez Stripe lub PayPal.",
            },
            {
              type: "steps",
              items: [
                "Otwórz w obiekcie sekcję „Zasady płatności”.",
                "Utwórz nową regułę typu „Płatność końcowa”, o ile istnieje już reguła zaliczki.",
                "Określ, ile dni przed przyjazdem płatność końcowa staje się wymagalna.",
                "Aktywuj automatyczne pobranie, aby zapisany dostawca płatności samodzielnie pobrał kwotę.",
                "Sprawdź następnie status płatności końcowej na osi czasu danej rezerwacji.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Jeśli automatyczne pobranie się nie powiedzie, na przykład z powodu wygasłej karty, rezerwacja nie zostaje automatycznie anulowana. Sprawdzaj nieudane płatności końcowe niezwłocznie i skontaktuj się bezpośrednio z gościem.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Wykonanie zwrotu płatności",
          excerpt: "Jak zwrócić gościowi kwotę w całości lub częściowo.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Przy anulowaniu lub reklamacji możesz zwrócić gościowi zapłaconą kwotę w całości lub częściowo. Zwrot przebiega przez tego samego dostawcę płatności, przez którego pierwotnie dokonano płatności — Stripe lub PayPal.",
            },
            {
              type: "steps",
              items: [
                "Otwórz dotkniętą rezerwację na osi czasu rezerwacji.",
                "W sekcji „Płatności” wybierz pierwotną płatność, która ma zostać zwrócona.",
                "Wybierz między pełnym a częściowym zwrotem.",
                "Przy częściowym zwrocie wprowadź żądaną kwotę.",
                "Potwierdź zwrot i sprawdź zaktualizowany status płatności na osi czasu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zwrot płatności nie zmienia automatycznie statusu rezerwacji ani zajętych nocy w kalendarzu. Przy anulowaniu sprawdź dodatkowo, czy dotknięte noce muszą zostać ponownie zwolnione w planie obłożenia.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Zarządzanie kaucją",
          excerpt: "Jak skonfigurować kaucję i zwolnić ją ponownie po pobycie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Kaucja zabezpiecza Cię przed szkodami powstałymi podczas pobytu. Jest zapisywana jako osobna zasada płatności i przez Stripe lub PayPal albo wstępnie autoryzowana, albo pobierana, w zależności od konfiguracji obiektu.",
            },
            {
              type: "steps",
              items: [
                "Otwórz w obiekcie sekcję „Zasady płatności” i utwórz regułę typu „Kaucja”.",
                "Ustal kwotę kaucji i termin autoryzacji, zwykle krótko przed przyjazdem.",
                "Sprawdź stan obiektu po wymeldowaniu.",
                "Przy nienagannym stanie zwolnij kaucję w całości przez rezerwację.",
                "Przy szkodzie zwróć tylko niepotrzebną część i udokumentuj powód zatrzymania.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autoryzowana, ale niepobrana kaucja wygasa automatycznie po określonym czasie, w zależności od dostawcy płatności. Zwolnij kaucję niezwłocznie po wymeldowaniu lub pobierz potrzebną kwotę odpowiednio wcześnie.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Korekta faktury",
          excerpt: "Jak w późniejszym terminie skorygować już wystawioną fakturę.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Jeśli już wystawiona faktura zawiera błąd, na przykład w adresie do faktury lub w pozycji, koryguj ją przez rezerwację, zamiast po prostu usuwać pierwotną fakturę.",
            },
            {
              type: "steps",
              items: [
                "Otwórz dotkniętą rezerwację na osi czasu rezerwacji i przejdź do sekcji „Faktury”.",
                "Wybierz błędną fakturę.",
                "Utwórz korektę lub fakturę korygującą do pierwotnej faktury.",
                "Następnie utwórz nową, skorygowaną fakturę z poprawnymi danymi.",
                "Wyślij skorygowaną fakturę ponownie do gościa lub na adres do faktury.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Już wysłanej faktury nie należy bezpośrednio nadpisywać ze względu na możliwość prześledzenia. Korekta przez fakturę korygującą zachowuje pierwotny dokument i czyni zmianę możliwą do prześledzenia.",
            },
          ],
        },
      ],
    },
  ],
};
