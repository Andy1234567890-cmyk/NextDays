import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Deklaracja dostępności",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "myBestDays powinna być użyteczna dla wszystkich. Niniejsza deklaracja opisuje stan dostępności platformy, znane ograniczenia oraz sposób zgłaszania nam barier.",
    "Odnosi się do wymogów dyrektywy (UE) 2019/882 w sprawie wymogów dostępności produktów i usług, obowiązującej od 28 czerwca 2025 r. dla usług handlu elektronicznego.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stan dostępności",
      paragraphs: [
        "Kierujemy się normą zharmonizowaną EN 301 549 oraz leżącymi u jej podstaw wytycznymi Web Content Accessibility Guidelines (WCAG) 2.1 na poziomie zgodności AA.",
        "Wdrożono m.in.: pełną obsługę z klawiatury, widoczny fokus, semantyczną strukturę nagłówków, etykiety przy wszystkich polach formularzy, alternatywy tekstowe dla elementów sterujących, wystarczające kontrasty kolorystyczne, skalowalność tekstu bez utraty treści oraz prezentację dostosowującą się do rozmiaru ekranu.",
        "Teksty prawne dostępne są we wszystkich 24 językach urzędowych Unii i mają prawidłowe oznaczenie języka, aby czytniki ekranu odczytywały je poprawnie.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Znane ograniczenia",
      paragraphs: ["Obecnie niedostępne są w szczególności:"],
      list: [
        "Zdjęcia i opisy w ogłoszeniach pochodzą od dostawców; alternatywy tekstowe do zdjęć mogą brakować lub być niewystarczające. Zachęcamy dostawców do ich uzupełnienia.",
        "Osadzone mapy podmiotów trzecich obsługiwane są z klawiatury tylko w ograniczonym zakresie. Wszystkie informacje o lokalizacji dostępne są dodatkowo jako tekst.",
        "Dokumenty wgrane przez dostawców (np. regulamin obiektu w formacie PDF) nie są konsekwentnie oznaczone pod kątem dostępności.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Dostępność zakwaterowania",
      paragraphs: [
        "Niniejsza deklaracja dotyczy platformy, a nie zakwaterowania. Informacje o dostępności architektonicznej danego obiektu pochodzą od dostawcy.",
        "Jeżeli są Państwo zdani na określone rozwiązania — wejście bez progów, szerokość drzwi, prysznic bez brodzika, winda — prosimy ustalić je z dostawcą przez funkcję wiadomości przed rezerwacją. Nieprawdziwe informacje o dostępności stanowią naruszenie naszych zasad i można je zgłosić.",
      ],
    },
    {
      id: "melden",
      heading: "4. Zgłaszanie barier",
      paragraphs: [
        `Jeżeli napotkają Państwo barierę, prosimy zgłosić ją na adres ${ANBIETER.email} albo kanałami kontaktu wskazanymi w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Prosimy opisać, której strony to dotyczy, co chcieli Państwo zrobić i z jakich technologii wspomagających Państwo korzystają. Potwierdzamy wpływ i informujemy, jak i do kiedy usuniemy barierę.",
        "Jeżeli potrzebują Państwo informacji w formie dostępnej, udostępnimy ją na żądanie.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Postępowanie egzekucyjne",
      paragraphs: [
        "Jeżeli nie są Państwo zadowoleni z naszej odpowiedzi, mogą Państwo zwrócić się do organu właściwego w zakresie nadzoru rynku zgodnie z dyrektywą (UE) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (dawniej Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dania",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
