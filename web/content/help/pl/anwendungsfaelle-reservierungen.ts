import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezerwacje i kalendarz",
  description: "Zachowaj kontrolę nad rezerwacjami i kalendarzem.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezerwacje i kalendarz",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Niezawodne unikanie przepełnienia rezerwacjami",
          excerpt: "Jak zapewnić, że obiekt nigdy nie zostanie zarezerwowany podwójnie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Obiekt jest sprzedawany jednocześnie przez kilka kanałów — portale takie jak Booking, Airbnb i inne, własną platformę oraz aplikację. Przepełnienie rezerwacjami powstaje, gdy dostępność na jednym kanale nie zostaje zablokowana na czas po dokonaniu rezerwacji na innym kanale.",
            },
            {
              type: "steps",
              items: [
                "Sprawdź w planie obłożenia, że każdy obiekt to dokładnie jeden wiersz z jedną jednostką do rezerwacji — bez wspólnej pojemności kilku pokoi.",
                "Twórz nowe rezerwacje wyłącznie przez plan obłożenia lub podłączone kanały, nigdy przez ręczne opisywanie pojedynczych dni.",
                "Po każdej rezerwacji skontroluj, że zarezerwowane noce natychmiast pojawiają się w kalendarzu jako zajęte.",
                "Przy problemach technicznych lub konserwacji od razu skorzystaj ze stop sprzedaży, zamiast pozostawiać dzień otwarty.",
                "W razie niejasności sprawdź oś czasu dotkniętej rezerwacji, aby prześledzić przebieg czasowy.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nigdy nie zmieniaj nocy ani blokad ręcznie poza planem obłożenia — tylko wtedy masz pewność, że wszystkie kanały widzą ten sam stan dostępności i nie powstaje luka umożliwiająca podwójną rezerwację.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Przeniesienie rezerwacji do innego obiektu",
          excerpt: "Jak poprawnie przenieść istniejącą rezerwację do innego obiektu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Czasem gość musi przenieść się z jednego obiektu do innego, na przykład z powodu usterki technicznej lub na życzenie gościa. Podczas przeniesienia dotychczasowe noce w kalendarzu są automatycznie zwalniane i ponownie zajmowane w obiekcie docelowym.",
            },
            {
              type: "steps",
              items: [
                "Otwórz dotkniętą rezerwację na osi czasu rezerwacji.",
                "W menu akcji wybierz „Zmień obiekt” lub „Przenieś”.",
                "Wybierz obiekt docelowy i sprawdź jego dostępność w wybranym okresie.",
                "Potwierdź przeniesienie.",
                "Następnie sprawdź w planie obłożenia, że stare noce w pierwotnym obiekcie są ponownie wyświetlane jako dostępne.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zwolnienie starych nocy przejmuje automatycznie system — nie musisz sam ręcznie otwierać pierwotnego okresu. Poinformuj gościa o zmianie obiektu, zwłaszcza jeśli różni się wyposażenie lub dostęp.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Tworzenie rezerwacji długoterminowej",
          excerpt: "Jak poprawnie utworzyć rezerwację na dłuższy okres.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "h2",
              text: "Sytuacja wyjściowa",
            },
            {
              type: "p",
              text: "Dla gości długoterminowych — na przykład na kilka tygodni lub miesięcy — tworzysz rezerwację jak zwykle, ale dodatkowo zwracasz uwagę na minimalny pobyt, zasady płatności i widoczność obiektu na kanałach przez cały okres.",
            },
            {
              type: "steps",
              items: [
                "Otwórz plan obłożenia żądanego obiektu i zaznacz cały okres.",
                "Utwórz rezerwację z danymi gościa oraz planowaną datą przyjazdu i wyjazdu.",
                "W razie potrzeby ustal zasadę płatności z zaliczką i płatnością końcową, zamiast od razu wymagać pełnej kwoty.",
                "Sprawdź, czy żadna reguła minimalnego lub maksymalnego pobytu nie jest sprzeczna z długim okresem.",
                "Zapisz rezerwację i skontroluj, że cały okres jest poprawnie wyświetlany w kalendarzu jako zajęty.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Przy bardzo długich pobytach zaleca się płatność końcową w kilku ratach zamiast jednej dużej płatności jednorazowej — dzięki temu ryzyko płatnicze pozostaje pod kontrolą. Szczegóły w artykule [Automatyzacja płatności końcowej](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
