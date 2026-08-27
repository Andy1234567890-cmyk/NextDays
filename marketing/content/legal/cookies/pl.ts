// Polnische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Polityka plików cookie",
  metaDescription:
    "Jakich plików cookie używa myNextDays: technicznie niezbędne pliki cookie oraz — wyłącznie za Państwa zgodą — funkcjonalne, analityczne i marketingowe pliki cookie. Każdą kategorię można włączać i wyłączać indywidualnie.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Niniejsza polityka wyjaśnia, jakie pliki cookie i porównywalne techniki przechowywania danych stosuje ${ANBIETER.firma} na tej stronie internetowej oraz na platformie myNextDays.`,
    "Krótko mówiąc: Niezbędne są tylko te pliki cookie, bez których strona internetowa nie działa zgodnie z przeznaczeniem. Wszystko inne wymaga Państwa zgody i nie ładuje się bez niej — ochrona przed spamem naszego formularza kontaktowego, pomiar zasięgu i marketingowe pliki cookie, za pomocą których mierzymy sukces naszych reklam. Mogą Państwo indywidualnie zezwolić lub odrzucić każdą z tych kategorii i w każdej chwili odwołać swoją decyzję.",
  ],
  sections: [
    {
      heading: "Czym są pliki cookie",
      paragraphs: [
        "Pliki cookie to niewielkie pliki tekstowe, które strona internetowa zapisuje w przeglądarce. Umożliwiają rozpoznanie sesji — na przykład dzięki temu po zalogowaniu pozostajesz zalogowany. Poza plikami cookie przeglądarki korzystają z innych pamięci, takich jak Local Storage, które działają w technicznie podobny sposób.",
      ],
    },
    {
      heading: "Na co potrzebujemy Twojej zgody",
      paragraphs: [
        "Zgoda jest wymagana na podstawie § 9 duńskiego rozporządzenia w sprawie plików cookie (Cookie-bekendtgørelsen), wdrażającego art. 5 ust. 3 dyrektywy 2002/58/WE, wyłącznie wtedy, gdy dostęp do Twojego urządzenia nie służy jedynie przekazaniu komunikatu ani nie jest bezwzględnie konieczny do świadczenia usługi wyraźnie przez Ciebie zamówionej.",
        "Wszystkie pliki cookie, które ustawiamy, są niezbędne do zalogowania, do bezpieczeństwa sesji albo do ustawienia wybranego przez Ciebie samego — o nie nie pytamy, a odwrotnie nie ustawiamy niczego, co wymagałoby zgody.",
        "Muszą Państwo wyrazić zgodę na trzy kategorie, z których żadna nie zostanie załadowana bez Państwa zgody: ochrona przed spamem naszego formularza kontaktowego (reCAPTCHA od Google), pomiar zasięgu tej strony internetowej (Google Analytics 4) oraz marketingowe pliki cookie (Meta, LinkedIn, Google Ads). W tym celu podczas pierwszej wizyty pojawi się okno z listą kategorii — bez wstępnego wyboru, każda kategoria z własnym przełącznikiem. Dopóki nie podejmą Państwo decyzji, obowiązuje zasada „niedozwolone” i nie są przeprowadzane żadne analizy ani reklamy.",
        "Twoja decyzja pozostaje w pamięci Twojej przeglądarki (Local Storage, wartość „nd_consent”); zawiera wyłącznie kategorię, moment i numer wersji, bez identyfikatora Twojej osoby. Za pomocą ikony cookies w lewym dolnym rogu każdej strony możesz ją w każdej chwili zmienić lub odwołać. Po sześciu miesiącach zapytamy ponownie — zgoda nie powinna obowiązywać bezterminowo.",
      ],
    },
    {
      heading: "Ta strona internetowa",
      paragraphs: [
        "Ta strona internetowa sama w sobie nie używa żadnych plików cookie. Czcionki i symbole znajdują się na naszym własnym serwerze — nie jest wywoływana żadna usługa symboli ani czcionek stron trzecich. Dodatkowo dostępne są tylko usługi, na które Państwo zezwolą: ochrona przed spamem formularza kontaktowego, pomiar zasięgu i usługi marketingowe. Jakie pliki cookie są ustawiane, na jaki okres i na jakim hoście, znajduje się poniżej w sekcji „Pliki cookie stron trzecich”. Zgodę można wycofać za pomocą ikony plików cookie w lewym dolnym rogu — odpowiednia usługa zostanie natychmiast zakończona, a jej pliki cookie zostaną usunięte. Szczegóły znajdują się w [Polityce prywatności](/datenschutz).",
      ],
    },
    {
      heading: "Pliki cookie platformy",
      paragraphs: [
        "Gdy zalogujesz się w panelu, na rynku lub w widoku mobilnym, ustawiane są następujące pliki cookie:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Zalogowanie (technicznie niezbędny)",
          list: [
            "Cel: potwierdza Twoją zalogowaną sesję wobec serwera.",
            "Treść: krótkotrwały token dostępu; czytelny wyłącznie dla serwera (HttpOnly), przesyłany tylko przez HTTPS.",
            "Czas działania: sesja lub wygaśnięcie tokenu.",
          ],
        },
        {
          titel: "nd_refresh — Przedłużenie sesji (technicznie niezbędny)",
          list: [
            "Cel: odnawia token dostępu, aby nie trzeba było ciągle logować się od nowa.",
            "Treść: token odnawiający; HttpOnly, tylko przez HTTPS.",
            "Czas działania: do wylogowania lub wygaśnięcia.",
          ],
        },
        {
          titel: "nd_locale — Wybór języka (funkcjonalny)",
          list: [
            "Cel: zapamiętuje wybrany przez Ciebie język.",
            "Treść: skrót języka, np. „de” lub „en”.",
            "Czas działania: do zmiany lub usunięcia.",
          ],
        },
        {
          titel: "sidebar_state — Panel boczny (funkcjonalny)",
          list: [
            "Cel: zapamiętuje, czy pasek nawigacji jest rozwinięty czy zwinięty.",
            "Treść: „true” lub „false”.",
            "Czas działania: do zmiany lub usunięcia.",
          ],
        },
        {
          titel:
            "sb-… — Logowanie przez Google (technicznie niezbędny, tylko przy użyciu)",
          list: [
            "Cel: utrzymuje sesję, gdy logujesz się przez Google.",
            "Treść: token sesji usługi logowania.",
            "Czas działania: sesja lub wygaśnięcie tokenu. Ustawiany jest wyłącznie wtedy, gdy wybierzesz logowanie przez Google.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Rejestruje Państwa decyzję dotyczącą usług wymagających zgody (ochrona przed spamem formularza kontaktowego i pomiar zasięgu).",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Ustawiany jest wyłącznie wtedy, gdy sam otworzysz czat na tej stronie i wyślesz wiadomość. Jest kluczem do Twojej własnej rozmowy — bez niego po zmianie strony nie odnalazłbyś naszej odpowiedzi. Nie zawiera żadnych informacji o Tobie i jest używany tylko w tym celu.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Zapisuje w przeglądarce, czy zgodziłeś się na korzystanie z wprowadzania głosowego, aby zgoda nie była pobierana ponownie przy każdej wizycie. Wartość nie opuszcza Twojego urządzenia.",
          ],
        },
      ],
    },
    {
      heading: "Pliki cookie aplikacji mobilnej",
      paragraphs: [
        "Aplikacja mobilna nie korzysta z plików cookie. Tokeny dostępu i odnawiania są przechowywane w zabezpieczonym magazynie kluczy urządzenia (iOS Keychain, Android Keystore) i usuwane przy wylogowaniu.",
      ],
    },
    {
      heading: "Pliki cookie podmiotów trzecich",
      paragraphs: [
        "Jeśli dokonujesz płatności, dostawca usług płatniczych (Stripe lub PayPal) może na swojej własnej stronie ustawić pliki cookie niezbędne do realizacji płatności i zapobiegania oszustwom. Obowiązują dla nich postanowienia danego dostawcy.",
        "Na stronach internetowych, które obiekty tworzą za pomocą naszego kreatora, o dodatkowych plikach cookie decyduje dany obiekt i on odpowiada za zamieszczone tam informacje.",
        "Tylko za Państwa zgodą usługi Google na tej stronie internetowej umieszczają następujące pliki cookie — dwa do pomiaru zasięgu, jeden do ochrony przed spamem. Bez Państwa zgody odpowiedni skrypt nie zostanie załadowany i żaden z tych plików cookie nie zostanie umieszczony; w przypadku wycofania zgody usuniemy je.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Pomiar skuteczności reklam (wymagana zgoda)",
          list: [
            "Cel: przypisuje Twoją wizytę do reklamy, abyśmy mogli mierzyć skuteczność naszych kampanii.",
            "Treść: losowo wygenerowany identyfikator; nie zawiera danych o nazwie, adresie e-mail ani koncie z naszej strony.",
            "Dostawca: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irlandia.",
            "Host: mynextdays.com (plik cookie pierwszej strony, ustawiony przez skrypt Meta). Okres ważności: około trzy miesiące.",
          ],
        },
        {
          titel: "_gcl_au — Pomiar skuteczności Google Ads (wymagana zgoda)",
          list: [
            "Cel: przypisuje Twoją wizytę do reklamy Google, abyśmy mogli mierzyć skuteczność naszych kampanii.",
            "Treść: losowo wygenerowany identyfikator bez związku z Twoją osobą.",
            "Dostawca: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlandia.",
            "Host: mynextdays.com (plik cookie pierwszej strony). Okres ważności: około trzy miesiące.",
          ],
        },
        {
          titel: "li_gc i bcookie — Reklamy LinkedIn (wymagana zgoda)",
          list: [
            "Cel: identyfikuje Twoją przeglądarkę w serwisie LinkedIn, aby można było przypisać reklamy i ich skuteczność; li_gc dodatkowo zapisuje Twoją zgodę w tym serwisie.",
            "Treść: identyfikator przeglądarki oraz status zgody; nie zawiera danych z Twojego konta u nas.",
            "Dostawca: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irlandia.",
            "Host: linkedin.com (pliki cookie stron trzecich). Okres ważności: około sześć miesięcy lub jeden rok.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — ochrona formularza kontaktowego przed spamem (wymagana zgoda)",
          list: [
            "Host: www.google.com (plik cookie strony trzeciej).",
            "Cel: umożliwia Google ocenę ryzyka, która odróżnia automatyczne masowe wiadomości od prawdziwych zapytań.",
            "Treść: wygenerowany przez Google identyfikator do tej oceny; nie zawiera naszych danych dotyczących nazwiska, adresu e-mail ani konta.",
            "Dostawca: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlandia.",
            "Okres przechowywania: ustalony przez Google, do sześciu miesięcy. Jest ustawiany dopiero po zezwoleniu na ochronę przed spamem i otwarciu formularza kontaktowego.",
          ],
        },
        {
          titel: "_ga — Pomiar zasięgu (wymagana zgoda)",
          list: [
            "Host: mynextdays.com (plik cookie pierwszej firmy, ustawiony przez skrypt Google).",
            "Cel: rozróżnia odwiedzających, aby powtarzające się wywołania nie były liczone podwójnie.",
            "Treść: losowo generowany identyfikator bez związku z Państwa osobą; brak danych dotyczących imienia, adresu e-mail lub konta.",
            "Dostawca: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlandia.",
            "Okres przechowywania: do dwóch lat.",
          ],
        },
        {
          titel: "_ga_<identyfikator> — Stan sesji pomiaru (wymagana zgoda)",
          list: [
            "Host: mynextdays.com (plik cookie pierwszej firmy, ustawiony przez skrypt Google).",
            "Cel: rejestruje, kiedy rozpoczęła się Państwa bieżąca wizyta, aby wyświetlenia stron w ramach jednej sesji były ze sobą powiązane.",
            "Treść: znacznik czasu i licznik sesji; identyfikator w nazwie odnosi się do naszej usługi, a nie do Państwa.",
            "Dostawca: Google Ireland Limited.",
            "Okres przechowywania: do dwóch lat.",
          ],
        },
      ],
    },
    {
      heading: "Usuwanie plików cookie i zarządzanie nimi",
      paragraphs: [
        "Pliki cookie możesz w każdej chwili usunąć lub zablokować w ustawieniach swojej przeglądarki. Jeśli zablokujesz niezbędne pliki cookie, zalogowanie się na platformie nie jest technicznie możliwe — publiczna strona internetowa i rynek pozostają dostępne bez logowania.",
        "Przy wylogowaniu usuwamy pliki cookie logowania sami.",
      ],
    },
    {
      heading: "Zmiany niniejszej polityki",
      paragraphs: [
        "Jeśli dojdą funkcje wymagające dalszych plików cookie, zaktualizujemy tę listę. Obowiązuje każdorazowo wersja opublikowana w tym miejscu; data u góry wskazuje stan.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
