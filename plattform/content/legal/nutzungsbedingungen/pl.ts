import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Warunki korzystania dla gości",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsze warunki korzystania regulują korzystanie z portalu rezerwacyjnego myBestDays (dalej „platforma”) przez podróżnych i osoby dokonujące rezerwacji (dalej „gość” lub „Państwo”).",
    `Platformę prowadzi ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dania, CVR nr ${ANBIETER.cvr} (dalej „myBestDays” lub „my”). myBestDays jest znakiem towarowym tej spółki, a nie odrębną osobą prawną. Pełne dane usługodawcy znajdują się w [Informacjach prawnych](https://mybestdays.dk/rechtliches/impressum).`,
    "Korzystając z platformy, akceptują Państwo niniejsze warunki. Prosimy o ich uważne przeczytanie.",
  ],
  summary: {
    heading: "Podsumowanie niniejszych warunków",
    paragraphs: [
      "myBestDays to platforma handlowa. Udostępniamy platformę, na której dostawcy oferują swoje zakwaterowanie — samego zakwaterowania nie świadczymy. Umowa o zakwaterowanie zawierana jest między Państwem a dostawcą, a nie z nami.",
      "To, co widzą Państwo w ogłoszeniu, pochodzi od dostawcy: opis, zdjęcia, wyposażenie, cena, warunki anulowania i regulamin obiektu. Sprawdzamy ogłoszenia, lecz nie możemy ręczyć za każdą informację dostawcy.",
      "Cena widoczna przy finalizowaniu rezerwacji jest ceną całkowitą za zarezerwowane usługi. Kwoty płatne dopiero na miejscu (np. opłata miejscowa lub kaucja) wskazujemy odrębnie z wyprzedzeniem.",
      "Jeżeli coś pójdzie nie tak, prosimy zwrócić się najpierw do nas. Sekcja A15 opisuje, jak złożyć reklamację i jakie drogi pozostają następnie otwarte.",
      "Niniejsze podsumowanie objaśnia warunki, lecz ich nie zastępuje. Rozstrzygający jest pełny tekst.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Wszystkie rezerwacje za pośrednictwem myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definicje",
          paragraphs: [
            "Pojęcia używane w niniejszych warunkach objaśniono w słowniku na końcu dokumentu. Najważniejsze z nich to:",
          ],
          list: [
            "„Platforma” — strona internetowa, aplikacje mobilne i wszelkie inne kanały dostępu, za pośrednictwem których myBestDays prezentuje zakwaterowanie i pośredniczy w rezerwacjach.",
            "„Dostawca” — osoba fizyczna lub prawna oferująca zakwaterowanie za pośrednictwem platformy (gospodarz, wynajmujący, agencja, obiekt hotelowy lub noclegowy).",
            "„Zakwaterowanie” — usługa noclegowa oferowana przez dostawcę, tj. obiekt wakacyjny albo jednostka danego typu pokoju lub obiektu.",
            "„Rezerwacja” — dokonana za pośrednictwem platformy rezerwacja zakwaterowania na określony okres.",
            "„Cena całkowita” — kwota wskazana przy finalizowaniu rezerwacji, obejmująca wszystkie podatki, opłaty i dopłaty rozliczane za pośrednictwem platformy.",
            "„Koszty na miejscu” — kwoty nierozliczane za pośrednictwem platformy, lecz płatne dostawcy (np. opłata miejscowa, kaucja, sprzątanie końcowe według wyboru dostawcy).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. O niniejszych warunkach",
          paragraphs: [
            "Niniejsze warunki mają zastosowanie do każdego korzystania z platformy, niezależnie od tego, czy zakładają Państwo konto i czy dochodzi do rezerwacji.",
            "Sekcja A dotyczy wszystkich rezerwacji. Sekcja B zawiera uzupełniające zasady dotyczące zakwaterowania. W razie sprzeczności pierwszeństwo ma sekcja B.",
            "Do samej usługi noclegowej stosuje się dodatkowo warunki danego dostawcy (w szczególności regulamin obiektu i warunki anulowania) wskazane w ogłoszeniu. Warunki dostawcy obowiązują obok naszych; nie mogą uchylać naszych warunków w zakresie Państwa relacji z nami.",
            "Niniejsze warunki są dostępne we wszystkich 24 językach urzędowych Unii Europejskiej. W razie rozbieżności między wersjami językowymi rozstrzygająca jest wersja niemiecka, chyba że bezwzględnie obowiązujące prawo Państwa państwa zamieszkania stanowi inaczej.",
            "Bezwzględnie obowiązujące prawa konsumenta wynikające z prawa Państwa państwa zamieszkania pozostają nienaruszone.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. O myBestDays",
          paragraphs: [
            "myBestDays to internetowa platforma handlowa dla obiektów wakacyjnych i podmiotów świadczących usługi noclegowe. Prowadzimy platformę, na której dostawcy prezentują swoje zakwaterowanie, a goście mogą je rezerwować.",
            "Jesteśmy pośrednikiem, a nie podmiotem świadczącym usługi noclegowe. Nie posiadamy, nie prowadzimy, nie zarządzamy ani nie kontrolujemy żadnego z zakwaterowań oferowanych na platformie i nie jesteśmy stroną umowy o zakwaterowanie.",
            "myBestDays jest usługą pośrednią w rozumieniu rozporządzenia (UE) 2022/2065 w sprawie usług cyfrowych. Nasze informacje i procedury wynikające z tego rozporządzenia znajdują się w [Akcie o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays nie jest organizatorem turystyki. Nie tworzymy imprez turystycznych w rozumieniu dyrektywy (UE) 2015/2302; o powiązanych usługach turystycznych zob. A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Nasza platforma",
          paragraphs: [
            "Treść ogłoszenia — opis, zdjęcia, wyposażenie, limity obłożenia, ceny, dostępność, warunki anulowania i regulamin obiektu — pochodzi od danego dostawcy. To on odpowiada za jej prawidłowość i kompletność.",
            "Sprawdzamy ogłoszenia przed publikacją i na bieżąco pod kątem oczywistych naruszeń naszych [Zasad dotyczących odpowiednich treści](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). Nie istnieje obowiązek ogólnego monitorowania wszystkich treści, a zgodnie z art. 8 rozporządzenia (UE) 2022/2065 byłby on również niedopuszczalny.",
            "Sposób porządkowania wyników wyszukiwania i czynniki decydujące o kolejności wyjaśniamy w [Ceny, pozycjonowanie i rekomendacje](https://mybestdays.dk/rechtliches/preisangaben).",
            "Dążymy do stałej dostępności platformy, lecz nie zobowiązujemy się do nieprzerwanej dostępności. Możliwe są prace konserwacyjne, zakłócenia i zmiany.",
            "Tłumaczenia treści dostawców mogą być maszynowe. Rozstrzygająca jest wersja pierwotna wprowadzona przez dostawcę.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Nasze wartości",
          paragraphs: [
            "Oczekujemy od gości i dostawców wzajemnego szacunku. Dyskryminacja ze względu na pochodzenie, kolor skóry, religię, światopogląd, płeć, tożsamość płciową, orientację seksualną, niepełnosprawność, wiek lub podobne cechy nie jest na platformie tolerowana — zob. [Polityka niedyskryminacji](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Do zachowania podczas pobytu stosuje się [Zasady podstawowe dla gości](https://mybestdays.dk/rechtliches/grundregeln-gaeste), a do dostawców [Kodeks postępowania dostawców](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Państwa konto i korzystanie z platformy",
          paragraphs: [
            "W celu rezerwacji mogą Państwo założyć konto. Odpowiadają Państwo za poufność swoich danych dostępowych i niezwłocznie zawiadamiają nas w razie podejrzenia nieuprawnionego użycia.",
            "Z platformy mogą Państwo korzystać wyłącznie wtedy, gdy mają Państwo zdolność do czynności prawnych i mogą skutecznie zawierać umowy.",
            "Dane podawane przy rejestracji i rezerwacji muszą być prawidłowe i kompletne — w szczególności imię i nazwisko, dane kontaktowe oraz liczba podróżnych. Dostawca potrzebuje tych informacji, aby udostępnić zakwaterowanie i wypełnić obowiązki meldunkowe.",
            "Niedozwolone jest w szczególności:",
          ],
          list: [
            "dokonywanie rezerwacji pozornych, płatności oszukańcze lub korzystanie z cudzych środków płatniczych bez upoważnienia;",
            "zautomatyzowane pobieranie danych z platformy (scraping, roboty indeksujące) w zakresie wykraczającym poza to, na co zezwala nasz plik robots.txt;",
            "działania zakłócające lub przeciążające platformę bądź jej infrastrukturę albo omijające jej zabezpieczenia;",
            "zamieszczanie treści bezprawnych, obraźliwych lub wprowadzających w błąd w opiniach, wiadomościach lub danych profilu;",
            "próba realizacji rezerwacji poza platformą po nawiązaniu kontaktu za jej pośrednictwem — zob. [Opłaty poza platformą](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Ceny",
          paragraphs: [
            "Wszystkie ceny prezentowane są jako cena całkowita obejmująca podatki i wszystkie opłaty rozliczane za pośrednictwem platformy, gdy tylko znane są dane podróży (okres i liczba podróżnych). Jeżeli dany składnik jest należny dopiero na miejscu, wskazujemy go odrębnie przed finalizacją rezerwacji.",
            "Ceny prezentowane są w walucie ogłoszenia. Jeżeli kwota jest dodatkowo wyświetlana w innej walucie, jest to niewiążące przeliczenie orientacyjne; rozliczenie następuje w walucie ogłoszenia, o ile przy płatności nie wskazano inaczej.",
            "Ceny mogą ulec zmianie do chwili finalizacji rezerwacji, na przykład dlatego, że dostawca je koryguje lub zmienia się dostępność. Rozstrzygająca jest cena wyświetlona bezpośrednio przed wiążącą rezerwacją i wskazana w potwierdzeniu rezerwacji.",
            "Oczywiste błędy cenowe (np. kwota błędna o rząd wielkości) nie wiążą ani nas, ani dostawcy. Jeżeli stwierdzimy taki błąd, niezwłocznie Państwa poinformujemy; będą Państwo mogli wówczas bezpłatnie anulować rezerwację.",
            "Sposób ustalania opłat serwisowych opisano w [Opłatach serwisowych](https://mybestdays.dk/rechtliches/servicegebuehren). O podatkach i daninach zob. [Politykę podatkową](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Płatność",
          paragraphs: [
            "Płatności za pośrednictwem platformy obsługuje dostawca usług płatniczych Stripe. Dane płatnicze (np. dane karty) zbiera i przetwarza bezpośrednio Stripe; myBestDays nie przechowuje pełnych danych kart.",
            "Termin wymagalności poszczególnych kwot — zaliczki, dopłaty lub płatności na miejscu — zależy od ogłoszenia i jest wskazany przed finalizacją rezerwacji. Szczegóły regulują [Warunki płatności](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Jeżeli ogłoszenie przewiduje kaucję, może ona zostać wstępnie autoryzowana lub pobrana i zatrzymana w całości lub w części w razie szkody; rozstrzygające są informacje z ogłoszenia.",
            "W razie niepowodzenia płatności lub jej obciążenia zwrotnego rezerwacja może zostać anulowana. Dostawca może nadal dochodzić kwot wynikających z jego warunków anulowania.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Zasady",
          paragraphs: [
            "Poza niniejszymi warunkami obowiązują następujące zasady, stanowiące część umowy między Państwem a nami:",
          ],
          list: [
            "[Zasady dotyczące odpowiednich treści](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Zasady dotyczące opinii](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Polityka niedyskryminacji](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Zasady podstawowe dla gości](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Warunki anulowania](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Zasady przekwaterowania i zwrotów](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Zasady przy poważnych zakłóceniach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Zasady dotyczące praw autorskich](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Ochrona danych i pliki cookie",
          paragraphs: [
            "Sposób przetwarzania przez nas danych osobowych opisuje [Polityka prywatności](https://mybestdays.dk/rechtliches/datenschutz). Stosowane pliki cookie i podobne technologie opisuje [Polityka plików cookie](https://mybestdays.dk/rechtliches/cookies).",
            "Na potrzeby rezerwacji przekazujemy dostawcy dane, których potrzebuje do wykonania usługi noclegowej. Dostawca jest w tym zakresie samodzielnym administratorem; obowiązują go [Standardy ochrony danych dla gospodarzy](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Dostępność",
          paragraphs: [
            "Stan dostępności platformy oraz sposób zgłaszania barier opisuje [Deklaracja dostępności](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Informacje o dostępności danego zakwaterowania pochodzą od dostawcy. Jeżeli są Państwo zdani na określone rozwiązania, prosimy ustalić je z dostawcą przez funkcję wiadomości przed rezerwacją.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Opinie i treści tworzone przez użytkowników",
          paragraphs: [
            "Po pobycie mogą Państwo wystawić opinię. Opinię może wystawić wyłącznie osoba, która dokonała rezerwacji za pośrednictwem platformy i rozpoczęła pobyt lub mogła go rozpocząć — w ten sposób zapewniamy, że publikowane opinie pochodzą od rzeczywistych gości.",
            "Nie płacimy za opinie, nie zmieniamy ich treści i nie usuwamy opinii tylko dlatego, że jest negatywna. Szczegóły oraz podstawy usunięcia opinii określają [Zasady dotyczące opinii](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Za treści, które Państwo zamieszczają — opinie, zdjęcia, wiadomości, dane profilu — pozostają Państwo odpowiedzialni. Udzielają nam Państwo niewyłącznego, nieograniczonego terytorialnie i czasowo, nieodpłatnego prawa do zwielokrotniania, opracowywania (np. kadrowania, tłumaczenia) i publicznego udostępniania tych treści w ramach prowadzenia i promowania platformy. Mogą Państwo usunąć swoje treści; już dokonane wykorzystania w już opublikowanych zestawieniach pozostają nienaruszone.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Wiadomości i komunikacja z dostawcą",
          paragraphs: [
            "Wiadomości między Państwem a dostawcą przebiegają przez platformę. Udostępniamy funkcję wiadomości, lecz nie jesteśmy ani nadawcą, ani odbiorcą treści.",
            "Możemy automatycznie sprawdzać wiadomości pod kątem naruszeń niniejszych warunków (np. dane kontaktowe służące ominięciu platformy, wzorce oszustw, treści bezprawne) oraz zatrzymywać lub usuwać takie wiadomości. O usunięciu informujemy Państwa wraz z uzasadnieniem zgodnie z A17.",
            "Wysyłamy Państwu wiadomości dotyczące rezerwacji (potwierdzenie, zmiany, informacje o przyjeździe) na wskazany adres e-mail. Są to komunikaty umowne i nie można z nich zrezygnować, dopóki rezerwacja istnieje. Wiadomości reklamowe otrzymują Państwo wyłącznie wtedy, gdy wyrazili Państwo zgodę lub gdy prawo dopuszcza to bez zgody; mogą Państwo w każdej chwili wnieść sprzeciw.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Prawa własności intelektualnej",
          paragraphs: [
            "Platforma, jej wygląd, oprogramowanie, bazy danych, teksty i znaki towarowe są chronione. Otrzymują Państwo niewyłączne, nieprzenoszalne prawo do korzystania z platformy w celu wyszukiwania i rezerwowania zakwaterowania — i nic ponadto.",
            "Korzystanie z naszych znaków towarowych i logo regulują [Zasady dotyczące znaków towarowych](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Jeżeli uważają Państwo, że treść na platformie narusza Państwa prawa autorskie, prosimy postępować zgodnie z [Zasadami dotyczącymi praw autorskich](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Co zrobić, gdy coś pójdzie nie tak",
          paragraphs: [
            "Jeżeli problem dotyczy samego zakwaterowania, prosimy zwrócić się najpierw do dostawcy — przez funkcję wiadomości albo na miejscu. Wiele problemów rozwiązuje się tak najszybciej.",
            "Jeżeli nie osiągną Państwo porozumienia z dostawcą albo problem dotyczy platformy, płatności lub obsługi rezerwacji, prosimy zwrócić się do nas. Jak nas zastać i jak rozpatrujemy reklamacje, opisano w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).",
            "Prosimy przygotować: numer rezerwacji, adres e-mail rezerwacji, krótki opis problemu wraz z oczekiwaniem co do naszej pomocy oraz odpowiednie dowody (zdjęcia, wiadomości, paragony).",
            "Jeżeli zakwaterowanie nie jest dostępne przy przyjeździe albo istotnie odbiega od ogłoszenia, stosuje się [Zasady przekwaterowania i zwrotów](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Platforma internetowego rozstrzygania sporów Komisji Europejskiej (platforma ODR) została uchylona rozporządzeniem (UE) 2024/3228 i zakończyła działalność; nie jest już dostępną drogą. Organy, które ją zastępują, wskazano w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).",
            "Jeżeli podjęliśmy środek wobec Państwa treści lub konta, obok naszej wewnętrznej procedury reklamacyjnej mogą Państwo zwrócić się do organu pozasądowego rozstrzygania sporów certyfikowanego zgodnie z art. 21 rozporządzenia (UE) 2022/2065. Jego decyzje nie są dla nas wiążące.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Środki wobec niewłaściwego zachowania",
          paragraphs: [
            "W razie naruszenia niniejszych warunków lub którejkolwiek z zasad wskazanych w A9 możemy — stopniowo, stosownie do wagi, częstotliwości i skutków naruszenia — usunąć treści lub ograniczyć ich widoczność, zablokować funkcje, anulować rezerwacje albo zawiesić Państwa konto czasowo lub trwale.",
            "Przed zastosowaniem środka badamy indywidualny przypadek. W przypadku treści oczywiście bezprawnych, zagrożenia dla osób lub oszustwa możemy działać natychmiast.",
            "Każdy środek uzasadniamy wobec Państwa i wskazujemy drogę reklamacyjną — zob. A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Zgłaszanie treści bezprawnych i uzasadnianie środków",
          paragraphs: [
            "Każdy może zgłosić nam treści, które uważa za bezprawne. Procedurę zgłaszania zgodnie z art. 16 rozporządzenia (UE) 2022/2065, nasze punkty kontaktowe oraz sposób rozpatrywania zgłoszeń opisano w [Akcie o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa).",
            "Jeżeli zastosujemy środek wobec zamieszczonych przez Państwa treści lub wobec Państwa konta, otrzymają Państwo uzasadnienie ze wskazaniem podstawy, stanu faktycznego, podstawy prawnej lub naruszonego postanowienia umownego oraz możliwości reklamacji.",
            "Przeciwko każdemu środkowi mogą Państwo w terminie sześciu miesięcy złożyć bezpłatną reklamację. Reklamacje rozpatrują ludzie, nie wyłącznie systemy automatyczne.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Ograniczenie odpowiedzialności",
          paragraphs: [
            "Odpowiadamy bez ograniczeń za winę umyślną i rażące niedbalstwo, za szkody wynikające z naruszenia życia, ciała lub zdrowia oraz w zakresie udzielonej przez nas gwarancji. Roszczenia z tytułu odpowiedzialności za produkt pozostają nienaruszone.",
            "W pozostałym zakresie nasza odpowiedzialność ogranicza się do przewidywalnej szkody wynikającej typowo z naruszenia obowiązków, na których wykonanie mogą Państwo polegać — i wyłącznie w zakresie, w jakim prawo właściwe dopuszcza takie ograniczenie.",
            "Nie odpowiadamy za wykonanie samej usługi noclegowej ani za zachowanie dostawców lub innych gości. Stroną umowy o usługę noclegową jest dostawca.",
            "Nie odpowiadamy za prawidłowość informacji zamieszczonych przez dostawców, o ile ich nie znaliśmy i nie musieliśmy znać. Gdy powzięliśmy wiedzę o informacji bezprawnej, działamy niezwłocznie.",
            "Dalej idąca odpowiedzialność jest wyłączona. Bezwzględnie obowiązujące roszczenia ustawowe, w szczególności prawa konsumenta, pozostają nienaruszone.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Prawo właściwe i jurysdykcja",
          paragraphs: [
            "Stosuje się prawo duńskie — operator ma siedzibę w Danii — z wyłączeniem Konwencji Narodów Zjednoczonych o umowach międzynarodowej sprzedaży towarów. Bezwzględnie obowiązujące przepisy o ochronie konsumentów państwa Państwa zwykłego pobytu pozostają nienaruszone zgodnie z art. 6 rozporządzenia (WE) nr 593/2008 (Rzym I).",
            "Jako konsument mogą Państwo pozwać nas przed sądem miejsca swojego zamieszkania albo przed sądem naszej siedziby w Danii; my możemy pozwać Państwa wyłącznie przed sądem miejsca Państwa zamieszkania (art. 17–19 rozporządzenia (UE) nr 1215/2012).",
            "Do umowy o zakwaterowanie stosuje się co do zasady prawo państwa, w którym znajduje się zakwaterowanie; dla powództw dotyczących najmu nieruchomości wyłącznie właściwe są sądy tego państwa.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Powiązane usługi turystyczne",
          paragraphs: [
            "myBestDays pośredniczy wyłącznie w usługach noclegowych. Nie oferujemy lotów, wynajmu samochodów, usług przewozowych, wycieczek ani atrakcji i nie tworzymy imprez turystycznych w rozumieniu dyrektywy (UE) 2015/2302.",
            "Gdybyśmy w przyszłości pośredniczyli w innych usługach turystycznych, poinformujemy Państwa przed rezerwacją, przy użyciu ustawowego standardowego formularza, czy powstaje impreza turystyczna lub powiązana usługa turystyczna oraz jakie prawa z tego wynikają.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Czas trwania, zawieszenie i wypowiedzenie",
          paragraphs: [
            "Umowa o korzystanie z platformy zawierana jest na czas nieokreślony. Mogą Państwo w każdej chwili usunąć konto bez podania przyczyny; istniejące rezerwacje pozostają nienaruszone i są realizowane zgodnie z warunkami danego dostawcy.",
            "Możemy wypowiedzieć umowę o korzystanie z zachowaniem 14-dniowego terminu. W razie ciężkiego naruszenia niniejszych warunków możemy wypowiedzieć umowę bez zachowania terminu i zablokować konto.",
            "Po zakończeniu usuwamy Państwa dane, o ile nie stoi temu na przeszkodzie ustawowy obowiązek przechowywania lub uzasadniony interes w ich zachowaniu; szczegóły reguluje [Polityka prywatności](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Klauzula zmian",
          paragraphs: [
            "Możemy zmienić niniejsze warunki, jeżeli istnieje ku temu obiektywny powód — na przykład zmiana stanu prawnego, orzecznictwo sądów najwyższych, nowe lub wycofane funkcje platformy albo uzupełnienie luk regulacyjnych.",
            "Zmiany zapowiadamy co najmniej 30 dni przed ich wejściem w życie w formie tekstowej. Jeżeli nie zgłoszą Państwo sprzeciwu przed wejściem w życie, zmienione warunki uważa się za przyjęte; na ten skutek zwracamy odrębnie uwagę w zapowiedzi. W razie sprzeciwu możemy wypowiedzieć umowę o korzystanie ze skutkiem na dzień wejścia zmian w życie.",
            "Do już zawartych rezerwacji stosuje się warunki w brzmieniu obowiązującym w chwili rezerwacji.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Zakwaterowanie",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Zakres niniejszej sekcji",
          paragraphs: [
            "Niniejsza sekcja dotyczy rezerwacji zakwaterowania za pośrednictwem platformy — zarówno obiektów wakacyjnych, jak i pokoi oraz jednostek obiektów noclegowych.",
            "Uzupełnia sekcję A. W razie sprzeczności pierwszeństwo ma niniejsza sekcja B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Stosunek umowny",
          paragraphs: [
            "Umowa o zakwaterowanie zawierana jest wyłącznie między Państwem a dostawcą. myBestDays nie jest stroną umowy.",
            "Prezentacja zakwaterowania na platformie stanowi zaproszenie do złożenia przez Państwa oferty rezerwacji. Kliknięcie przycisku rezerwacji z obowiązkiem zapłaty oznacza złożenie wiążącej oferty.",
            "Umowa dochodzi do skutku z chwilą potwierdzenia rezerwacji. Potwierdzenie rezerwacji wysyłamy na wskazany przez Państwa adres e-mail; zawiera ono dostawcę, zarezerwowaną usługę, okres, cenę całkowitą oraz warunki anulowania.",
            "W przypadku zakwaterowania z rezerwacją na zapytanie umowa dochodzi do skutku dopiero z chwilą akceptacji przez dostawcę. Do tego czasu Państwa środek płatniczy może zostać wstępnie autoryzowany, lecz nie obciążony.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Co robimy my",
          paragraphs: [
            "Udostępniamy platformę, prezentujemy ogłoszenia dostawców, przyjmujemy Państwa rezerwację, przekazujemy ją dostawcy i przesyłamy Państwu potwierdzenie rezerwacji.",
            "Obsługujemy płatność, o ile ogłoszenie przewiduje płatność za pośrednictwem platformy, i udostępniamy funkcję wiadomości między Państwem a dostawcą.",
            "Nie udostępniamy zakwaterowania, nie prowadzimy go i nie ręczymy za jego stan. Nie jesteśmy Państwa organizatorem turystyki.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Co muszą zrobić Państwo",
          paragraphs: [
            "Przed rezerwacją prosimy zapoznać się z całym ogłoszeniem: wyposażeniem, limitem obłożenia, godzinami przyjazdu i wyjazdu, regulaminem obiektu, warunkami anulowania oraz kosztami należnymi dopiero na miejscu.",
            "Prosimy przestrzegać maksymalnego obłożenia wskazanego w ogłoszeniu. Jeżeli przyjedzie więcej osób niż zarezerwowano, dostawca może odmówić przyjęcia lub zażądać dopłaty.",
            "Prosimy przestrzegać regulaminu obiektu dostawcy oraz [Zasad podstawowych dla gości](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Będą Państwo obchodzić się z zakwaterowaniem starannie i odpowiadają za szkody wyrządzone przez siebie lub współpodróżnych.",
            "Jeżeli dostawca lub organ potrzebuje danych do meldunku (np. karta meldunkowa, dane dokumentu tożsamości, deklaracja opłaty miejscowej), prosimy przekazać je w odpowiednim czasie.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Ceny i płatność",
          paragraphs: [
            "Cena całkowita obejmuje cenę noclegu za zarezerwowany okres oraz wskazane w ogłoszeniu dopłaty i opłaty rozliczane za pośrednictwem platformy.",
            "Na miejscu mogą wystąpić dodatkowe kwoty — w szczególności opłata miejscowa lub daniny lokalne, kaucja oraz usługi dodatkowe zamawiane dopiero na miejscu. Wskazujemy je jako koszty na miejscu przed finalizacją rezerwacji, o ile dostawca je podał.",
            "Jeżeli ogłoszenie przewiduje zaliczkę, pozostała kwota staje się wymagalna w terminie wskazanym w ogłoszeniu. W razie braku dopłaty dostawca może odstąpić od umowy zgodnie ze swoimi warunkami anulowania.",
            "Nie przyjmujemy i nie możemy prześledzić płatności na rzecz dostawcy dokonanych poza platformą; nie są objęte naszą obsługą płatności — zob. [Opłaty poza platformą](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Zmiany, anulowania i zwroty",
          paragraphs: [
            "To, czy i na jakich warunkach rezerwację można bezpłatnie anulować lub zmienić, zależy od warunków anulowania dostawcy wskazanych w ogłoszeniu. Warunki, które udostępniamy dostawcom, opisano w [Warunkach anulowania](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "W przypadku usług noclegowych rezerwowanych na określony okres co do zasady nie przysługuje ustawowe prawo odstąpienia zgodnie z art. 16 lit. l) dyrektywy 2011/83/UE lub odpowiednimi przepisami krajowymi. Bezwzględnie obowiązujące prawa ustawowe pozostają nienaruszone.",
            "Jeżeli anuluje dostawca, zwracamy w całości kwotę zapłaconą za pośrednictwem platformy. Dodatkowo stosuje się [Zasady przekwaterowania i zwrotów](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Jeżeli zdarzenie pozostające poza kontrolą obu stron uniemożliwia podróż lub pobyt, stosuje się [Zasady przy poważnych zakłóceniach](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Zwroty następują na środek płatniczy użyty do zapłaty, o ile nie uzgodniono inaczej.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Co jeszcze warto wiedzieć",
          paragraphs: [
            "Dostawcami mogą być gospodarze prywatni albo przedsiębiorcy. To, czy dostawca występuje jako przedsiębiorca, wskazujemy w ogłoszeniu. Jeżeli nie jest przedsiębiorcą, unijne przepisy o ochronie konsumentów nie mają zastosowania do umowy o zakwaterowanie — zwracamy na to uwagę w ogłoszeniu.",
            "Informacje o położeniu, otoczeniu, odległościach i ocenach osób trzecich mają charakter orientacyjny. Wiążące są informacje o samej zarezerwowanej usłudze.",
            "Na obszarach objętych obowiązkiem rejestracji najmu krótkoterminowego wskazujemy w ogłoszeniu numer rejestracyjny podany przez dostawcę; zob. [Najem krótkoterminowy](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Przy kilku identycznych jednostkach danego typu obiektu lub pokoju rezerwują Państwo jedną jednostkę tego typu. O tym, którą konkretną jednostkę Państwo otrzymają, decyduje dostawca.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Słownik",
      paragraphs: [
        "Poniższe pojęcia mają w niniejszych warunkach wskazane tu znaczenie.",
      ],
      definitions: [
        {
          term: "Dostawca",
          description:
            "Osoba fizyczna lub prawna oferująca zakwaterowanie za pośrednictwem platformy i stająca się stroną umowy o zakwaterowanie.",
        },
        {
          term: "Rezerwacja na zapytanie",
          description:
            "Rezerwacja dochodząca do skutku dopiero po wyraźnej akceptacji dostawcy, w odróżnieniu od rezerwacji natychmiastowej.",
        },
        {
          term: "Potwierdzenie rezerwacji",
          description:
            "Wiadomość, którą potwierdzamy zawarcie umowy o zakwaterowanie; zawiera dostawcę, usługę, okres, cenę całkowitą i warunki anulowania.",
        },
        {
          term: "Jednostka",
          description:
            "Konkretny rezerwowalny obiekt w ramach typu obiektu lub pokoju. Sprzedaje się jednostkę, opisuje i wycenia typ.",
        },
        {
          term: "Cena całkowita",
          description:
            "Kwota wskazana przy finalizowaniu rezerwacji, obejmująca wszystkie podatki i wszystkie opłaty rozliczane za pośrednictwem platformy.",
        },
        {
          term: "Maksymalne obłożenie",
          description:
            "Wskazana w ogłoszeniu największa dopuszczalna liczba osób mogących nocować w zakwaterowaniu.",
        },
        {
          term: "Kaucja",
          description:
            "Kwota żądana przez dostawcę jako zabezpieczenie na wypadek szkód, wstępnie autoryzowana lub pobrana i po pobycie zwalniana albo rozliczana.",
        },
        {
          term: "Opłata miejscowa",
          description:
            "Lokalna danina od noclegów pobierana — zależnie od gminy — na miejscu albo za pośrednictwem dostawcy; nie jest świadczeniem myBestDays.",
        },
        {
          term: "Platforma",
          description:
            "Strona internetowa, aplikacje mobilne i wszelkie inne kanały dostępu, za pośrednictwem których myBestDays prezentuje zakwaterowanie i pośredniczy w rezerwacjach.",
        },
        {
          term: "Opłata serwisowa",
          description:
            "Wynagrodzenie za usługę pośrednictwa myBestDays. Kto ją ponosi i jak jest wskazywana, opisano w Opłatach serwisowych.",
        },
        {
          term: "Warunki anulowania",
          description:
            "Wybrane przez dostawcę zasady określające, do kiedy i po jakim koszcie rezerwację można anulować lub zmienić.",
        },
        {
          term: "Zakwaterowanie",
          description:
            "Usługa noclegowa oferowana przez dostawcę — obiekt wakacyjny albo jednostka danego typu pokoju lub obiektu.",
        },
        {
          term: "Koszty na miejscu",
          description:
            "Kwoty nierozliczane za pośrednictwem platformy, lecz płatne dostawcy, takie jak opłata miejscowa, kaucja czy usługi dodatkowe zamówione na miejscu.",
        },
      ],
    },
  ],
};
