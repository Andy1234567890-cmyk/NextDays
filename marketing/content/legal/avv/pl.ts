// Polnische Fassung der Vereinbarung zur Auftragsverarbeitung.
// Übersetzung von `de.ts` — inhaltliche Änderungen gehören ZUERST dorthin und
// werden von da in alle Sprachfassungen übernommen (in `de.ts` stehen auch die
// Belege für die technischen und organisatorischen Maßnahmen und die Liste der
// Unterauftragsverarbeiter).
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Umowa o powierzenie przetwarzania danych osobowych",
  metaDescription:
    "Powierzenie przetwarzania danych osobowych na podstawie art. 28 RODO między myNextDays ApS a przedsiębiorstwami korzystającymi z platformy: przedmiot, polecenia, bezpieczeństwo, dalsze podmioty przetwarzające.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Niniejsza umowa (dalej „Umowa powierzenia”) obowiązuje między przedsiębiorstwem korzystającym z platformy myNextDays (dalej „administrator”) a ${ANBIETER.firma} (dalej „podmiot przetwarzający” lub „my”) i precyzuje obowiązki wynikające z art. 28 rozporządzenia (UE) 2016/679 (RODO).`,
    `Zostaje ona włączona do umowy na podstawie [Ogólnych Warunków Handlowych](${AGB_URL}) i obowiązuje przez cały okres korzystania z platformy. Ma ona pierwszeństwo przed Ogólnymi Warunkami Handlowymi w zakresie, w jakim dotyczy przetwarzania danych osobowych na zlecenie.`,
    "Uzupełniająco obowiązuje [Polityka prywatności](/datenschutz) w odniesieniu do danych, które przetwarzamy jako samodzielny administrator — w szczególności danych konta i relacji handlowej.",
  ],
  sections: [
    {
      heading: "Przedmiot i podział ról",
      unterpunkte: [
        {
          paragraphs: [
            "Przedmiotem jest przetwarzanie danych osobowych, które administrator wprowadza do platformy lub zbiera za jej pośrednictwem, abyśmy mogli świadczyć umownie ustalone usługi: zarządzanie obiektami, rezerwacjami i obłożeniem, komunikacja z gośćmi, obsługa płatności, księgowość i rozliczenia dla właścicieli, połączenie z portalami rezerwacyjnymi, kreator stron internetowych oraz zarządzanie zadaniami i zespołem.",
          ],
        },
        {
          paragraphs: [
            "Administrator decyduje o celach i sposobach tego przetwarzania. Przetwarzamy dane wyłącznie na jego udokumentowane polecenie i nie do własnych celów.",
          ],
        },
        {
          paragraphs: [
            "W odniesieniu do danych konta, rozliczania naszych własnych usług, bezpieczeństwa systemu oraz ustawowego przechowywania jesteśmy samodzielnym administratorem. To przetwarzanie nie jest przedmiotem niniejszej Umowy powierzenia.",
          ],
        },
      ],
    },
    {
      heading: "Charakter, zakres i cel przetwarzania",
      paragraphs: [
        "Przetwarzanie polega na zbieraniu, przechowywaniu, wyświetlaniu, modyfikowaniu, przekazywaniu odbiorcom wybranym przez administratora (np. portalom rezerwacyjnym, dostawcom usług płatniczych), ograniczaniu i usuwaniu — w formie zautomatyzowanej w ramach platformy.",
        "Miejscem przetwarzania jest Unia Europejska; wyjątki zostały wyczerpująco wskazane w rozdziale 8.",
      ],
    },
    {
      heading: "Kategorie osób, których dane dotyczą",
      list: [
        "Goście i osoby dokonujące rezerwacji, w tym osoby współpodróżujące",
        "Osoby zainteresowane, które składają zapytania lub wysyłają wiadomości",
        "Właściciele zarządzanych obiektów",
        "Pracownicy administratora (zespół, sprzątanie, serwis, recepcja)",
        "Osoby kontaktowe partnerów i usługodawców administratora",
      ],
    },
    {
      heading: "Kategorie danych osobowych",
      list: [
        "Dane podstawowe: imię i nazwisko, adres, data urodzenia o ile jest zapisywana, obywatelstwo o ile jest zapisywane na potrzeby obowiązku meldunkowego",
        "Dane kontaktowe: adres e-mail, numer telefonu",
        "Dane rezerwacji: okres, obiekt, liczba podróżnych, ceny, usługi dodatkowe, anulowania",
        "Dane płatnicze: kwota, waluta, sposób płatności, status płatności, referencje (pełne dane karty nie docierają do naszych systemów)",
        "Dane komunikacyjne: wiadomości, notatki, opinie",
        "Dane dostępowe i dane o korzystaniu przez pracowników: rola, uprawnienia, moment zalogowania, urządzenie i adres IP logowania",
        "Szczególne kategorie danych w rozumieniu art. 9 RODO nie są przedmiotem powierzenia; administrator nie wprowadza takich danych do pól tekstu dowolnego.",
      ],
    },
    {
      heading: "Polecenia",
      unterpunkte: [
        {
          paragraphs: [
            "Administrator wydaje polecenia poprzez korzystanie z platformy i jej konfigurację oraz w formie tekstowej na nasz adres kontaktowy. Polecenia ustne potwierdzamy w formie tekstowej.",
          ],
        },
        {
          paragraphs: [
            "Jeżeli uznamy polecenie za niezgodne z prawem, niezwłocznie o tym informujemy i możemy wstrzymać jego wykonanie do czasu, gdy administrator je potwierdzi lub zmieni.",
          ],
        },
        {
          paragraphs: [
            "Jeżeli jesteśmy prawnie zobowiązani do przetwarzania (na przykład wobec organów władzy publicznej), informujemy administratora uprzednio, o ile jest to prawnie dopuszczalne.",
          ],
        },
        {
          titel: "Połączenie własnych usług administratora",
          paragraphs: [
            "Administrator może połączyć swoje konto poprzez interfejs z usługą, którą sam wybrał i z którą zawarł własną umowę — na przykład z asystentem opartym na sztucznej inteligencji. Udzielenie takiego połączenia stanowi jego wyraźne polecenie w rozumieniu art. 28 ust. 3 lit. a RODO, aby wydać tej usłudze udostępnione dane. Obejmuje ono wyraźnie także związane z tym przekazanie danych do państwa trzeciego, jeżeli usługa ma siedzibę poza Unią Europejską.",
            "Krótko mówiąc: o takim połączeniu decyduje wyłącznie administrator, a za połączoną usługę odpowiada on sam.",
            "Udzielić go może jedynie konto z uprawnieniem do zarządzania połączeniami zewnętrznymi. Uprawnienie to jest zastrzeżone dla roli „Administrator”; konta z ograniczonymi uprawnieniami — również rola „Współadministrator” — nie mogą udzielić połączenia. Zapisujemy, kto, kiedy i dla jakiej usługi go udzielił, jakie rodzaje danych zostały udostępnione oraz jakie pobrania miały miejsce; zapis ten jest dostępny dla administratora w interfejsie w sekcji „Konto → Połączenia”, aby mógł wypełnić swój obowiązek rozliczalności i odpowiadać na żądania udzielenia informacji.",
            "Połączona usługa nie jest naszym dalszym podmiotem przetwarzającym: nie zlecamy jej przetwarzania, nie wybieramy jej i nie wydajemy jej poleceń. Przetwarza ona dane na podstawie umowy, którą administrator sam z nią zawarł. Za to przetwarzanie, za jego podstawę prawną oraz za gwarancje przekazania danych do państwa trzeciego odpowiada zatem administrator; nie jest ono przedmiotem niniejszej Umowy powierzenia.",
            "Pola tekstu dowolnego — notatki do rezerwacji oraz treść wiadomości od gości — są domyślnie wyłączone z takiego połączenia. Mogą one zawierać szczególne kategorie danych osobowych w rozumieniu art. 9 RODO, na przykład informacje o zdrowiu. Administrator musi je odrębnie udostępnić przy udzielaniu połączenia; bez tego udostępnienia nie są one przekazywane.",
            "Administrator może w każdej chwili rozłączyć udzielone połączenie w interfejsie. Tokeny odświeżania są przy tym usuwane, a przy każdym kolejnym pobraniu sprawdzane jest, czy zgoda nadal obowiązuje — rozłączona usługa nie może więc odczytać już nic natychmiast, a nie dopiero po upływie ważności swojego tokenu dostępu.",
          ],
        },
      ],
    },
    {
      heading: "Poufność",
      paragraphs: [
        "Wszystkie osoby, które zgodnie z powierzeniem mogą mieć dostęp do danych, są zobowiązane do poufności i są regularnie instruowane w zakresie ochrony danych. Dostęp jest ograniczony do zakresu niezbędnego do wykonania danego zadania.",
        "Dostęp naszych pracowników do danych klientów następuje wyłącznie w celu usunięcia błędu, na wniosek o wsparcie lub w celu wypełnienia obowiązków ustawowych.",
      ],
    },
    {
      heading: "Bezpieczeństwo przetwarzania",
      paragraphs: [
        "Stosujemy środki techniczne i organizacyjne wymagane na podstawie art. 32 RODO. Wdrożone są w szczególności:",
      ],
      list: [
        "Szyfrowanie transmisji (TLS) dla wszystkich połączeń, nagłówki bezpieczeństwa HTTP wraz z restrykcyjną Content-Security-Policy",
        "Rozdzielenie danych poszczególnych podmiotów bezpośrednio w bazie danych: reguły dostępu na poziomie wiersza (Row Level Security) oraz odebrane uprawnienia do tabel w przypadku danych wrażliwych, tak że dostęp poza własnym przedsiębiorstwem jest wykluczony również na bezpośredniej drodze bazodanowej",
        "Uprawnienia oparte na rolach z rozdzieleniem danych: pracownicy serwisu i sprzątania nie otrzymują danych finansowych ani sprzedażowych, właściciele wyłącznie swoje własne obiekty; dane gości są maskowane dla ról, które nie mają odpowiednich uprawnień",
        "Uwierzytelnianie dwuskładnikowe (TOTP) dostępne dla kont; ponowne uwierzytelnienie przy zmianach krytycznych dla bezpieczeństwa",
        "Protokół logowań z urządzeniem, momentem i adresem IP, dostępny do wglądu dla administratora",
        "Połączeń z usługami zewnętrznymi może udzielić wyłącznie konto z rolą „Administrator”; każde pobranie za pośrednictwem takiego połączenia jest protokołowane (narzędzie, moment, zakres — bez samych treści) i jest dostępne do wglądu dla administratora. Rozłączone połączenie traci dostęp natychmiast: przy każdym pobraniu sprawdzane jest, czy zgoda nadal obowiązuje",
        "Ograniczanie częstotliwości zapytań przeciw zautomatyzowanym atakom, weryfikacja podpisów przychodzących wywołań Webhook",
        "Zaszyfrowane kopie zapasowe przechowywane poza systemem produkcyjnym, z regularnym testem odtworzenia",
        "Rozdzielone środowiska dla programowania i eksploatacji; zmiany w bazie danych wyłącznie poprzez wersjonowane migracje",
      ],
    },
    {
      heading: "Dalsze podmioty przetwarzające",
      paragraphs: [
        "Administrator zatwierdza korzystanie z następujących dalszych podmiotów przetwarzających. Z każdym z nich zawarte są umowy zgodne z art. 28 ust. 4 RODO, nakładające obowiązki odpowiadające niniejszej Umowie powierzenia.",
      ],
      list: [
        "Hetzner Online GmbH, Niemcy (serwery, baza danych, media, serwer poczty; centrum danych Helsinki, Finlandia)",
        "Stripe Payments Europe, Limited, Irlandia (płatności, wypłaty, ustawowa weryfikacja tożsamości)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luksemburg (płatności, o ile administrator je aktywuje)",
        "Channex.io Ltd, Zjednoczone Królestwo (połączenie z portalami rezerwacyjnymi, o ile aktywowane)",
        "Meta Platforms Ireland Limited, Irlandia (wiadomości WhatsApp, o ile aktywowane)",
        "Google Ireland Limited, Irlandia (tłumaczenie treści; logowanie przez Google, o ile wykorzystywane)",
        "Groq, Inc., USA (propozycje odpowiedzi w skrzynce odbiorczej, o ile aktywowane)",
        "Cloudflare, Inc., USA (zarządzanie wpisami DNS dla własnych domen, o ile wykorzystywane)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "O zmianie lub uzupełnieniu informujemy co najmniej 30 dni wcześniej. W tym terminie administrator może wnieść sprzeciw z ważnego powodu związanego z ochroną danych; jeżeli sprzeciw nie zostanie usunięty, może on wypowiedzieć objętą nim część usługi albo całą umowę.",
          ],
        },
        {
          paragraphs: [
            "Usługi, które administrator sam uzgadnia z osobą trzecią, nie są dalszym przetwarzaniem, lecz przekazaniem danych zainicjowanym przez niego. Dotyczy to portalu rezerwacyjnego, z którym ma on własną umowę, w takim samym stopniu jak asystenta opartego na sztucznej inteligencji lub innego programu, który łączy ze swoim kontem poprzez interfejs (zob. rozdział „Polecenia”).",
            "Rozstrzygające nie jest przy tym, przez czyje systemy przepływają dane, lecz kto włącza daną usługę: dalsze przetwarzanie powstaje wtedy, gdy MY zlecamy kolejnemu usługodawcy przetwarzanie, aby świadczyć naszą usługę. Jeżeli administrator sam wybiera usługę i sam zawiera z nią umowę, usługa ta przetwarza dane dla administratora — nie dla nas. Takie rozgraniczenie odpowiada praktyce umownej porównywalnych dostawców w odniesieniu do usług osób trzecich połączonych przez klienta.",
          ],
        },
      ],
    },
    {
      heading: "Przekazywanie do państw trzecich",
      paragraphs: [
        "Przekazywanie danych odbiorcom poza UE ogranicza się do wskazanych powyżej usług z siedzibą odpowiednio w USA lub w Zjednoczonym Królestwie. Podstawą są standardowe klauzule umowne Komisji Europejskiej zgodnie z art. 46 ust. 2 lit. c RODO albo obowiązująca decyzja stwierdzająca odpowiedni stopień ochrony; stosowane są uzupełniające środki ochrony (szyfrowanie, minimalizacja danych).",
      ],
    },
    {
      heading: "Wsparcie administratora",
      unterpunkte: [
        {
          paragraphs: [
            "Wspieramy administratora w odpowiadaniu na żądania osób, których dane dotyczą (art. 15–22 RODO). Platforma oferuje do tego celu udzielenie informacji, sprostowanie, eksport i usunięcie danych bezpośrednio w interfejsie. Jeżeli osoby, których dane dotyczą, zwrócą się bezpośrednio do nas, kierujemy je do administratora i informujemy go o tym.",
          ],
        },
        {
          paragraphs: [
            "Wspieramy ponadto przy ocenach skutków dla ochrony danych, przy wypełnianiu obowiązków wynikających z art. 32–36 RODO oraz przy zapytaniach organów nadzorczych.",
          ],
        },
      ],
    },
    {
      heading: "Naruszenia ochrony danych osobowych",
      paragraphs: [
        "Jeżeli dowiemy się o naruszeniu ochrony danych osobowych dotyczącym danych administratora, informujemy go niezwłocznie, najpóźniej w ciągu 48 godzin od uzyskania wiedzy, w formie tekstowej.",
        "Zawiadomienie zawiera, w znanym nam zakresie, charakter i moment zdarzenia, objęte kategorie danych i grupy osób, prawdopodobne konsekwencje oraz podjęte i proponowane środki. Wspieramy administratora w wypełnianiu jego obowiązków zgłoszenia i zawiadomienia zgodnie z art. 33 i 34 RODO.",
      ],
    },
    {
      heading: "Dowody i kontrole",
      unterpunkte: [
        {
          paragraphs: [
            "Na żądanie wykazujemy przestrzeganie niniejszej Umowy powierzenia, w szczególności poprzez udzielenie informacji o podjętych środkach oraz o wykorzystywanych dalszych podmiotach przetwarzających.",
          ],
        },
        {
          paragraphs: [
            "Administrator może przeprowadzać kontrole w niezbędnym zakresie albo zlecić ich przeprowadzenie niezależnemu audytorowi, który nie konkuruje z nami. Kontrole odbywają się po zapowiedzeniu z odpowiednim wyprzedzeniem, w zwykłych godzinach pracy i bez zakłócania działalności. Koszty badania wykraczającego poza udzielenie informacji ponosi administrator, o ile badanie nie jest spowodowane zdarzeniem wywołanym przez nas.",
          ],
        },
      ],
    },
    {
      heading: "Usunięcie i zwrot danych",
      paragraphs: [
        "Po zakończeniu umowy udostępniamy dane administratora na jego żądanie w ciągu 30 dni do eksportu w powszechnie używanym formacie nadającym się do odczytu maszynowego. Następnie usuwamy dane wraz z kopiami.",
        "Wyjątkiem są dane objęte ustawowym obowiązkiem przechowywania (w szczególności dane rachunkowe i księgowe); są one blokowane i usuwane po upływie terminu. Kopie zapasowe są nadpisywane w ramach zwykłego cyklu rotacji.",
      ],
    },
    {
      heading: "Odpowiedzialność i kolejność pierwszeństwa",
      paragraphs: [
        "Zastosowanie ma art. 82 RODO. W stosunkach między stronami obowiązują obok tego zasady odpowiedzialności z Ogólnych Warunków Handlowych, o ile nie są sprzeczne z RODO.",
        "Jeżeli Ogólne Warunki Handlowe i niniejsza Umowa powierzenia są ze sobą sprzeczne w zakresie przetwarzania na zlecenie, obowiązuje niniejsza Umowa powierzenia. Jeżeli jakieś postanowienie stanie się nieskuteczne, pozostała treść pozostaje skuteczna; strony zastąpią je dopuszczalnym uregulowaniem o tym samym celu.",
      ],
    },
    {
      heading: "Zmiany niniejszej umowy",
      paragraphs: [
        "Możemy dostosować niniejszą Umowę powierzenia, o ile stanie się to konieczne z powodu zmian prawa, wymogów organów nadzorczych, wytycznych dostawców usług płatniczych lub rozwoju technicznego i o ile administrator nie zostanie przez to postawiony w gorszej sytuacji.",
        "Zmiany zapowiadamy w formie tekstowej co najmniej 30 dni przed ich wejściem w życie. Jeżeli administrator nie wniesie sprzeciwu w tym terminie, uznaje się je za przyjęte; na ten skutek wskazujemy w zapowiedzi. W przypadku sprzeciwu każda ze stron może wypowiedzieć umowę ze skutkiem na moment wejścia zmian w życie.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Zapytania dotyczące niniejszej umowy, polecenia i zgłoszenia prosimy kierować na adres [${ANBIETER.email}](mailto:${ANBIETER.email}) albo do ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts);
// der benannte Export bleibt daneben stehen, damit bestehende Importe halten.
export default avv;
