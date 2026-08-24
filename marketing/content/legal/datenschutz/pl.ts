// Polnische Fassung der Datenschutzerklärung.
//
// Referenz ist content/legal/datenschutz/de.ts — INHALTLICHE Änderungen gehören
// ZUERST dorthin und werden von dort in alle Sprachfassungen nachgezogen. Diese
// Datei hat dieselbe Struktur wie de.ts (20 Abschnitte, gleiche Absatzzahlen);
// Firmen-, Register-, Dienstleister- und Rechtsakt-Bezeichnungen bleiben
// unübersetzt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Polityka prywatności",
  metaDescription:
    "Jak myNextDays przetwarza dane osobowe: cele, podstawy prawne, odbiorcy, okresy przechowywania oraz Państwa prawa wynikające z RODO.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Niniejsza polityka opisuje, w jaki sposób ${ANBIETER.firma} przetwarza dane osobowe — podczas odwiedzania tej witryny, podczas korzystania z platformy myNextDays (pulpit, marketplace i aplikacja mobilna) oraz w ramach relacji handlowej z naszymi klientami.`,
    "Podstawą jest rozporządzenie (UE) 2016/679 (RODO) oraz duńska ustawa o ochronie danych (databeskyttelsesloven). Nie sprzedajemy danych, nie tworzymy profili i nie stosujemy na naszych witrynach usług analitycznych, śledzących ani reklamowych. W celach reklamowych przetwarzamy dane wyłącznie tam, gdzie wyrazili Państwo na to wyraźną zgodę — a mianowicie w odniesieniu do naszego newslettera (zob. rozdział Komunikacja), z którego w każdej chwili można się wypisać jednym kliknięciem.",
  ],
  sections: [
    {
      heading: "Administrator danych",
      paragraphs: [
        "Administratorem w odniesieniu do operacji przetwarzania opisanych w niniejszej polityce jest:",
      ],
      zeilen: [
        {
          label: "Przedsiębiorstwo",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Adres",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Zakres obowiązywania i role",
      unterpunkte: [
        {
          paragraphs: [
            "W odniesieniu do odwiedzania tej witryny, do Państwa konta klienta oraz do realizacji naszej relacji handlowej jesteśmy administratorem w rozumieniu art. 4 pkt 7 RODO.",
          ],
        },
        {
          paragraphs: [
            "W odniesieniu do danych, które nasi klienci (wynajmujący, hotele, agencje) przetwarzają na platformie o swoich gościach, właścicielach i pracownikach, administratorami są klienci, a my jesteśmy podmiotem przetwarzającym w rozumieniu art. 28 RODO. Szczegóły określa [umowa o powierzeniu przetwarzania danych](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Jeżeli jako gość rezerwują Państwo nocleg za pośrednictwem naszego marketplace’u, przetwarzamy Państwa dane rezerwacyjne i kontaktowe zarówno w imieniu własnym (prowadzenie marketplace’u, obsługa płatności), jak i na rzecz przedsiębiorstwa udzielającego gościny. Umowa o zakwaterowanie zostaje zawarta wyłącznie z tym przedsiębiorstwem; obok niniejszej polityki obowiązują jego własne informacje o ochronie danych.",
          ],
        },
      ],
    },
    {
      heading: "Odwiedzanie tej witryny",
      unterpunkte: [
        {
          titel: "Pliki dziennika serwera",
          paragraphs: [
            "Przy każdym wywołaniu Państwa przeglądarka przekazuje dane niezbędne technicznie, które nasz serwer internetowy zapisuje w dzienniku: adres IP, datę i godzinę, wywołany adres, ilość przesłanych danych, kod statusu, stronę odsyłającą oraz identyfikator przeglądarki. Celem jest udostępnienie strony oraz rozpoznawanie i odpieranie ataków i zakłóceń. Podstawą prawną jest art. 6 ust. 1 lit. f) RODO; nasz prawnie uzasadniony interes polega na bezpiecznym i stabilnym działaniu. Dzienniki są przechowywane tylko tak długo, jak jest to konieczne dla działania i bezpieczeństwa, i nie są łączone z innymi danymi.",
          ],
        },
        {
          titel: "Czcionki",
          paragraphs: [
            "Wykorzystywane czcionki są osadzone lokalnie na naszym serwerze. Nie następuje żadne połączenie z Google Fonts ani z inną usługą czcionek.",
          ],
        },
        {
          titel: "Ikony",
          paragraphs: [
            "Ikony tej witryny, podobnie jak czcionki, znajdują się u nas: są wstawiane do strony na naszym serwerze i nie są doczytywane z usługi ikon. Nie następuje przy tym żadne połączenie z podmiotem trzecim, a Państwa adres IP nie jest nikomu przekazywany.",
          ],
        },
        {
          titel: "Ochrona formularza kontaktowego przed spamem (reCAPTCHA)",
          paragraphs: [
            "Nasz formularz kontaktowy jest zabezpieczony przed automatycznymi masowymi wiadomościami za pomocą reCAPTCHA Enterprise firmy Google Ireland Limited. Tylko jeżeli wyrażą Państwo na to zgodę, Państwa przeglądarka wczytuje przy wypełnianiu formularza skrypt z www.google.com; przekazywane są przy tym do Google Państwa adres IP oraz informacje o Państwa interakcji z formularzem i tam analizowane, aby odróżnić człowieka od skryptu. Podstawą prawną jest art. 6 ust. 1 lit. a) RODO (zgoda); dodatkowo obowiązuje [polityka prywatności Google](https://policies.google.com/privacy).",
            "Bez Państwa zgody nic nie jest wczytywane z Google i nie płyną tam żadne dane; formularza wtedy nie przyjmujemy, mogą jednak Państwo w każdej chwili napisać do nas wiadomość e-mail. Swoją zgodę mogą Państwo zmienić lub odwołać w [polityce plików cookie](/cookie-richtlinie).",
          ],
        },
        {
          titel: "Brak analityki, brak reklamy",
          paragraphs: [
            "Nie stosujemy usług analitycznych, śledzących ani reklamowych (bez Google Analytics, bez pikseli, bez sieci reklamowych) i nie tworzymy profili. Które pliki cookie są platformie potrzebne technicznie, opisuje [polityka plików cookie](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Konto klienta i korzystanie z platformy",
      paragraphs: [
        "W celu rejestracji i prowadzenia konta przetwarzamy dane, które wprowadzają Państwo lub Państwa przedsiębiorstwo: imię i nazwisko, firmę i formę prawną, adres, adres e-mail, numer telefonu, rolę i uprawnienia, dane rejestrowe (np. numer w rejestrze handlowym lub numer VAT), rachunek bankowy do wypłat oraz treści zakładane na koncie.",
        "W celu zabezpieczenia dostępu przetwarzamy ponadto dzienniki logowania (moment, adres IP, urządzenie i przeglądarkę użyte przy logowaniu) oraz — jeżeli została włączona — dane uwierzytelniania dwuskładnikowego.",
        "Logowanie przez Google: zamiast adresu e-mail i hasła mogą Państwo zalogować się także za pomocą konta Google. Jeżeli wybiorą Państwo tę drogę, otrzymujemy od Google Ireland Limited wyłącznie Państwa adres e-mail, imię i nazwisko, zdjęcie profilowe oraz identyfikator Państwa konta Google (zakresy „openid”, „email”, „profile”) — wyraźnie żadnego dostępu do Państwa wiadomości, kontaktów, plików ani kalendarza. Państwa hasła do Google nie poznajemy. Google przetwarza przy tym proces logowania jako samodzielny administrator; obowiązuje [polityka prywatności Google](https://policies.google.com/privacy). Podstawą prawną jest art. 6 ust. 1 lit. b) RODO, ponieważ logowanie służy wykonaniu umowy; wybór tej drogi logowania jest dobrowolny i w każdej chwili można go zastąpić logowaniem za pomocą adresu e-mail i hasła.",
        "Podstawą prawną jest art. 6 ust. 1 lit. b) RODO (wykonanie umowy o korzystanie, zob. [Regulamin](" +
          AGB_URL +
          ")), w odniesieniu do zabezpieczenia dostępu art. 6 ust. 1 lit. f) RODO, a w odniesieniu do przechowywania na potrzeby prawa podatkowego i handlowego art. 6 ust. 1 lit. c) RODO.",
      ],
    },
    {
      heading: "Rezerwacje, dane gości i dane obiektów",
      paragraphs: [
        "Za pośrednictwem platformy przetwarzane są rezerwacje, dane gości, wiadomości, zadania i rozliczenia. Należą do nich w szczególności imię i nazwisko oraz dane kontaktowe gościa, przyjazd i wyjazd, liczba podróżnych, ceny i status płatności, historia wiadomości oraz — o ile przedsiębiorstwo je zbiera — dane meldunkowe i życzenia szczególne.",
        "Przetwarzanie to odbywa się na zlecenie i według polecenia danego przedsiębiorstwa. Nie wykorzystujemy tych danych do własnych celów, do reklamy ani do trenowania modeli SI.",
        "W ramach jednego przedsiębiorstwa dane są rozdzielone według ról: pracownicy sprzątający i serwisowi nie widzą danych finansowych ani sprzedażowych, właściciele — wyłącznie swoje własne obiekty. Pomiędzy różnymi przedsiębiorstwami dane są rozdzielone technicznie (reguły dostępu przypisane do najemcy bezpośrednio w bazie danych).",
      ],
    },
    {
      heading: "Obsługa płatności",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Płatności kartą i wypłaty realizowane są przez Stripe Payments Europe, Limited, Irlandia. Przekazywane są przy tym do Stripe dane niezbędne do płatności (kwota, waluta, środek płatniczy, imię i nazwisko, adres e-mail, numer referencyjny rezerwacji), a w odniesieniu do kont naszych klientów — wymagane prawem dane identyfikacyjne (posiadacz, beneficjenci rzeczywiści, dane dokumentu tożsamości, rachunek bankowy). Pełne dane karty nie docierają do naszych systemów. Podstawami prawnymi są art. 6 ust. 1 lit. b) RODO oraz, w odniesieniu do obowiązków identyfikacyjnych i przeciwdziałania praniu pieniędzy, art. 6 ust. 1 lit. c) RODO. Szczegóły reguluje [polityka prywatności Stripe](https://stripe.com/privacy).",
            "Linki do płatności za usługi dodatkowe: jeżeli przedsiębiorstwo wystawia gościowi rachunek za usługę dodatkową (np. sprzątanie lub pranie) za pomocą linku do płatności, link ten prowadzi na stronę płatności prowadzoną przez Stripe. Przekazujemy do Stripe nazwę usługi, kwotę, walutę oraz wewnętrzny numer referencyjny rezerwacji i przedsiębiorstwa; logo przedsiębiorstwa jest przenoszone na jego konto Stripe, aby strona pokazywała jego markę. Na samej stronie płatności Stripe zbiera dane płatnicze i dane urządzenia gościa na własną odpowiedzialność. Do nas wracają wyłącznie status płatności, kwota, kwoty zatrzymane oraz identyfikatory płatności — żadnych danych karty.",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Jeżeli przedsiębiorstwo oferuje PayPal jako metodę płatności, dane płatnicze są przekazywane do PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburg. Obowiązuje [polityka prywatności PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Kanały sprzedaży i portale",
      paragraphs: [
        "Jeżeli przedsiębiorstwo sprzedaje swoje obiekty przez portale takie jak Booking.com, Airbnb czy Expedia, dostępność, ceny, restrykcje i dane rezerwacyjne są wymieniane z danym portalem za pośrednictwem naszego usługodawcy integracyjnego Channex.io Ltd, Zjednoczone Królestwo. Z tego kierunku otrzymujemy dane rezerwacyjne i dane gości z portalu.",
        "W odniesieniu do danego portalu obowiązują jego własne postanowienia o ochronie danych; w tym zakresie portal jest samodzielnym administratorem. Podstawą prawną przekazania jest art. 6 ust. 1 lit. b) RODO w związku ze zleceniem przedsiębiorstwa.",
      ],
    },
    {
      heading: "Komunikacja",
      unterpunkte: [
        {
          titel: "E-mail",
          paragraphs: [
            "Wiadomości e-mail w ramach korzystania (potwierdzenia rezerwacji, komunikaty systemowe, wsparcie, linki potwierdzające i zaproszenia) wysyłamy i odbieramy za pośrednictwem własnego serwera pocztowego, który sami prowadzimy. Do tych wiadomości nie jest włączona żadna zewnętrzna usługa wysyłkowa.",
          ],
        },
        {
          titel: "Newsletter i zapisy przedpremierowe",
          paragraphs: [
            "Na naszej witrynie mogą Państwo zapisać się na informacje o myNextDays (zapis przedpremierowy/newsletter). Przetwarzane są przy tym Państwa adres e-mail, język oraz miejsce, w którym dokonano zapisu.",
            "Zapis odbywa się w procedurze double opt-in: po zapisaniu się otrzymują Państwo wiadomość e-mail z linkiem potwierdzającym; zapis staje się skuteczny dopiero po kliknięciu tego linku. Na potrzeby wykazania zgody zapisujemy moment zapisu i potwierdzenia, użyty przy tym adres IP, identyfikator przeglądarki oraz treść, na którą Państwo się zgodzili. Dane te służą wyłącznie wykazaniu zgody zgodnie z art. 7 ust. 1 RODO i nie są analizowane w celach reklamowych.",
            "Podstawą prawną jest Państwa zgoda zgodnie z art. 6 ust. 1 lit. a) RODO; przechowywanie dowodu zgody opieramy na art. 6 ust. 1 lit. c) w związku z art. 7 ust. 1 RODO. Zgodę mogą Państwo w każdej chwili odwołać ze skutkiem na przyszłość — za pomocą linku do wypisania się w każdej wiadomości newslettera lub w dowolnej formie pocztą elektroniczną. Odwołanie nie wpływa na zgodność z prawem przetwarzania dokonanego do tego momentu.",
            "Do zarządzania newsletterem i jego wysyłki korzystamy z Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Francja; oddział niemiecki: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) jako podmiotu przetwarzającego. Przekazywane są Państwa adres e-mail oraz wymienione informacje dodatkowe (język, źródło). Dane są przetwarzane na serwerach w Unii Europejskiej (Francja i Niemcy); z Brevo zawarta jest umowa o powierzeniu przetwarzania danych zgodnie z art. 28 RODO. Obowiązuje [polityka prywatności Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Gdy wysyłamy newsletter, Brevo mierzy na nasze zlecenie, czy wiadomość została otwarta i czy kliknięto zawarte w niej linki. Pomiar ten pomaga nam dostosowywać treść i częstotliwość; jest częścią zgody i kończy się z chwilą wypisania się. Łączenie z innymi źródłami danych ani profilowanie nie ma miejsca.",
            "Dopóki brak potwierdzenia, na Państwa adres nie są wysyłane wiadomości i nie jest on przekazywany do Brevo; niepotwierdzony zapis wygasa po siedmiu dniach. Po wypisaniu się blokujemy adres do wysyłki i przechowujemy dowód zgody oraz wypisania się tak długo, jak długo mogą być z nich podnoszone roszczenia; na żądanie usuwamy go w całości.",
          ],
        },
        {
          titel: "Wiadomości na platformie",
          paragraphs: [
            "Wiadomości między gościem a przedsiębiorstwem są przechowywane na platformie, aby obie strony mogły przeglądać ich historię. Jeżeli przedsiębiorstwo zablokuje gościa, kanał wiadomości zostaje zamknięty; istniejące wiadomości pozostają zachowane dla możliwości odtworzenia przebiegu.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Jeżeli przedsiębiorstwo korzysta z integracji z WhatsApp, treści wiadomości oraz numery telefonów uczestników są przekazywane przez WhatsApp Business Platform firmy Meta Platforms Ireland Limited. O korzystaniu z tej funkcji decyduje przedsiębiorstwo; bez jej włączenia nie następuje żadne przekazanie.",
          ],
        },
      ],
    },
    {
      heading: "Funkcje zautomatyzowane i sztuczna inteligencja",
      paragraphs: [
        "Do funkcji opisanych w tym miejscu obok RODO stosuje się rozporządzenie (UE) 2024/1689 (akt w sprawie sztucznej inteligencji, „AI Act”), którego obowiązki w zakresie przejrzystości wynikające z art. 50 mają zastosowanie od 2 sierpnia 2026 r.",
      ],
      unterpunkte: [
        {
          titel: "Propozycje odpowiedzi",
          paragraphs: [
            "Do propozycji odpowiedzi w skrzynce wiadomości wykorzystujemy — o ile funkcja jest włączona dla przedsiębiorstwa — ofertę modeli językowych firmy Groq, Inc., USA. Przekazywany jest przy tym dany kontekst wiadomości. Propozycje nie są wysyłane automatycznie; o wysłaniu zawsze decyduje człowiek. Zautomatyzowane podejmowanie decyzji o skutku prawnym w rozumieniu art. 22 RODO nie ma miejsca.",
            "Nie jest to zatem system SI, który w rozumieniu art. 50 ust. 1 aktu w sprawie sztucznej inteligencji wchodzi w bezpośrednią interakcję z osobami fizycznymi: obowiązek ten zakłada BEZPOŚREDNIĄ interakcję, w której SI sama komunikuje się z osobą, a nie za pośrednictwem człowieka. Tutaj funkcja proponuje przedsiębiorstwu tekst, który pracownik sprawdza, może zmienić i sam wysyła — pracownik jest tym pośrednikiem, gość koresponduje z przedsiębiorstwem, a nie z chatbotem. Asystent odpowiadający automatycznie nie jest stosowany. Zgodnie z naszą oceną funkcja nie spełnia również żadnej z przesłanek SI wysokiego ryzyka według załącznika III do aktu w sprawie sztucznej inteligencji.",
            "Wiadomości do gości nie są ponadto „tekstem w sprawach interesu publicznego” w rozumieniu art. 50 ust. 4 aktu w sprawie sztucznej inteligencji: nie są publikowane, lecz wysyłane indywidualnie do określonej osoby i dotyczą obsługi pobytu. Niezależnie od tego obowiązuje tu kontrola ludzka sprawowana przez wysyłającego pracownika.",
            "Gdyby w przyszłości oferowana była funkcja, która samodzielnie — bez zatwierdzenia przez człowieka — odpowiada gościom, gość zostanie na początku dialogu w widoczny sposób poinformowany, że pisze z systemem SI. Bez takiej informacji funkcja ta nie zostanie udostępniona.",
          ],
        },
        {
          titel: "Role według aktu w sprawie sztucznej inteligencji",
          paragraphs: [
            "W odniesieniu do funkcji SI wbudowanych w produkt jesteśmy podmiotem stosującym w rozumieniu art. 3 pkt 4 aktu w sprawie sztucznej inteligencji; dostawcami leżących u ich podstaw modeli językowych są poszczególni dostawcy modeli. Jeżeli przedsiębiorstwo korzysta z tych funkcji w ramach swojej działalności zawodowej, samo jest w tym zakresie podmiotem stosującym i ciąży na nim obowiązek zapewnienia kompetencji w zakresie SI zgodnie z art. 4 aktu w sprawie sztucznej inteligencji, który obowiązuje od 2 lutego 2025 r. niezależnie od wielkości przedsiębiorstwa. Od 27 lipca 2026 r. obowiązuje on w brzmieniu rozporządzenia (UE) 2026/1744: dostawcy i podmioty stosujące podejmują środki wspierające rozwój kompetencji swojego personelu w zakresie SI; wyraźnie nie muszą przy tym gwarantować określonego poziomu. Wspieramy poprzez wskazówki w aplikacji i w naszym centrum pomocy; szkolenie własnych pracowników pozostaje zadaniem przedsiębiorstwa.",
            "Jeżeli przedsiębiorstwo połączy swoje konto z własnym asystentem SI (zob. następny punkt), jest również w tym zakresie podmiotem stosującym w rozumieniu aktu w sprawie sztucznej inteligencji — decyduje o zastosowaniu i formułuje zapytania. Sam interfejs nie jest systemem SI: odczytuje dane z bazy danych i je wydaje, nie wyciągając wniosków; motyw 12 aktu w sprawie sztucznej inteligencji wyraźnie odgranicza takie systemy od SI.",
          ],
        },
        {
          titel: "Połączenie z własnym asystentem SI",
          paragraphs: [
            "Przedsiębiorstwo może połączyć swoje konto przez interfejs z asystentem SI, którego samo wybrało i z którym ma własną umowę — na przykład Claude firmy Anthropic PBC, USA. Jeżeli takie połączenie zostało udzielone, asystent może na zapytanie przedsiębiorstwa odczytywać: obłożenie, dostępność i ceny dzienne; rezerwacje z nazwiskiem gościa, okresem pobytu, obiektem, kanałem rezerwacji, statusem oraz kwotą i walutą, o ile rola pytającego konta może widzieć kwoty; a także przegląd rozmów w skrzynce wiadomości. Bez udzielonego połączenia nie następuje żadne przekazanie.",
            "Nie są przy tym przekazywane adresy e-mail ani numery telefonów gości, dane kart, rachunki bankowe i dowody zapłaty, kody dostępu oraz dokumentacja obiektów. Notatki do rezerwacji i treść wiadomości od gości są domyślnie wyłączone, ponieważ mogą zawierać informacje o zdrowiu lub inne szczególne kategorie danych w rozumieniu art. 9 RODO; przedsiębiorstwo musi je przy udzielaniu połączenia wyraźnie i odrębnie udostępnić.",
            "Połączenia może udzielić wyłącznie konto z rolą „administrator”, a nie każde konto z dostępem. Każde odczytanie jest rejestrowane i dostępne dla przedsiębiorstwa w „Konto → Połączenia”; może ono tam w każdej chwili rozłączyć połączenie, a dostęp kończy się wówczas natychmiast.",
            "Pod względem prawnym przekazanie to jest poleceniem przedsiębiorstwa skierowanym do nas (art. 28 ust. 3 lit. a) RODO). Dostawca asystenta nie jest naszym dalszym podmiotem przetwarzającym — nie zlecamy mu niczego i nie wydajemy mu polecenia; przetwarza on dane na podstawie umowy, którą przedsiębiorstwo zawarło z nim samodzielnie. Za podstawę prawną tego przetwarzania, za poinformowanie swoich gości oraz za gwarancje przekazania do państwa trzeciego odpowiada zatem przedsiębiorstwo.",
          ],
        },
        {
          titel: "Tłumaczenia",
          paragraphs: [
            "Teksty obiektów i treści mogą być tłumaczone za pomocą Cloud Translation API firmy Google Ireland Limited. Przekazywane są przy tym teksty do przetłumaczenia; dane osobowe wyłącznie w takim zakresie, w jakim są w tych tekstach zawarte.",
          ],
        },
        {
          titel: "Rekomendacje cenowe",
          paragraphs: [
            "Na potrzeby rekomendacji cenowych korzystamy z danych rynkowych, pogodowych i kursowych ze źródeł zewnętrznych. Zapytania te nie zawierają danych osobowych, a wyłącznie miejsce, okres i cechy obiektu.",
          ],
        },
      ],
    },
    {
      heading: "Witryny i domeny naszych klientów",
      paragraphs: [
        "Jeżeli przedsiębiorstwo tworzy za pomocą kreatora własną witrynę z własną domeną, zarządzamy niezbędnymi do tego wpisami DNS za pośrednictwem Cloudflare, Inc. Przekazywane są przy tym dane domeny i konfiguracji; dane odwiedzających witrynę klienta przetwarzamy w sposób opisany w niniejszej polityce.",
        "Za treści, dane identyfikacyjne wydawcy oraz informacje o ochronie danych na witrynie klienta odpowiada dane przedsiębiorstwo.",
      ],
    },
    {
      heading: "Hosting i przechowywanie",
      paragraphs: [
        "Platforma, baza danych, media i serwer pocztowy działają na serwerach Hetzner Online GmbH, Niemcy, w centrum danych w Helsinkach (Finlandia) — a więc w Unii Europejskiej. Z Hetzner zawarta jest umowa o powierzeniu przetwarzania danych.",
        "Kopie zapasowe są tworzone w formie zaszyfrowanej i przechowywane w formie zaszyfrowanej u dostawcy przestrzeni dyskowej w UE.",
      ],
    },
    {
      heading: "Odbiorcy w przeglądzie",
      paragraphs: [
        "Poza wymienionymi usługodawcami przekazujemy dane osobowe wyłącznie wtedy, gdy jesteśmy do tego prawnie zobowiązani (np. organy podatkowe, organy ścigania) albo gdy Państwo lub odpowiedzialne przedsiębiorstwo tego żądają.",
      ],
      list: [
        "Hetzner Online GmbH (Niemcy/Finlandia) — hosting, baza danych, media, serwer pocztowy",
        "Stripe Payments Europe, Limited (Irlandia) — płatności, wypłaty, weryfikacja tożsamości",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luksemburg) — płatności, o ile włączone",
        "Channex.io Ltd (Zjednoczone Królestwo) — integracja z portalami rezerwacyjnymi",
        "Meta Platforms Ireland Limited (Irlandia) — wiadomości WhatsApp, o ile włączone",
        "Sendinblue SAS / Brevo (Francja, Niemcy) — zarządzanie newsletterem i jego wysyłka, wyłącznie za zgodą",
        "Google Ireland Limited (Irlandia) — tłumaczenia; ochrona formularza kontaktowego przed spamem (reCAPTCHA Enterprise), wyłącznie za zgodą; logowanie przez Google, o ile wykorzystywane",
        "Groq, Inc. (USA) — propozycje odpowiedzi, o ile włączone",
        "Cloudflare, Inc. (USA) — zarządzanie DNS dla domen klientów",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Na tej liście nie ma usług, które przedsiębiorstwo samo uzgadnia z podmiotem trzecim i łączy przez interfejs ze swoim kontem — na przykład asystenta SI takiego jak Claude firmy Anthropic PBC, USA. Nie są to usługodawcy, którym my zlecamy przetwarzanie, lecz odbiorcy działający na polecenie danego przedsiębiorstwa; bez jego połączenia nie płyną tam żadne dane. Anthropic nie jest, zgodnie z oficjalną listą uczestników Departamentu Handlu USA, certyfikowany w ramach EU-US Data Privacy Framework; przekazanie opiera się zatem na standardowych klauzulach ochrony danych, za które odpowiada dane przedsiębiorstwo jako administrator.",
          ],
        },
      ],
    },
    {
      heading: "Przekazywanie do państw trzecich",
      paragraphs: [
        "Przetwarzanie odbywa się zasadniczo na terytorium UE. W przypadku wymienionych powyżej usług z siedzibą poza UE może dojść do przekazania do państwa trzeciego.",
        "W przypadku Groq, Inc. i Cloudflare, Inc. (USA) opieramy przekazanie na standardowych klauzulach ochrony danych Komisji Europejskiej zgodnie z art. 46 ust. 2 lit. c) RODO, o ile odbiorca nie może powołać się na decyzję stwierdzającą odpowiedni stopień ochrony (EU-US Data Privacy Framework).",
        "Partnerem umownym w zakresie obsługi płatności jest Stripe Payments Europe, Limited (Irlandia). W zakresie, w jakim Stripe korzysta przy tym z Stripe, LLC (USA), podmiot ten jest certyfikowany w ramach EU-US Data Privacy Framework; przekazanie opiera się w tym zakresie na decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony zgodnie z art. 45 RODO. Dodatkowo obowiązują standardowe klauzule ochrony danych z [umowy o powierzeniu przetwarzania danych Stripe](https://stripe.com/legal/dpa).",
        "W przypadku Channex.io Ltd (Zjednoczone Królestwo) obowiązuje decyzja Komisji Europejskiej stwierdzająca odpowiedni stopień ochrony dla Zjednoczonego Królestwa; w razie jej wygaśnięcia zastosowanie mają standardowe klauzule ochrony danych.",
      ],
    },
    {
      heading: "Dostęp organów państw trzecich (US CLOUD Act)",
      paragraphs: [
        "Dostawcy podlegający jurysdykcji Stanów Zjednoczonych mogą na podstawie amerykańskiej ustawy CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) zostać zobowiązani do wydania danych organom USA — również wtedy, gdy dane te znajdują się na serwerach w Unii Europejskiej. Taki dostęp może być sprzeczny z RODO, a dostawcy może być prawnie zabronione informowanie nas lub Państwa o nim. Ani decyzja stwierdzająca odpowiedni stopień ochrony w ramach EU-US Data Privacy Framework, ani standardowe klauzule ochrony danych nie wykluczają tego ryzyka.",
        "Ograniczamy to ryzyko w ten sposób, że systemy nośne — platforma, baza danych, media, serwer pocztowy i kopie zapasowe — są prowadzone u dostawców europejskich na terytorium UE, gdzie jurysdykcja USA nie obowiązuje.",
      ],
      unterpunkte: [
        {
          titel: "Usługi objęte",
          paragraphs: [
            "Jurysdykcja USA może wchodzić w rachubę wyłącznie w przypadku następujących, wyraźnie wyodrębnionych usług dodatkowych:",
          ],
          list: [
            "Groq, Inc. (USA) — propozycje odpowiedzi w skrzynce wiadomości, wyłącznie gdy przedsiębiorstwo włączy tę funkcję. Przekazywany jest dany kontekst wiadomości.",
            "Cloudflare, Inc. (USA) — zarządzanie DNS dla domen klientów. Przekazywane są dane domeny i konfiguracji, bez danych gości.",
            "Google LLC (USA) — wyłącznie przy logowaniu przez Google i przy tłumaczeniach; partnerem umownym jest każdorazowo Google Ireland Limited, dostęp amerykańskiej spółki matki nie jest jednak wykluczony.",
          ],
        },
        {
          titel: "Możliwość uniknięcia",
          paragraphs: [
            "Korzystanie z platformy jest możliwe bez tych usług: propozycje odpowiedzi można wyłączyć, zarządzanie DNS dotyczy wyłącznie klientów z własną domeną, a logowanie przez Google jest dobrowolną alternatywą dla logowania za pomocą adresu e-mail i hasła.",
          ],
        },
        {
          titel: "Odgraniczenie od prawa europejskiego",
          paragraphs: [
            "CLOUD Act jest prawem Stanów Zjednoczonych, a nie prawem Unii Europejskiej. Należy go odróżniać od EU Data Act (rozporządzenie (UE) 2023/2854), które reguluje zmianę dostawcy i przenoszenie danych w usługach przetwarzania danych, a także od Cloud and AI Development Act, który na dzień sporządzenia niniejszej polityki znajduje się w europejskim procesie legislacyjnym.",
          ],
        },
      ],
    },
    {
      heading: "Okresy przechowywania",
      list: [
        "Dane konta: przez czas trwania relacji handlowej; następnie usunięcie, o ile nie istnieje obowiązek przechowywania.",
        "Dane rezerwacyjne, fakturowe i płatnicze: zgodnie z duńską ustawą o rachunkowości pięć lat po zakończeniu roku obrotowego, do którego należy je przypisać; w przypadku klientów z siedzibą w Niemczech mogą obowiązywać dłuższe terminy wynikające z prawa handlowego i podatkowego.",
        "Wiadomości i dane gości na platformie: według polecenia odpowiedzialnego przedsiębiorstwa, najdłużej do ich usunięcia przez to przedsiębiorstwo lub do zakończenia umowy.",
        "Newsletter: do odwołania zgody; niepotwierdzone zapisy wygasają po siedmiu dniach. Dowód zgody i wypisania się pozostaje zachowany ponad ten okres tak długo, jak długo jest potrzebny jako dowód.",
        "Dzienniki logowania i zdarzenia bezpieczeństwa: krótkotrwale, na potrzeby rozpoznawania ataków.",
        "Pliki dziennika serwera: tylko tak długo, jak jest to konieczne dla działania i bezpieczeństwa.",
        "Kopie zapasowe: rotacyjnie, do momentu zastąpienia ich nowszymi kopiami.",
      ],
    },
    {
      heading: "Państwa prawa",
      paragraphs: [
        "Mają Państwo prawo dostępu (art. 15), sprostowania (art. 16), usunięcia (art. 17), ograniczenia przetwarzania (art. 18), przenoszenia danych (art. 20) oraz sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionych interesach (art. 21 RODO). Udzieloną zgodę mogą Państwo w każdej chwili odwołać ze skutkiem na przyszłość.",
        `W tym celu prosimy o kontakt na adres [${ANBIETER.email}](mailto:${ANBIETER.email}). Jeżeli Państwa dane dotyczą korzystania z platformy przez przedsiębiorstwo, przekazujemy Państwa zapytanie odpowiedzialnemu przedsiębiorstwu albo wspieramy je w udzieleniu odpowiedzi.`,
        `Mogą Państwo ponadto złożyć skargę do organu nadzorczego ds. ochrony danych — właściwym dla nas jest ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Mogą Państwo zwrócić się także do organu nadzorczego swojego miejsca zamieszkania.`,
      ],
    },
    {
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Nicht mit „Ihre Rechte" zusammenlegen.
      heading: "Usuwanie konta i danych z aplikacji",
      paragraphs: [
        "O usunięcie swojego konta mogą Państwo wnioskować samodzielnie w każdej chwili — w aplikacji w „Profil → Konto” albo za pomocą naszego formularza w internecie:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Droga internetowa działa świadomie również wtedy, gdy nie mają Państwo już zainstalowanej aplikacji albo nie mogą się już zalogować. Dla ochrony przed nadużyciem odbywa się to w dwóch krokach: wpisują Państwo adres e-mail swojego konta i otrzymują dokładnie na ten adres link potwierdzający. Dopiero jego wywołanie czyni wniosek skutecznym — samo wpisanie adresu nie wywołuje żadnego skutku. Wniosek rozpatrujemy w terminie 30 dni i odpowiadamy pocztą elektroniczną.",
        "Wraz z kontem usuwamy Państwa dane dostępowe, profil, dane obiektów i kalendarza oraz wiadomości. Nie są usuwane dokumenty, wobec których istnieje ustawowy obowiązek przechowywania — w szczególności faktury i dowody rezerwacji za rozliczone okresy (obowiązek prowadzenia księgowości zgodnie z prawem duńskim, z reguły pięć lat). Dokumenty te są przez okres tego terminu zablokowane, czyli przechowywane wyłącznie w celu wypełnienia tego obowiązku, a następnie usuwane.",
      ],
    },
    {
      heading: "Bezpieczeństwo przetwarzania",
      paragraphs: [
        "Zabezpieczamy przetwarzanie środkami technicznymi i organizacyjnymi zgodnie z art. 32 RODO, w szczególności: ciągłym szyfrowaniem transportu (TLS), regułami dostępu przypisanymi do najemcy bezpośrednio w bazie danych, uprawnieniami opartymi na rolach z rozdzieleniem danych finansowych i serwisowych, opcjonalnym uwierzytelnianiem dwuskładnikowym, ograniczeniem liczby prób logowania, zaszyfrowanymi kopiami zapasowymi z regularnym testem odtworzenia oraz rejestrowaniem zdarzeń istotnych dla bezpieczeństwa.",
      ],
    },
    {
      heading: "Obowiązek podania danych",
      paragraphs: [
        "Dane, które są nam potrzebne do zawarcia umowy, rozliczenia i wypełnienia obowiązków ustawowych, są wymagane — bez nich nie możemy udostępnić platformy. Wszystkie pozostałe dane są podawane dobrowolnie.",
      ],
    },
    {
      heading: "Zmiany niniejszej polityki",
      paragraphs: [
        "Dostosowujemy niniejszą politykę, gdy zmienia się przetwarzanie, wykorzystywani usługodawcy lub stan prawny. Obowiązuje każdorazowo opublikowana tutaj wersja; data u góry wskazuje stan.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte Export
// bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;
