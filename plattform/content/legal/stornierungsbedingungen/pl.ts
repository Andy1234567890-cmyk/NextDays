import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Warunki anulowania",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Każdy dostawca wybiera dla swojego zakwaterowania warunek anulowania. Który obowiązuje, wskazano w ogłoszeniu i w potwierdzeniu rezerwacji. Niniejsza strona opisuje warunki, które udostępniamy dostawcom.",
  ],
  sections: [
    {
      id: "modelle",
      heading: "1. Warunki anulowania w skrócie",
      paragraphs: [
        "Rozstrzygający jest zawsze warunek wskazany w ogłoszeniu. Terminy odnoszą się do początku dnia przyjazdu według czasu lokalnego zakwaterowania.",
      ],
      list: [
        "Elastyczny — bezpłatne anulowanie do 24 godzin przed przyjazdem. Później naliczana jest pierwsza noc, pozostałe noce są zwracane.",
        "Umiarkowany — bezpłatne anulowanie do 5 dni przed przyjazdem. Później naliczane jest 50 % ceny noclegu.",
        "Rygorystyczny — bezpłatne anulowanie do 14 dni przed przyjazdem, o ile rezerwacji dokonano co najmniej 14 dni przed przyjazdem. Później naliczane jest 50 % do 7 dni przed przyjazdem, a następnie pełna cena.",
        "Bezzwrotny — brak bezpłatnego anulowania. Cena jest z reguły niższa; na brak zwrotu zwracamy odrębnie uwagę przed rezerwacją.",
      ],
    },
    {
      id: "was-erstattet-wird",
      heading: "2. Co zwracamy w każdym przypadku",
      paragraphs: [
        "Niezależnie od wybranego warunku przy każdym anulowaniu zwracamy:",
      ],
      list: [
        "opłatę miejscową i inne daniny przechodnie, o ile zostały rozliczone przez platformę, a nocleg się nie odbywa;",
        "w całości kaucję pobraną przez platformę;",
        "usługi dodatkowe, które nie zostały wykonane.",
      ],
    },
    {
      id: "stornierung-durch-anbieter",
      heading: "3. Anulowanie przez dostawcę",
      paragraphs: [
        "Jeżeli anuluje dostawca, otrzymują Państwo w całości kwotę zapłaconą przez platformę — niezależnie od wybranego warunku anulowania.",
        "Dodatkowo pomożemy Państwu znaleźć porównywalne zakwaterowanie; zob. [Zasady przekwaterowania i zwrotów](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "widerruf",
      heading: "4. Brak ustawowego prawa odstąpienia",
      paragraphs: [
        "W przypadku usług noclegowych rezerwowanych na określony okres co do zasady nie przysługuje ustawowe prawo odstąpienia zgodnie z art. 16 lit. l) dyrektywy 2011/83/UE. Opisane tu warunki anulowania są zatem zobowiązaniem umownym, a nie realizacją prawa odstąpienia.",
        "Bezwzględnie obowiązujące prawa ustawowe, w szczególności uprawnienia z tytułu wad zakwaterowania, pozostają nienaruszone.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Zmiana zamiast anulowania",
      paragraphs: [
        "Jeżeli chcą Państwo zmienić okres lub liczbę podróżnych, prosimy złożyć wniosek o zmianę ze swojej rezerwacji. Dostawca musi wyrazić zgodę; do tego czasu obowiązuje pierwotna rezerwacja.",
        "Jeżeli zmiana prowadzi do wyższej ceny, różnica staje się wymagalna. Jeżeli prowadzi do ceny niższej, zwracamy różnicę w zakresie, w jakim obowiązujący warunek anulowania to dopuszcza dla odpadającej części.",
      ],
    },
    {
      id: "wie",
      heading: "6. Jak anulować",
      paragraphs: [
        "Anulowania dokonują Państwo na swoim koncie w zakładce „Rezerwacje”. Dla dochowania terminu rozstrzygający jest moment dotarcia anulowania do nas.",
        "Otrzymają Państwo potwierdzenie anulowania z kwotą zwrotu. O wypłacie zob. [Warunki płatności](https://mybestdays.dk/rechtliches/zahlungsbedingungen#rueckerstattungen).",
      ],
    },
  ],
};
