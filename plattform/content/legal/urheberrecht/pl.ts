import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zasady dotyczące praw autorskich",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "myBestDays szanuje prawa osób trzecich i oczekuje tego samego od swoich użytkowników. Niniejsze zasady opisują, jak zgłosić naruszenie prawa autorskiego i jak je rozpatrujemy.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zasada",
      paragraphs: [
        "Kto zamieszcza treści na platformie, zapewnia, że dysponuje niezbędnymi prawami. Dotyczy to w szczególności zdjęć, rzutów, tekstów i wycinków map w ogłoszeniach.",
        "Zamieszczanie cudzych treści bez zezwolenia stanowi naruszenie [Warunków korzystania](https://mybestdays.dk/rechtliches/nutzungsbedingungen) i [Zasad dotyczących odpowiednich treści](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Zgłoszenie naruszenia",
      paragraphs: [
        "Naruszenie prawa autorskiego prosimy zgłosić przez funkcję zgłaszania przy danej treści albo przez punkt kontaktowy wskazany w [Akcie o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa). Zgłoszenie powinno zawierać:",
      ],
      list: [
        "dokładne oznaczenie kwestionowanej treści, w szczególności adres URL;",
        "opis utworu chronionego oraz dowód Państwa uprawnienia lub umocowania do działania w imieniu uprawnionego;",
        "uzasadnienie, dlaczego korzystanie jest niedozwolone;",
        "Państwa imię i nazwisko oraz adres do kontaktu;",
        "oświadczenie, że podane informacje są zgodne z najlepszą wiedzą prawdziwe i kompletne.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Jak rozpatrujemy zgłoszenia",
      paragraphs: [
        "Niezwłocznie potwierdzamy wpływ zgłoszenia i rozstrzygamy szybko oraz starannie.",
        "Jeżeli uznamy zgłoszenie za zasadne, usuwamy treść albo blokujemy do niej dostęp i informujemy osobę, która ją zamieściła, wskazując powody i drogę reklamacyjną.",
        "Jeżeli uznamy zgłoszenie za bezzasadne, informujemy o tym wraz z uzasadnieniem.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Sprzeciw osoby, której dotyczy",
      paragraphs: [
        "Jeżeli Państwa treść została usunięta, a uznają to Państwo za nieuzasadnione, mogą Państwo w terminie sześciu miesięcy złożyć bezpłatną reklamację. Prosimy wskazać, dlaczego są Państwo uprawnieni do korzystania.",
        "Jeżeli reklamacja okaże się zasadna, przywracamy treść.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Powtarzające się naruszenia",
      paragraphs: [
        "Konta, za pośrednictwem których wielokrotnie zamieszczane są treści naruszające prawo, blokujemy po uprzednim ostrzeżeniu. Odpowiada to art. 23 rozporządzenia (UE) 2022/2065.",
        "Analogicznie blokujemy funkcję zgłaszania osobom, które wielokrotnie składają zgłoszenia oczywiście bezzasadne.",
      ],
    },
  ],
};
