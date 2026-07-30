import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Zespół i uprawnienia",
  description: "Pracownicy, role i uprawnienia dostępu.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Dostęp",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Zapraszanie pracowników",
          excerpt: "Jak zaprosić nowych pracowników do swojego konta myNextDays.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Do swojej firmy możesz zaprosić dowolną liczbę pracowników — na przykład do recepcji, sprzątania lub administracji. Każde zaproszenie jest powiązane z adresem e-mail i od razu nadaje stałą rolę, która określa dostęp w wersji webowej i w aplikacji myNextDays.",
            },
            { type: "h2", text: "Wysyłanie zaproszenia" },
            {
              type: "steps",
              items: [
                "Otwórz „Konto” i przejdź do sekcji „Zespół”.",
                "Kliknij „Zaproś pracownika”.",
                "Wpisz adres e-mail danej osoby.",
                "Wybierz odpowiednią rolę, np. Pracownik lub Sprzątanie.",
                "Potwierdź zaproszenie.",
              ],
            },
            { type: "h2", text: "Co dzieje się potem" },
            {
              type: "p",
              text: "Zaproszona osoba otrzymuje e-mail z linkiem umożliwiającym ustawienie własnego hasła i zalogowanie się. Logowanie obowiązuje jednakowo dla panelu webowego i aplikacji myNextDays — nie ma osobnego konta dla każdego frontendu.",
            },
            {
              type: "ul",
              items: [
                "Zaproszenie jest ważne, dopóki nie zostanie przyjęte lub wycofane.",
                "Otwarte zaproszenia widzisz w sekcji „Zespół” ze statusem „Oczekujące”.",
                "Rolę można w każdej chwili później dostosować.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Które role widzą jakie obszary, dowiesz się w artykule [Role i uprawnienia](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nadaj od razu najwęższą pasującą rolę — uprawnienia można w każdej chwili później rozszerzyć.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Role i uprawnienia",
          excerpt: "Pięć ról w myNextDays i co każda z nich może robić.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rozróżnia pięć ról: Administrator, Współadministrator, Pracownik, Sprzątanie i Właściciel. Każda rola określa, które obszary są widoczne w panelu webowym i w aplikacji myNextDays — uprawnienia są przy tym wymuszane po stronie serwera, a nie tylko ukrywane w interfejsie.",
            },
            { type: "h2", text: "Przegląd ról" },
            {
              type: "ul",
              items: [
                "Administrator: pełny dostęp do wszystkich obszarów, łącznie z finansami, sprzedażą i zarządzaniem zespołem.",
                "Współadministrator: niemal pełny dostęp jak administrator, dla drugiego szczebla kierownictwa firmy.",
                "Pracownik: operacyjny dostęp do rezerwacji, kalendarza i zadań, bez wglądu w finanse lub sprzedaż.",
                "Sprzątanie: wyłącznie dostęp do przydzielonych zadań sprzątania i szczegółów obiektu, bez wglądu w finanse lub sprzedaż.",
                "Właściciel: wgląd tylko do odczytu we własne obiekty, bez zarządzania cudzymi obiektami.",
              ],
            },
            { type: "h2", text: "Przydzielanie lub zmiana roli" },
            {
              type: "steps",
              items: [
                "Otwórz „Konto” → „Zespół”.",
                "Wybierz odpowiedniego pracownika z listy.",
                "Kliknij „Zmień rolę”.",
                "Wybierz nową rolę i potwierdź.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pracownik i Sprzątanie zasadniczo nie widzą cen, przychodów ani kanałów rezerwacji — to wykluczenie obowiązuje po stronie serwera i nie da się go obejść przez interfejs.",
            },
            {
              type: "note",
              variant: "info",
              text: "Przegląd dla każdej roli znajdziesz w artykule [Co widzi która rola](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Co widzi która rola",
          excerpt: "Konkretne obszary i widoki dla każdej roli w wersji webowej i w aplikacji.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Oprócz podstawowych uprawnień z artykułu [Role i uprawnienia](/hilfe/team-rollen/rollen-berechtigungen) konkretne spojrzenie na poszczególne obszary pomaga ustawić właściwe oczekiwania przy wdrażaniu nowych pracowników.",
            },
            { type: "h2", text: "Kalendarz i rezerwacje" },
            {
              type: "p",
              text: "Administrator, Współadministrator i Pracownik widzą pełny plan obłożenia z danymi gości i zadaniami. Sprzątanie widzi tylko przydzielone mu terminy wraz z adresem obiektu i listą kontrolną, ale bez imion i nazwisk gości ani cen. Właściciele widzą kalendarz obłożenia wyłącznie dla swoich własnych obiektów, tylko do odczytu.",
            },
            { type: "h2", text: "Finanse i sprzedaż" },
            {
              type: "ul",
              items: [
                "Przychody, prowizje i faktury: tylko Administrator i Współadministrator.",
                "Portale (podłączenie OTA) i widoczność na platformie: tylko Administrator i Współadministrator.",
                "Pracownik i Sprzątanie: brak dostępu do obszarów finansowych lub sprzedażowych, także do stron szczegółowych.",
              ],
            },
            { type: "h2", text: "Zespół i ustawienia" },
            {
              type: "p",
              text: "Zarządzanie pracownikami, rolami i ustawieniami konta pozostaje zastrzeżone dla Administratora i Współadministratora. Właściciele i role operacyjne w ogóle nie widzą tego obszaru ani w aplikacji myNextDays, ani w panelu webowym.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ten podział obowiązuje identycznie w panelu webowym i w aplikacji myNextDays, ponieważ oba frontendy odpytują tę samą rolę z Twojego konta.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po zaproszeniu przetestuj krótko nowe role razem z pracownikiem, aby uniknąć nieporozumień co do widocznych obszarów.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Odbieranie dostępu",
          excerpt: "Natychmiastowe i pełne usunięcie dostępu pracownika.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Jeśli pracownik odchodzi z Twojej firmy lub zmienia się forma współpracy, usuń dostęp bezpośrednio w Koncie. Odebranie dostępu działa po stronie serwera i natychmiast — nie dopiero po wygaśnięciu istniejącej sesji.",
            },
            { type: "h2", text: "Usuwanie dostępu" },
            {
              type: "steps",
              items: [
                "Otwórz „Konto” → „Zespół”.",
                "Wybierz odpowiedniego pracownika.",
                "Kliknij „Odbierz dostęp”.",
                "Potwierdź proces.",
              ],
            },
            { type: "h2", text: "Wpływ na trwające sesje" },
            {
              type: "p",
              text: "Po odebraniu dostępu osoba nie może już ponownie zalogować się ani w panelu webowym, ani w aplikacji myNextDays. Już przydzielone zadania lub terminy sprzątania powinieneś wcześniej przypisać innemu pracownikowi, aby nic nie pozostało nieobsłużone.",
            },
            {
              type: "ul",
              items: [
                "Otwarte zadania przypisz na nowo przed odebraniem dostępu.",
                "Dostęp można później ponownie przywrócić przez zaproszenie.",
                "Odebranie dostępu dotyczy tylko tej firmy, a nie innych kont danej osoby.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Odbierz dostęp niezwłocznie, gdy tylko kończy się współpraca — otwarte konta pracowników pozostają w przeciwnym razie niepotrzebnym ryzykiem bezpieczeństwa.",
            },
          ],
        },
      ],
    },
  ],
};
