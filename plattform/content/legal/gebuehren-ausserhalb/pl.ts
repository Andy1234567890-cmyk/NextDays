import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Opłaty poza platformą",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsze zasady określają, jakich kwot dostawca może żądać poza platformą, a jakich nie. Chronią gości przed żądaniami zgłaszanymi na miejscu, których nie było w ogłoszeniu.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zasada",
      paragraphs: [
        "Wszystko, co należne za zarezerwowaną usługę, musi być wskazane w ogłoszeniu przed finalizacją rezerwacji — jako część ceny całkowitej albo jako pozycja kosztów na miejscu.",
        "Kwota niewskazana ani w cenie całkowitej, ani jako koszt na miejscu nie jest przez gościa należna.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Czego można żądać na miejscu",
      paragraphs: ["Na miejscu można żądać wyłącznie:"],
      list: [
        "kwot wyraźnie wskazanych w ogłoszeniu jako koszty na miejscu (np. sprzątanie końcowe, pakiet pościeli, miejsce parkingowe);",
        "danin lokalnych, takich jak opłata miejscowa, o ile przepisy lokalne wymagają jej uiszczenia na miejscu;",
        "kaucji wskazanej w ogłoszeniu;",
        "usług, które gość dobrowolnie zamawia dopiero na miejscu, po cenie podanej wcześniej;",
        "naprawienia udokumentowanych szkód wyrządzonych przez gościa.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Czego nie wolno żądać",
      paragraphs: ["Niedopuszczalne jest w szczególności:"],
      list: [
        "dopłata do ceny noclegu po finalizacji rezerwacji;",
        "opłata za to, że rezerwacji dokonano przez myBestDays;",
        "opłata manipulacyjna, rezerwacyjna lub za użycie karty niewskazana w ogłoszeniu;",
        "wezwanie do anulowania rezerwacji i ponownego zarezerwowania tego samego zakwaterowania poza platformą;",
        "wezwanie do zapłaty ceny lub jej części przelewem, gotówką albo za pośrednictwem usługi płatniczej poza platformą, gdy ogłoszenie przewiduje płatność przez platformę.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Omijanie platformy",
      paragraphs: [
        "Jeżeli kontakt między gościem a dostawcą nawiązano przez platformę, rezerwacji nie wolno realizować poza nią. Dotyczy to obu stron.",
        "Kto omija platformę, traci jej ochronę: płatności nie są zabezpieczone, nasze zasady anulowania i zwrotów nie mają zastosowania, a w razie sporu nie możemy pośredniczyć.",
        "Naruszenia mogą prowadzić do zablokowania konta. Wobec dostawców możemy ponadto dochodzić utraconej opłaty serwisowej.",
      ],
    },
    {
      id: "melden",
      heading: "5. Zgłaszanie",
      paragraphs: [
        "Jeżeli na miejscu zażądano od Państwa kwoty, której nie było w ogłoszeniu, prosimy jej nie płacić i zgłosić to nam kanałami kontaktu wskazanymi w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden). Jeżeli już Państwo zapłacili, pomożemy odzyskać kwotę.",
      ],
    },
  ],
};
