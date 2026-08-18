import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Polityka podatkowa",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsza strona wyjaśnia, jakie podatki i daniny mogą powstać przy rezerwacji za pośrednictwem myBestDays, kto jest ich dłużnikiem i jakie obowiązki sprawozdawcze ciążą na nas jako operatorze platformy.",
    "Nie stanowi porady podatkowej. W indywidualnej sprawie podatkowej prosimy zwrócić się do doradcy podatkowego.",
  ],
  sections: [
    {
      id: "gaeste",
      heading: "1. Co dotyczy gości",
      paragraphs: [
        "Prezentowana cena całkowita obejmuje podatki rozliczane przez platformę — w szczególności VAT od usługi noclegowej, o ile dostawca jest jego dłużnikiem.",
        "Daniny lokalne, takie jak opłata miejscowa, podatek od noclegów lub opłata turystyczna, są — zależnie od gminy — rozliczane przez platformę albo pobierane na miejscu. Który przypadek zachodzi, wskazujemy przed finalizacją rezerwacji.",
        "Fakturę za usługę noclegową wystawia dostawca; to on jest przedsiębiorcą świadczącym usługę. Jeżeli potrzebują Państwo faktury z wykazanym VAT, prosimy zwrócić się do dostawcy.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Co dotyczy dostawców",
      paragraphs: [
        "Dostawcy sami odpowiadają za prawidłowe rozliczenie podatkowe swoich dochodów — podatku dochodowego od osób fizycznych lub prawnych, VAT i danin lokalnych.",
        "To, czy najem podlega VAT i według jakiej stawki, wynika z prawa państwa, w którym znajduje się zakwaterowanie (miejsce świadczenia przy nieruchomościach).",
        "Dostawcy wprowadzają w obiekcie daniny obowiązujące dla ich zakwaterowania, aby były prawidłowo wskazane w ogłoszeniu.",
      ],
    },
    {
      id: "dac7",
      heading: "3. Raportowanie do organów podatkowych (DAC7)",
      paragraphs: [
        "Jako operator platformy cyfrowej jesteśmy zobowiązani na podstawie dyrektywy (UE) 2021/514 („DAC7”) i przepisów krajowych ją wdrażających do corocznego raportowania właściwemu organowi podatkowemu danych o dostawcach podlegających raportowaniu oraz o wynagrodzeniach uzyskanych przez platformę.",
        "Raportowane są w szczególności imię i nazwisko lub nazwa, adres, numer identyfikacji podatkowej, data urodzenia lub numer rejestrowy, dane rachunku do wypłat, adres zakwaterowania oraz wynagrodzenia wypłacone w poszczególnych kwartałach i potrącone opłaty.",
        "Dostawcy otrzymują kopię raportowanych danych ich dotyczących.",
        "Jeżeli dostawca mimo dwukrotnego wezwania nie udostępni danych niezbędnych do raportowania, jesteśmy zobowiązani wstrzymać wypłaty i zablokować konto.",
      ],
    },
    {
      id: "quellensteuer",
      heading: "4. Potrącenia",
      paragraphs: [
        "Jeżeli prawo danego państwa zobowiązuje nas do potrącenia i odprowadzenia podatku od wypłaty, czynimy to i wskazujemy potrącenie w rozliczeniu.",
      ],
    },
  ],
};
