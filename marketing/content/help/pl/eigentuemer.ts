import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Właściciele i rozliczenia",
  description: "Konta właścicieli, rozliczenia i prowizje.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Właściciele",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Tworzenie właściciela",
          excerpt: "Jak utworzyć nowe konto właściciela w myNextDays.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Właściciele to osobne konta w myNextDays, za pomocą których zarządzasz obiektami należącymi do konkretnej osoby lub spółki. Konto właściciela otrzymuje ograniczony wgląd tylko do odczytu we własne obiekty, bez możliwości samodzielnego wprowadzania zmian w firmie.",
            },
            { type: "h2", text: "Tworzenie nowego konta właściciela" },
            {
              type: "steps",
              items: [
                "Otwórz sekcję „Właściciele” w menu głównym.",
                "Kliknij „Utwórz nowego właściciela”.",
                "Wpisz imię i nazwisko, adres e-mail oraz dane kontaktowe.",
                "W razie potrzeby dodaj adres do faktur na potrzeby rozliczeń.",
                "Zapisz konto.",
              ],
            },
            { type: "h2", text: "Konfiguracja dostępu" },
            {
              type: "p",
              text: "Po utworzeniu możesz wysłać właścicielowi zaproszenie do własnego dostępu. Właściciel loguje się wtedy własnymi danymi dostępowymi i widzi wyłącznie przypisane mu obiekty.",
            },
            {
              type: "ul",
              items: [
                "Konto właściciela może obejmować kilka obiektów.",
                "Każdy obiekt należy dokładnie do jednego właściciela.",
                "Dane kontaktowe i adres do faktur można w każdej chwili później dostosować.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jak przypisać istniejący obiekt do właściciela, przeczytasz w artykule [Przypisywanie obiektu do właściciela](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Przypisywanie obiektu do właściciela",
          excerpt: "Każdy obiekt należy dokładnie do jednego właściciela — tak konfigurujesz przypisanie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "W myNextDays każdy obiekt należy dokładnie do jednego właściciela. Wielokrotne przypisanie nie jest przewidziane — jeśli obiekt ma należeć do innego właściciela, najpierw usuń istniejące przypisanie, zanim ustawisz nowe.",
            },
            { type: "h2", text: "Dokonywanie przypisania" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt w sekcji „Obiekty”.",
                "Przejdź do zakładki „Właściciel”.",
                "Wybierz odpowiedzialnego właściciela z listy.",
                "Potwierdź przypisanie.",
                "Zapisz zmianę w obiekcie.",
              ],
            },
            { type: "h2", text: "Zmiana właściciela" },
            {
              type: "p",
              text: "Jeśli zmienia się właściciel obiektu, na przykład w wyniku sprzedaży, zastąp istniejące przypisanie nowym. Już utworzone rozliczenia za minione okresy pozostają przy tym przypisane pierwotnemu właścicielowi.",
            },
            {
              type: "ul",
              items: [
                "Obiekt może w danym momencie być przypisany tylko do jednego właściciela.",
                "Bez przypisania obiekt nie pojawia się w żadnym dostępie właściciela.",
                "Minione rozliczenia pozostają zachowane u pierwotnego właściciela.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Wielokrotne przypisanie obiektu do kilku właścicieli jest wykluczone — system nie dopuszcza drugiego jednoczesnego przypisania.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Rozliczenie właściciela (zestawienie)",
          excerpt: "Jak utworzyć zestawienie z przychodami pomniejszonymi o prowizję dla właściciela.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Rozliczenie właściciela, zwane też zestawieniem, podsumowuje dla wybranego okresu wszystkie przychody przypisanych obiektów i odlicza ustaloną przez Ciebie prowizję. Wynikiem jest kwota, którą wypłacasz właścicielowi.",
            },
            { type: "h2", text: "Tworzenie zestawienia" },
            {
              type: "steps",
              items: [
                "Otwórz sekcję „Właściciele” i wybierz żądanego właściciela.",
                "Przejdź do zakładki „Rozliczenie”.",
                "Wybierz okres rozliczeniowy.",
                "Sprawdź wymienione rezerwacje i przychody dla każdego obiektu.",
                "Utwórz zestawienie z odliczoną prowizją.",
              ],
            },
            { type: "h2", text: "Struktura zestawienia" },
            {
              type: "p",
              text: "Zestawienie wymienia dla każdego obiektu przychody brutto z rezerwacji, odliczoną od nich prowizję oraz wynikającą z tego kwotę wypłaty. Koszty dodatkowe, takie jak sprzątanie lub opłaty, mogą być, w zależności od umowy, wykazane osobno.",
            },
            {
              type: "ul",
              items: [
                "Przychody brutto: suma wszystkich rezerwacji w danym okresie dla każdego obiektu.",
                "Prowizja: Twój ustalony udział, odliczany od przychodów.",
                "Kwota wypłaty: przychody pomniejszone o prowizję i ewentualnie inne pozycje.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kwoty w zestawieniu są zawsze podawane w walucie obiektu — nie ma żadnej ogólnej waluty domyślnej.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Twórz zestawienia regularnie w tym samym dniu odniesienia, aby właściciele mieli niezawodny rytm swoich wypłat.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Dostęp dla właściciela",
          excerpt: "Co właściciele widzą w swoim dostępie tylko do odczytu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Dostęp dla właściciela to osobne logowanie do myNextDays tylko do odczytu. Właściciele widzą w nim wyłącznie przypisane im obiekty oraz powiązane obłożenia i rozliczenia — bez możliwości samodzielnej zmiany ustawień.",
            },
            { type: "h2", text: "Co widzą właściciele" },
            {
              type: "ul",
              items: [
                "Kalendarz obłożenia swoich własnych obiektów.",
                "Utworzone zestawienia z przychodami i odliczoną prowizją.",
                "Dane podstawowe swoich obiektów, na przykład wyposażenie i opis.",
              ],
            },
            { type: "h2", text: "Aktywacja dostępu" },
            {
              type: "steps",
              items: [
                "Otwórz właściciela w sekcji „Właściciele”.",
                "Kliknij „Zaproś do dostępu”.",
                "Właściciel otrzymuje e-mail w celu ustawienia własnego hasła.",
                "Po zalogowaniu właściciel widzi automatycznie tylko przypisane mu obiekty.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dostęp dla właściciela jest ściśle tylko do odczytu: ceny, dostępność czy dane obiektu może zmieniać wyłącznie Ty jako firma, nie sam właściciel.",
            },
            {
              type: "note",
              variant: "info",
              text: "Więcej o przypisywaniu obiektów znajdziesz w artykule [Przypisywanie obiektu do właściciela](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
