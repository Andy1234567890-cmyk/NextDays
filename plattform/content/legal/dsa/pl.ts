import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Akt o usługach cyfrowych",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "myBestDays jest usługą pośrednią i platformą internetową w rozumieniu rozporządzenia (UE) 2022/2065 w sprawie jednolitego rynku usług cyfrowych (akt o usługach cyfrowych, DSA). Niniejsza strona zbiera informacje i procedury wymagane tym rozporządzeniem.",
    "myBestDays nie jest bardzo dużą platformą internetową w rozumieniu art. 33 rozporządzenia. Dodatkowe obowiązki dotyczące takich platform — ocena ryzyk systemowych, niezależny audyt, repozytorium reklam i publikacja miesięcznej liczby użytkowników w przewidzianej tam procedurze — nas zatem nie dotyczą.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Punkty kontaktowe (art. 11 i 12)",
      paragraphs: [
        `Pojedynczy punkt kontaktowy dla organów państw członkowskich, Komisji i Europejskiej Rady ds. Usług Cyfrowych: ${ANBIETER.email}, korespondencyjnie ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dania.`,
        `Pojedynczy punkt kontaktowy dla użytkowników: ${ANBIETER.email}. Kontaktują się Państwo z nami bezpośrednio, bez zautomatyzowanego etapu pośredniego.`,
        "Z obydwoma punktami kontaktowymi można porozumiewać się w języku niemieckim, duńskim i angielskim.",
        "Nie ma potrzeby wyznaczania przedstawiciela prawnego w Unii zgodnie z art. 13: operator ma siedzibę w Danii, a więc w Unii.",
        `Właściwy koordynator ds. usług cyfrowych zgodnie z art. 49: ${DSA_KOORDINATOR.name}, Dania ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Zgłaszanie treści bezprawnych (art. 16)",
      paragraphs: [
        "Każdy może zgłosić nam treści, które uważa za bezprawne. Prosimy skorzystać z funkcji zgłaszania dostępnej przy każdym ogłoszeniu, każdej opinii i każdej wiadomości albo z punktu kontaktowego dla użytkowników.",
        "Aby umożliwić nam ocenę zgłoszenia bez pogłębionej analizy prawnej, powinno ono zawierać:",
      ],
      list: [
        "wystarczająco uzasadnione wyjaśnienie, dlaczego treść jest bezprawna;",
        "dokładną lokalizację elektroniczną, w szczególności adres URL;",
        "imię i nazwisko oraz adres e-mail zgłaszającego — z wyjątkiem zgłoszeń dotyczących przestępstw przeciwko wolności seksualnej dzieci, gdzie podanie ich jest dobrowolne;",
        "oświadczenie, że informacje są zgodne z najlepszą wiedzą prawdziwe i kompletne.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Jak rozpatrujemy zgłoszenia",
      paragraphs: [
        "Niezwłocznie potwierdzamy wpływ i rozstrzygamy terminowo, starannie, w sposób niearbitralny i obiektywny.",
        "Jeżeli zgłoszenie zawiera informacje wskazane w sekcji 2, powoduje ono powzięcie przez nas wiedzy w rozumieniu art. 6 rozporządzenia.",
        "O naszej decyzji informujemy zgłaszającego i wskazujemy dostępne środki odwoławcze.",
        "Jeżeli rozpatrywanie jest zautomatyzowane, informujemy o tym.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Uzasadnianie środków (art. 17)",
      paragraphs: [
        "Jeżeli ograniczamy widoczność treści, usuwamy ją, blokujemy do niej dostęp, zawieszamy płatności, zawieszamy świadczenie usługi albo konto, osoba, której to dotyczy, otrzymuje jasne i konkretne uzasadnienie.",
        "Uzasadnienie wskazuje rodzaj i zakres środka, jego zasięg terytorialny i czasowy, fakty i okoliczności decyzji, ewentualny udział przetwarzania zautomatyzowanego, podstawę prawną lub naruszone postanowienie umowne oraz dostępne środki odwoławcze.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Podejrzenie przestępstwa (art. 18)",
      paragraphs: [
        "W razie przesłanek wskazujących na przestępstwo stwarzające zagrożenie dla życia lub bezpieczeństwa osoby niezwłocznie zawiadamiamy właściwe organy ścigania lub organy sądowe.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Wewnętrzny system rozpatrywania skarg (art. 20)",
      paragraphs: [
        "Przeciwko każdemu środkowi z sekcji 4 i przeciwko odrzuceniu zgłoszenia można w terminie sześciu miesięcy złożyć bezpłatną skargę.",
        "Skargi rozpatrywane są terminowo, w sposób niedyskryminacyjny i staranny — pod nadzorem wykwalifikowanych osób, a nie wyłącznie środkami automatycznymi.",
        "Jeżeli skarga okaże się zasadna, uchylamy środek. Drogę opisano w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Pozasądowe rozstrzyganie sporów (art. 21)",
      paragraphs: [
        "W sporach dotyczących środków z sekcji 4 użytkownicy mogą zwrócić się do organu pozasądowego rozstrzygania sporów certyfikowanego przez właściwego koordynatora ds. usług cyfrowych. Wykaz organów certyfikowanych prowadzi Komisja Europejska.",
        "Decyzje tych organów nie są dla nas wiążące; nie jesteśmy zobowiązani do udziału w postępowaniach niezależnych podmiotów. Droga sądowa pozostaje otwarta.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Zaufani podmioty sygnalizujące (art. 22)",
      paragraphs: [
        "Zgłoszenia składane przez podmiot uznany za zaufanego sygnalistę w jego dziedzinie rozpatrujemy priorytetowo.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Środki przeciw nadużyciom (art. 23)",
      paragraphs: [
        "Konta, za pośrednictwem których często udostępniane są treści oczywiście bezprawne, blokujemy na rozsądny okres po uprzednim ostrzeżeniu.",
        "Rozpatrywanie zgłoszeń i skarg zawieszamy wobec osób, które często składają zgłoszenia lub skargi oczywiście bezzasadne — również po uprzednim ostrzeżeniu.",
        "Każdorazowo oceniamy indywidualny przypadek: liczbę, udział i wagę spraw oraz zamiar.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Sprawozdania z przejrzystości (art. 15 i 24)",
      paragraphs: [
        "Co roku publikujemy sprawozdanie o moderowaniu treści: liczbę nakazów organów, liczbę i rodzaj zgłoszeń, podjęte środki, liczbę skarg i ich wynik, informacje o wykorzystaniu środków automatycznych oraz liczbę sporów przed organami pozasądowymi.",
        `Mikroprzedsiębiorstwa i małe przedsiębiorstwa są zwolnione z części tych obowiązków na podstawie art. 19 rozporządzenia. Dopóki zwolnienie obowiązuje, udostępniamy informacje na żądanie pod adresem ${ANBIETER.email}; po opublikowaniu pierwszego sprawozdania zostanie ono tu zalinkowane.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Identyfikowalność przedsiębiorców (art. 30–32)",
      paragraphs: [
        "Dostawcy działający na platformie w celach zawodowych mogą oferować dopiero po przekazaniu nam nazwy, adresu, numeru telefonu, adresu e-mail, danych rejestrowych, numeru identyfikacyjnego VAT i rachunku płatniczego oraz pod warunkiem wiarygodności ich danych.",
        "Dane te prezentujemy w ogłoszeniu w zakresie przewidzianym rozporządzeniem.",
        "Jeżeli dowiemy się, że ogłoszenie dotyczyło bezprawnego produktu lub bezprawnej usługi, informujemy zainteresowanych gości, o ile dysponujemy ich danymi kontaktowymi.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Systemy rekomendacji (art. 27)",
      paragraphs: [
        "Główne parametry kolejności wyników wyszukiwania i rekomendacji oraz możliwość wpływania na nie opisano w [Ceny, pozycjonowanie i rekomendacje](https://mybestdays.dk/rechtliches/preisangaben).",
      ],
    },
    {
      id: "werbung",
      heading: "13. Reklama (art. 26)",
      paragraphs: [
        "Obecnie nie prezentujemy płatnych reklam podmiotów trzecich ani płatnych pozycji w wynikach wyszukiwania.",
        "Gdybyśmy wprowadzili reklamę, oznaczylibyśmy ją wyraźnie, wskazali reklamodawcę i główne parametry jej wyświetlania. Wykluczamy reklamę opartą na szczególnych kategoriach danych osobowych w rozumieniu art. 9 rozporządzenia (UE) 2016/679 oraz reklamę kierowaną do małoletnich opartą na profilowaniu.",
      ],
    },
  ],
};
