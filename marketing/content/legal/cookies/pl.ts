// Polnische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Polityka plików cookie",
  metaDescription:
    "Jakie pliki cookie stosuje myNextDays: wyłącznie technicznie niezbędne i funkcjonalne, bez plików analitycznych, reklamowych i śledzących.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Niniejsza polityka wyjaśnia, jakie pliki cookie i porównywalne techniki przechowywania danych stosuje ${ANBIETER.firma} na tej stronie internetowej oraz na platformie myNextDays.`,
    "W skrócie: stosujemy wyłącznie technicznie niezbędne i funkcjonalne pliki cookie. Nie ma plików analitycznych, reklamowych ani śledzących, a dane o korzystaniu nie są przekazywane sieciom reklamowym.",
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
        "Zgody potrzebujemy dokładnie w jednej sprawie: ochrony przed spamem w naszym formularzu kontaktowym. Pochodzi ona od Google (reCAPTCHA Enterprise), jest więc usługą zewnętrzną, i jest wczytywana wyłącznie wtedy, gdy na nią zezwolisz. Pyta o to pasek na dole ekranu — przy pierwszej wizycie, z równorzędnymi przyciskami odrzucenia i przyjęcia oraz bez wstępnego wyboru. Dopóki nie podejmiesz decyzji, obowiązuje „brak zezwolenia”.",
        "Twoja decyzja pozostaje w pamięci Twojej przeglądarki (Local Storage, wartość „nd_consent”); zawiera wyłącznie kategorię, moment i numer wersji, bez identyfikatora Twojej osoby. Na końcu tej strony możesz ją w każdej chwili zmienić lub odwołać.",
      ],
    },
    {
      heading: "Ta strona internetowa",
      paragraphs: [
        "Strona marketingowa nie ustawia plików cookie. Kroje pisma i ikony znajdują się na naszym własnym serwerze — nie jest do tego wywoływana żadna zewnętrzna usługa ikon ani czcionek. Jedyną usługą zewnętrzną tej strony jest ochrona przed spamem w formularzu kontaktowym, która wczytuje się tylko za Twoją zgodą. Szczegóły znajdują się w [polityce prywatności](/datenschutz).",
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
          titel: "sb-… — Logowanie przez Google (technicznie niezbędny, tylko przy użyciu)",
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
            "Zapisuje Twoją decyzję dotyczącą ochrony przed spamem w formularzu kontaktowym, aby pasek zgody nie pytał ponownie przy każdej wizycie. Zapisywane są wyłącznie kategoria, moment i numer wersji. Wartość nie opuszcza Twojego urządzenia i nie jest przesyłana na nasz serwer; obowiązuje dla tej przeglądarki. Jeśli ją usuniesz, pasek zapyta ponownie przy następnej wizycie.",
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
