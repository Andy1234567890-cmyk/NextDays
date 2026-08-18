import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Warunki płatności",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsze warunki płatności regulują sposób obsługi płatności związanych z rezerwacją za pośrednictwem myBestDays. Uzupełniają [Warunki korzystania dla gości](https://mybestdays.dk/rechtliches/nutzungsbedingungen); w razie sprzeczności w kwestiach płatności pierwszeństwo mają niniejsze warunki.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Nasza rola przy płatności",
      paragraphs: [
        "myBestDays obsługuje płatności na zlecenie dostawcy. Nie jesteśmy instytucją płatniczą ani instytucją pieniądza elektronicznego; samą usługę płatniczą świadczy nasz dostawca usług płatniczych.",
        "Płatności za pośrednictwem platformy obsługuje Stripe (Stripe Payments Europe, Limited). Dane kart i inne dane płatnicze zbiera i przetwarza bezpośrednio Stripe. myBestDays nie przechowuje pełnych danych kart.",
        "W przypadku zapłaty za pośrednictwem platformy Państwa zobowiązanie wobec dostawcy uważa się za spełnione w wysokości zapłaconej kwoty, gdy tylko płatność zostanie pomyślnie autoryzowana i pobrana przez naszego dostawcę usług płatniczych.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Metody płatności",
      paragraphs: [
        "Dostępne metody płatności zależą od ogłoszenia, kraju dostawcy i Państwa kraju. Dostępne metody są prezentowane przed finalizacją rezerwacji.",
        "Dla niektórych metod płatności wymagane jest silne uwierzytelnianie klienta zgodnie z dyrektywą (UE) 2015/2366. Bez pomyślnego uwierzytelnienia płatność nie może zostać zrealizowana.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Wymagalność, zaliczka i dopłata",
      paragraphs: [
        "Termin wymagalności poszczególnych kwot określa dostawca w ogłoszeniu. Powszechne są trzy modele: pełna płatność przy rezerwacji, zaliczka przy rezerwacji z dopłatą przed przyjazdem albo płatność na miejscu u dostawcy.",
        "Model obowiązujący dla Państwa rezerwacji oraz terminy są prezentowane przed finalizacją rezerwacji i powtórzone w potwierdzeniu rezerwacji.",
        "Przed wymagalnością dopłaty wysyłamy przypomnienie na wskazany adres e-mail. W razie braku dopłaty dostawca może odstąpić od umowy zgodnie ze swoimi warunkami anulowania.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Waluta",
      paragraphs: [
        "Rozliczenie następuje w walucie ogłoszenia. Waluta ta jest wskazana przy każdej cenie i w procesie płatności.",
        "Jeżeli kwota jest dodatkowo prezentowana w innej walucie, jest to niewiążące przeliczenie orientacyjne i nie stanowi wiążącej ceny.",
        "Jeżeli Państwa dostawca usług płatniczych przelicza na inną walutę lub pobiera opłatę za transakcję zagraniczną, koszty te ponoszą Państwo. Nie stanowią one części ceny całkowitej i nie są przez nas ustalane ani pobierane.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Kaucja",
      paragraphs: [
        "Jeżeli ogłoszenie przewiduje kaucję, jej wysokość jest wskazana przed finalizacją rezerwacji.",
        "W zależności od ogłoszenia kaucja jest wstępnie autoryzowana na Państwa środku płatniczym (kwota jest zablokowana, lecz nieobciążona) albo pobierana. Wstępna autoryzacja może czasowo obniżyć dostępny limit karty.",
        "Po pobycie wstępna autoryzacja jest zwalniana albo pobrana kaucja zwracana, o ile dostawca nie zgłosi szkody. W razie zgłoszenia szkody musi ją wykazać; o zasadności roszczenia rozstrzyga stosunek między Państwem a dostawcą.",
        "Jeżeli dostawca żąda kaucji na miejscu, stanowi ona pozycję kosztów na miejscu i nie jest obsługiwana przez platformę.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Zwroty",
      paragraphs: [
        "Zwroty następują na środek płatniczy użyty do zapłaty, o ile nie uzgodniono inaczej lub nie jest to technicznie niemożliwe.",
        "Zwrot inicjujemy niezwłocznie po ustaleniu jego podstawy. Czas, po jakim uznanie pojawi się na Państwa rachunku lub karcie, zależy od Państwa dostawcy usług płatniczych; zwykle jest to od pięciu do dziesięciu dni roboczych.",
        "To, czy i w jakim zakresie przysługuje zwrot, wynika z [Warunków anulowania](https://mybestdays.dk/rechtliches/stornierungsbedingungen) oraz [Zasad przekwaterowania i zwrotów](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Nieudane płatności i obciążenia zwrotne",
      paragraphs: [
        "W razie niepowodzenia płatności informujemy Państwa i umożliwiamy podanie innego środka płatniczego. W razie braku płatności rezerwacja może zostać anulowana.",
        "Jeżeli obciążą Państwo zwrotnie już zrealizowaną płatność bez prawa do zwrotu, dostawca może nadal dochodzić tej kwoty. Koszty, które ponosimy w związku z bezpodstawnym obciążeniem zwrotnym, możemy Państwu przenieść.",
        "Jeżeli uznamy płatność za oszukańczą, możemy ją zatrzymać albo anulować rezerwację. Poinformujemy Państwa i uzasadnimy decyzję.",
      ],
    },
    {
      id: "belege",
      heading: "8. Dowody i rozliczenia",
      paragraphs: [
        "Dla kwot zapłaconych za pośrednictwem platformy udostępniamy dowód, który mogą Państwo pobrać na koncie w zakładce „Rezerwacje”.",
        "Fakturę za usługę noclegową wystawia dostawca; to on jest przedsiębiorcą świadczącym usługę. O podatkach zob. [Politykę podatkową](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Zmiany niniejszych warunków płatności",
      paragraphs: [
        "Do zmian niniejszych warunków płatności stosuje się sekcję A22 [Warunków korzystania](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
