import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Platforma (rynek)",
  description: "Sprzedawaj na platformie myBestDays.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Platforma",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Platforma myBestDays",
          excerpt: "Globalna platforma myBestDays to własny kanał rezerwacji obok portali i strony internetowej.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Platforma myBestDays (/plattform) to globalny kanał rezerwacji samego myBestDays — porównywalny z Booking czy Airbnb, ale będący częścią tej samej platformy. Goście przeglądają tam obiekty wszystkich podłączonych firm i rezerwują bezpośrednio.",
            },
            { type: "h2", text: "Nie „bezpośrednio”, lecz równorzędny kanał" },
            {
              type: "p",
              text: "Platforma nie zastępuje rezerwacji bezpośredniej przez Twoją własną stronę internetową. Jest to samodzielna, trzecia droga sprzedaży z własną osią widoczności, własną bazą gości i własną prowizją — dokładnie jak portal, tylko prowadzona przez samo myBestDays.",
            },
            { type: "h2", text: "Jak obiekty trafiają na platformę" },
            {
              type: "ul",
              items: [
                "Obiekt musi być aktywny (status obiektu pozwala na sprzedaż).",
                "Widoczność na platformie musi być włączona — osobno od portali i strony internetowej.",
                "Dla żądanego okresu musi istnieć dostępność w kalendarzu.",
              ],
            },
            { type: "h2", text: "Rezerwacje z platformy" },
            {
              type: "p",
              text: "Rezerwacja z platformy natychmiast blokuje odpowiednie noce na wszystkich pozostałych kanałach — tak samo jak rezerwacja z portalu lub strony internetowej. Pojawia się w Twoim kalendarzu i w rezerwacjach jak każda inna rezerwacja, oznaczona kanałem „Platforma”.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop sprzedaży i nieaktywny status obiektu działają na wszystkie kanały jednocześnie i blokują również platformę — niezależnie od przełącznika widoczności platformy.",
            },
            {
              type: "p",
              text: "Jak udostępnić obiekt na platformie, przeczytasz w artykule [Wystawianie obiektu na platformie](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Wystawianie obiektu na platformie",
          excerpt: "Widoczność na platformie to osobny przełącznik, oddzielony od portali i strony internetowej.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Widocznością na platformie sterujesz przez osobny przełącznik przy obiekcie — niezależnie od tego, czy ten sam obiekt jest widoczny również na portalach czy na Twojej stronie internetowej.",
            },
            { type: "h2", text: "Jak wystawić obiekt" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w sekcji Obiekty.",
                "Przejdź do zakładki Widoczność.",
                "Aktywuj przełącznik Platforma myNextDays.",
                "Sprawdź, czy status obiektu jest aktywny i czy istnieje dostępność w kalendarzu.",
              ],
            },
            { type: "h2", text: "Warunek: kompletny profil" },
            {
              type: "p",
              text: "Platforma pokazuje tylko obiekty z kompletnymi danymi — muszą być uzupełnione zdjęcie tytułowe, opis, wyposażenie i cena bazowa. Jeśli brakuje wymaganych danych, obiekt pozostaje niewidoczny mimo aktywowanego przełącznika.",
            },
            {
              type: "ul",
              items: [
                "Co najmniej jedno zdjęcie tytułowe i opis",
                "Cechy wyposażenia z listy kategorii",
                "Obłożenie i cena bazowa w zapisanej walucie obiektu",
                "Dostępność w kalendarzu dla żądanego okresu",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Kliknięcie Opublikuj zwykle włącza jednocześnie platformę, portale i stronę internetową — przełącznik platformy możesz potem w każdej chwili osobno ponownie wyłączyć.",
            },
            { type: "h2", text: "Ponowne usunięcie widoczności" },
            {
              type: "p",
              text: "Jeśli wyłączysz przełącznik Platforma myNextDays, obiekt zniknie z wyszukiwania na platformie. Już potwierdzone rezerwacje pozostają tym nienaruszone i przebiegają dalej jak zwykle, zobacz [Prowizja platformy](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Prowizja platformy",
          excerpt: "Za każdą rezerwację pośredniczoną przez platformę naliczana jest prowizja zapisana w taryfie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Podobnie jak w przypadku każdego portalu rezerwacyjnego, za rezerwacje zawierane przez platformę myBestDays naliczana jest prowizja. Jest ona obliczana dla każdej rezerwacji i jest niezależna od ewentualnych prowizji dla portali.",
            },
            { type: "h2", text: "Jak obliczana jest prowizja" },
            {
              type: "p",
              text: "Wysokość zależy od prowizji zapisanej w taryfie Twojej firmy. Aktualną stawkę znajdziesz zawsze w Koncie w sekcji Rozliczenia — nie przyjmuje się tam żadnej wartości ogólnej, lecz pokazywana jest stawka rzeczywiście obowiązująca dla Twojej taryfy.",
            },
            { type: "h2", text: "Gdzie sprawdzić prowizję" },
            {
              type: "steps",
              items: [
                "Otwórz w menu Konto.",
                "Przejdź do sekcji Rozliczenia.",
                "Otwórz rezerwację z platformy, aby zobaczyć szczegóły przychodu i prowizji.",
                "Sprawdź podsumowanie prowizji za bieżący okres rozliczeniowy.",
              ],
            },
            { type: "h2", text: "Różnica względem prowizji portali" },
            {
              type: "ul",
              items: [
                "Prowizja platformy dotyczy wyłącznie rezerwacji przez platformę myBestDays.",
                "Rezerwacje z portali (Booking, Airbnb i inne) podlegają warunkom danego portalu.",
                "Rezerwacje ze strony internetowej podlegają warunkom zapisanym dla Twojej taryfy, bez prowizji platformy.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prowizja jest ustalana automatycznie na podstawie Twojej taryfy. Brakująca lub niejasna taryfa prowadzi do jasnego komunikatu o błędzie, a nie do wartości szacunkowej.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Profil gościa i opinie",
          excerpt: "Goście platformy mają profil z historią rezerwacji i mogą zostawiać opinie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Goście, którzy rezerwują przez platformę myBestDays, tworzą własny profil gościa. Gromadzą się w nim ich rezerwacje, wiadomości z firmami i wystawione opinie — podobnie jak w przypadku konta gościa na portalu.",
            },
            { type: "h2", text: "Co widzisz jako firma" },
            {
              type: "p",
              text: "W szczegółach rezerwacji z platformy znajdziesz profil gościa z dotychczasowymi pobytami w Twojej firmie oraz — jeśli gość je udostępnił — publicznie widocznymi opiniami o innych obiektach noclegowych.",
            },
            { type: "h2", text: "Opinie po pobycie" },
            {
              type: "steps",
              items: [
                "Po wymeldowaniu gość otrzymuje prośbę o wystawienie opinii.",
                "Opinia pojawia się po krótkiej weryfikacji na stronie obiektu na platformie.",
                "Jako firma możesz publicznie odpowiedzieć na każdą opinię.",
                "Nierzeczowe lub nadużywające opinie możesz zgłosić do weryfikacji przez funkcję Zgłoś.",
              ],
            },
            {
              type: "ul",
              items: [
                "Opinie są powiązane z rzeczywistą rezerwacją — bez pobytu nie ma opinii.",
                "Gość ocenia czystość, komunikację, lokalizację i stosunek jakości do ceny.",
                "Twoja odpowiedź jest widoczna dla wszystkich odwiedzających platformę.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dobre opinie mają bezpośredni wpływ na pozycję Twojego obiektu w wyszukiwaniu na platformie — reaguj szybko i rzeczowo na krytykę.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Zablokowane osoby",
          excerpt: "Firma może zablokować gościa, uniemożliwiając mu wysyłanie wiadomości i dokonywanie rezerwacji.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Jeśli dojdzie do problemów z gościem, możesz go jako firma zablokować. Zablokowana osoba nie może już wysyłać Ci wiadomości ani tworzyć nowej rezerwacji w Twojej firmie.",
            },
            { type: "h2", text: "Blokowanie osoby" },
            {
              type: "steps",
              items: [
                "Otwórz historię wiadomości lub rezerwację z danym gościem.",
                "Kliknij Zablokuj gościa.",
                "Potwierdź okno dialogowe — blokada obowiązuje natychmiast.",
                "Zablokowana osoba pojawia się następnie w Koncie w sekcji Zablokowane osoby.",
              ],
            },
            { type: "h2", text: "Co powoduje blokada" },
            {
              type: "ul",
              items: [
                "Gość nie może już wysyłać nowych wiadomości do Twojej firmy.",
                "Gość nie może utworzyć nowej rezerwacji w Twojej firmie.",
                "Trwająca rezerwacja z już potwierdzonym przyjazdem w ciągu najbliższych dwóch tygodni pozostaje nienaruszona przez blokadę, aby pobyt mógł zostać uregulowany w sposób uporządkowany.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokada obowiązuje wyłącznie dla Twojej firmy. Inne firmy na platformie nie widzą blokady i nie są nią objęte.",
            },
            { type: "h2", text: "Ponowne zniesienie blokady" },
            {
              type: "p",
              text: "Otwórz Konto, a tam Zablokowane osoby. Wybierz wpis i kliknij Znieś blokadę — gość może następnie ponownie wysyłać wiadomości i rezerwować.",
            },
          ],
        },
      ],
    },
  ],
};
