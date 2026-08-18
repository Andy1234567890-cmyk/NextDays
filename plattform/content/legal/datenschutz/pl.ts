import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Polityka prywatności",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsza polityka opisuje, jakie dane osobowe przetwarza myBestDays, w jakich celach, na jakiej podstawie prawnej i jakie przysługują Państwu prawa. Dotyczy strony internetowej, aplikacji mobilnych i wszelkich innych kanałów dostępu do platformy.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Administrator i inspektor ochrony danych",
      paragraphs: [
        `Administratorem w rozumieniu rozporządzenia (UE) 2016/679 (RODO) jest ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dania, CVR nr ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Pełne dane usługodawcy znajdują się w [Informacjach prawnych](https://mybestdays.dk/rechtliches/impressum).`,
        "Inspektor ochrony danych nie został wyznaczony; przesłanki art. 37 RODO nie są spełnione. Pytania dotyczące ochrony danych prosimy kierować na wskazany wyżej adres e-mail.",
        "Dostawcy, u których dokonują Państwo rezerwacji, są samodzielnymi administratorami danych otrzymanych od nas. Obowiązują ich [Standardy ochrony danych dla gospodarzy](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Jakie dane przetwarzamy",
      paragraphs: ["W zależności od sposobu korzystania z platformy przetwarzamy:"],
      list: [
        "dane podstawowe — imię i nazwisko, adres e-mail, numer telefonu, język i walutę, hasło w postaci zaszyfrowanej;",
        "dane rezerwacji — zarezerwowane zakwaterowanie, okres, liczbę i imiona podróżnych, życzenia szczególne, status rezerwacji;",
        "dane płatnicze — kwotę, walutę, status płatności, końcowe cyfry środka płatniczego oraz identyfikator transakcji naszego dostawcy usług płatniczych. Pełne dane kart do nas nie trafiają;",
        "dane komunikacyjne — wiadomości między Państwem a dostawcą, zapytania do naszej obsługi klienta, reklamacje;",
        "dane treści — opinie, zdjęcia, listy życzeń;",
        "dane o korzystaniu — odwiedzone strony, zapytania wyszukiwania, moment dostępu;",
        "dane techniczne — adres IP, identyfikatory przeglądarki i urządzenia, system operacyjny, źródło odesłania.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Cele i podstawy prawne",
      paragraphs: [
        "Udostępnianie platformy, konto, wyszukiwanie, rezerwacja, obsługa płatności i komunikacja z dostawcą — art. 6 ust. 1 lit. b) RODO (umowa lub działania przed jej zawarciem).",
        "Obsługa klienta, rozpatrywanie reklamacji i rozstrzyganie sporów — art. 6 ust. 1 lit. b) i f) RODO.",
        "Wykrywanie i zapobieganie oszustwom, nadużyciom i incydentom bezpieczeństwa, egzekwowanie naszych warunków — art. 6 ust. 1 lit. f) RODO (prawnie uzasadniony interes w bezpiecznej platformie handlowej).",
        "Opinie i ich publikacja — art. 6 ust. 1 lit. b) i f) RODO.",
        "Wypełnianie obowiązków prawnych, w szczególności obowiązków przechowywania wynikających z prawa handlowego i podatkowego, obowiązku raportowania zgodnie z dyrektywą (UE) 2021/514 (DAC7) oraz obowiązków z rozporządzenia (UE) 2022/2065 — art. 6 ust. 1 lit. c) RODO.",
        "Ulepszanie platformy przez analizę zagregowanych danych o korzystaniu — art. 6 ust. 1 lit. f) RODO.",
        "Wiadomości reklamowe i pliki cookie inne niż niezbędne — art. 6 ust. 1 lit. a) RODO (zgoda), którą mogą Państwo w każdej chwili wycofać ze skutkiem na przyszłość.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Odbiorcy",
      paragraphs: [
        "Dostawcy otrzymują dane, których potrzebują do realizacji Państwa rezerwacji i wypełnienia swoich obowiązków prawnych — w szczególności imię i nazwisko, dane kontaktowe, okres, liczbę podróżnych oraz Państwa wiadomości do nich.",
        "Nasz dostawca usług płatniczych Stripe przetwarza dane płatnicze jako samodzielny administrator; dodatkowo obowiązuje [polityka prywatności Stripe](https://stripe.com/privacy).",
        "Usługodawcy realizujący dla nas hosting, obsługę baz danych, wysyłkę wiadomości e-mail, diagnostykę błędów i narzędzia obsługi klienta przetwarzają dane wyłącznie na nasze polecenie, na podstawie umowy zgodnej z art. 28 RODO.",
        "Organy i sądy otrzymują dane wyłącznie w zakresie, w jakim jesteśmy do tego zobowiązani; zob. [Zasady dotyczące wniosków organów i organów ścigania](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Organy podatkowe otrzymują dane o dostawcach podlegające raportowaniu zgodnie z DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Przekazywanie do państw trzecich",
      paragraphs: [
        "Nasze serwery i serwery naszych podmiotów przetwarzających znajdują się w Unii Europejskiej.",
        "W zakresie, w jakim w pojedynczych przypadkach przetwarzanie odbywa się poza Europejskim Obszarem Gospodarczym, następuje to wyłącznie na podstawie decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony albo standardowych klauzul umownych zgodnie z art. 46 ust. 2 lit. c) RODO wraz z uzupełniającymi środkami ochrony.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Okresy przechowywania",
      paragraphs: [
        "Dane konta przechowujemy tak długo, jak istnieje Państwa konto, a następnie je usuwamy, o ile nie stoi temu na przeszkodzie obowiązek przechowywania.",
        "Dane rezerwacji i płatności podlegają handlowym i podatkowym terminom przechowywania; zgodnie z duńskim prawem rachunkowym wynoszą one z reguły pięć lat od końca roku obrotowego, którego dane dotyczą.",
        "Wiadomości dotyczące rezerwacji przechowujemy do trzech lat po zakończeniu pobytu, aby móc wyjaśnić ewentualne spory.",
        "Opinie po usunięciu konta pozostają w formie zanonimizowanej, ponieważ stanowią część podstawy oceny zakwaterowania.",
        "Dane dotyczące przypadków oszustw i nadużyć przechowujemy tak długo, jak jest to konieczne do zapobieżenia dalszym naruszeniom, jednak nie dłużej niż trzy lata od ostatniego zdarzenia.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Państwa prawa",
      paragraphs: ["Zgodnie z RODO przysługują Państwu następujące prawa:"],
      list: [
        "dostęp do danych zapisanych o Państwu (art. 15);",
        "sprostowanie danych nieprawidłowych (art. 16);",
        "usunięcie danych (art. 17), o ile nie stoi temu na przeszkodzie obowiązek przechowywania;",
        "ograniczenie przetwarzania (art. 18);",
        "przenoszenie danych (art. 20);",
        "sprzeciw wobec przetwarzania opartego na prawnie uzasadnionych interesach (art. 21), w szczególności wobec marketingu bezpośredniego;",
        "wycofanie udzielonej zgody ze skutkiem na przyszłość (art. 7 ust. 3);",
        `skarga do organu nadzorczego (art. 77) — właściwy jest organ Państwa miejsca zamieszkania, miejsca pracy albo miejsca domniemanego naruszenia. W siedzibie administratora jest to ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dania, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Jak wykonywać swoje prawa",
      paragraphs: [
        `Wiele danych mogą Państwo przeglądać, zmieniać lub usuwać bezpośrednio na swoim koncie. We wszystkich pozostałych sprawach prosimy pisać na ${ANBIETER.email}.`,
        "Odpowiadamy niezwłocznie, najpóźniej w ciągu miesiąca. Jeżeli nie moglibyśmy dotrzymać tego terminu, poinformujemy o tym wraz z uzasadnieniem.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Decyzje zautomatyzowane",
      paragraphs: [
        "Stosujemy procedury zautomatyzowane w celu wykrywania oszustw, nadużyć i treści bezprawnych. Jeżeli taka procedura prowadzi do środka wobec Państwa konta lub treści, uzasadniamy go, a Państwo mogą żądać weryfikacji przez człowieka.",
        "Nie podejmujemy decyzji opierających się wyłącznie na zautomatyzowanym przetwarzaniu i wywołujących skutki prawne w rozumieniu art. 22 RODO.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Obowiązek podania danych",
      paragraphs: [
        "Dane niezbędne do rezerwacji muszą Państwo podać; bez nich nie można zawrzeć umowy ani udostępnić zakwaterowania. Wszystkie pozostałe dane są dobrowolne.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Zmiany niniejszej polityki",
      paragraphs: [
        "Dostosowujemy niniejszą politykę, gdy zmienia się przetwarzanie lub stan prawny. Aktualnie obowiązująca wersja jest dostępna tutaj; data aktualizacji znajduje się na górze.",
      ],
    },
  ],
};
