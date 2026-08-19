import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Strona internetowa",
  description: "Optymalne wykorzystanie Twojej strony internetowej.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Strona internetowa",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Uruchamianie strony internetowej",
          excerpt: "Jak opublikować własną stronę internetową jako samodzielny kanał sprzedaży.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Twoja strona internetowa jest osobnym kanałem sprzedaży obok portali i platformy. Strony budujesz w edytorze, ale dopiero po publikacji strona internetowa staje się widoczna dla gości, a Twoje obiekty pojawiają się tam jako możliwe do zarezerwowania.",
            },
            {
              type: "steps",
              items: [
                "Otwórz edytor strony internetowej i sprawdź, czy wszystkie żądane strony są wypełnione treścią.",
                "W zakładce obiektu wybierz dla każdego obiektu, czy ma być widoczny na stronie internetowej — ta widoczność jest niezależna od portali i platformy.",
                "Skontroluj podgląd w widoku na komputerze i na urządzeniu mobilnym, zanim uruchomisz stronę.",
                "Kliknij „Opublikuj”, aby udostępnić stronę internetową gościom.",
                "Po publikacji sprawdź publiczny adres URL i przetestuj przykładową rezerwację przez stronę internetową.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Widoczność obiektu na stronie internetowej to osobna oś — obiekt może być aktywny na portalach, a ukryty na stronie internetowej, i odwrotnie. Szczegóły w artykule [Konfiguracja własnej domeny](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Konfiguracja własnej domeny",
          excerpt: "Jak połączyć własną domenę ze swoją stroną myNextDays.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Własna domena, taka jak www.twoja-firma.pl, wygląda bardziej profesjonalnie niż standardowy adres i wzmacnia Twoją markę wobec gości, którzy chcą rezerwować bezpośrednio u Ciebie.",
            },
            {
              type: "steps",
              items: [
                "Otwórz w edytorze strony internetowej sekcję „Domena” i wpisz żądaną własną domenę.",
                "Skonfiguruj u dostawcy swojej domeny wyświetlone wpisy DNS (zazwyczaj CNAME lub rekord A).",
                "Poczekaj, aż domena zostanie wyświetlona jako połączona, a certyfikat SSL jako aktywny — w zależności od dostawcy może to potrwać kilka godzin.",
                "Przetestuj wywołanie własnej domeny w prywatnym oknie przeglądarki, aby wykluczyć zapisane w pamięci podręcznej stare wpisy.",
                "Sprawdź, czy stare standardowe adresy nadal przekierowują na nową domenę, aby istniejące linki nie prowadziły donikąd.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zmieniaj wpisy DNS tylko zgodnie z wyświetlonymi wartościami — błędne wartości mogą zakłócić istniejące ustawienia poczty e-mail Twojej domeny. W razie wątpliwości skonsultuj się ze swoim dostawcą domeny, zanim nadpiszesz istniejące wpisy.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Zwiększanie rezerwacji bezpośrednich",
          excerpt: "Jak skierować więcej gości na własną stronę internetową zamiast na portale.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Rezerwacje przez własną stronę internetową są dla Twojej firmy zwykle korzystniejsze niż przez portale, ponieważ nie naliczana jest tu prowizja portalu. Za pomocą kilku celowych działań zwiększysz udział rezerwacji bezpośrednich przez Twoją stronę internetową jako samodzielny kanał.",
            },
            {
              type: "steps",
              items: [
                "Upewnij się, że wszystkie możliwe do zarezerwowania obiekty są widoczne na stronie internetowej i mają aktualne zdjęcia oraz opisy.",
                "Skonfiguruj rabat lub korzyść dostępną wyłącznie na stronie internetowej, na przykład niewielką obniżkę ceny względem portali.",
                "Umieść link do własnej domeny w potwierdzeniach rezerwacji i w komunikacji z gośćmi, którzy już wcześniej u Ciebie rezerwowali.",
                "Regularnie sprawdzaj statystyki rezerwacji, aby obserwować w czasie udział strony internetowej we wszystkich rezerwacjach.",
                "Zoptymalizuj czas ładowania i wyświetlanie mobilne strony internetowej, ponieważ większość gości rezerwuje przez smartfon.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Korzyść dostępna wyłącznie na stronie internetowej działa tylko wtedy, gdy goście w ogóle znajdą tę stronę — aktywnie na nią wskazuj, zamiast polegać tylko na portalach. O publikacji przeczytasz w artykule [Uruchamianie strony internetowej](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
