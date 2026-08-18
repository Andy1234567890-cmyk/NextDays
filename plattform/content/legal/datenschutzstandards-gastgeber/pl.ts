import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Standardy ochrony danych dla gospodarzy",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Oferując zakwaterowanie przez myBestDays, otrzymują Państwo dane osobowe swoich gości. W zakresie ich przetwarzania są Państwo samodzielnym administratorem w rozumieniu rozporządzenia (UE) 2016/679 (RODO). Niniejsze standardy opisują, czego od Państwa oczekujemy.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Ograniczenie celu",
      paragraphs: [
        "Danych gości używają Państwo wyłącznie do realizacji rezerwacji, komunikacji z gościem i wypełnienia swoich obowiązków ustawowych (np. karta meldunkowa, opłata miejscowa, obowiązki podatkowe i archiwizacyjne).",
        "Każde dalsze wykorzystanie — w szczególności reklama, newslettery, przekazywanie osobom trzecim, umieszczanie we własnej bazie gości na potrzeby późniejszych rezerwacji bezpośrednich — wymaga odrębnej podstawy prawnej, z reguły zgody gościa.",
        "Nie wykorzystują Państwo danych gości, aby skłonić ich do rezerwacji poza platformą.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Minimalizacja danych",
      paragraphs: [
        "Zbierają Państwo wyłącznie dane rzeczywiście potrzebne. Kopie dokumentów tożsamości pobierają Państwo tylko wtedy, gdy wymaga tego przepis prawa, i przechowują je wyłącznie przez czas przewidziany tym przepisem.",
        "Nie żądają Państwo danych płatniczych. Płatności przebiegają przez platformę.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Bezpieczeństwo",
      paragraphs: [
        "Chronią Państwo dane gości odpowiednimi środkami technicznymi i organizacyjnymi — dostęp wyłącznie dla osób, które go potrzebują, zabezpieczone urządzenia, szyfrowana transmisja.",
        "Jeżeli angażują Państwo pracowników, personel sprzątający lub współgospodarzy, zobowiązują ich Państwo do poufności i udostępniają wyłącznie dane niezbędne do ich zadania.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Przechowywanie i usuwanie",
      paragraphs: [
        "Dane gości usuwają Państwo, gdy tylko cel ustanie i nie istnieje już obowiązek przechowywania.",
        "Karty meldunkowe i dokumenty istotne podatkowo przechowują Państwo tak długo, jak wymaga tego prawo Państwa kraju — nie dłużej.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Prawa gości",
      paragraphs: [
        "Jeżeli gość zwróci się do Państwa z żądaniem dostępu, sprostowania, usunięcia lub sprzeciwu, rozpatrują je Państwo w terminie. Jeżeli dotyczy danych znajdujących się u nas, kierują Państwo gościa do nas.",
        "Informują Państwo swoich gości o sposobie przetwarzania ich danych w zakresie wykraczającym poza realizację rezerwacji.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Naruszenia ochrony danych",
      paragraphs: [
        "W razie naruszenia ochrony danych gości niezwłocznie informują Państwo właściwy organ nadzorczy oraz, gdy jest to wymagane, zainteresowanych gości.",
        "Jeżeli naruszenie dotyczy danych otrzymanych za pośrednictwem platformy, informują Państwo dodatkowo nas, abyśmy mogli ocenić własne obowiązki.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kamery i urządzenia rejestrujące",
      paragraphs: [
        "W pomieszczeniach z uzasadnionym oczekiwaniem prywatności — sypialnie, łazienki — kamery i mikrofony są niedopuszczalne, także wyłączone.",
        "Wszystkie pozostałe kamery, czujki ruchu z nagrywaniem, dzwonki z kamerą i czujniki dźwięku ujawniają Państwo w ogłoszeniu, wskazując ich położenie i to, co jest rejestrowane.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Skutki naruszeń",
      paragraphs: [
        "Naruszenia niniejszych standardów traktujemy jak naruszenia [Dodatkowych warunków dla gospodarzy](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) i możemy podjąć środki aż do zablokowania konta.",
      ],
    },
  ],
};
