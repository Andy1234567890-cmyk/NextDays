import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Zadania i sprzątanie",
  description: "Organizuj plany sprzątania i zadania zespołu.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Prowadzenie działalności",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Tworzenie zadań",
          excerpt: "Jak utworzyć nowe zadanie dla obiektu lub okresu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Zadania łączą wszystko, co trzeba zrobić wokół obiektu — od sprzątania po wymeldowaniu, przez prace konserwacyjne, po zapytania gości. Każde zadanie jest przypisane dokładnie do jednego obiektu i może zostać przydzielone członkowi zespołu.",
            },
            { type: "h2", text: "Tworzenie nowego zadania" },
            {
              type: "steps",
              items: [
                "Otwórz sekcję „Zadania” w menu głównym.",
                "Kliknij „Nowe zadanie”.",
                "Wybierz dotknięty obiekt.",
                "Nadaj tytuł i opcjonalnie opis.",
                "Ustal datę i godzinę terminu.",
                "Zapisz zadanie.",
              ],
            },
            { type: "h2", text: "Rodzaje zadań" },
            {
              type: "p",
              text: "Oprócz dowolnych zadań istnieją zadania generowane przez system, na przykład automatycznie zaplanowane sprzątania po wymeldowaniu. Są one już powiązane z obiektem i odpowiednim przedziałem czasowym i wystarczy je jedynie przypisać członkowi zespołu.",
            },
            {
              type: "ul",
              items: [
                "Zadanie ręczne: wprowadzone dowolnie, np. konserwacja lub specjalne życzenie.",
                "Automatyczne zadanie sprzątania: wyprowadzone z daty wymeldowania.",
                "Zadanie cykliczne: dla regularnych kontroli lub inspekcji.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Szczegóły dotyczące automatycznego planowania czasowego znajdziesz w artykule [Plany sprzątania](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nadawaj precyzyjne tytuły — członkowie zespołu w widoku mobilnym często widzą na pierwszy rzut oka tylko tytuł i obiekt.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Plany sprzątania",
          excerpt: "Zaplanuj sprzątania po wymeldowaniu automatycznie.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Plan sprzątania sprawia, że po każdym wymeldowaniu automatycznie powstaje zadanie sprzątania dla dotkniętego obiektu — bez konieczności ręcznego śledzenia każdej rezerwacji. Zmniejsza to liczbę zapomnianych przekazań i zapewnia niezawodny przebieg między dwoma pobytami.",
            },
            { type: "h2", text: "Aktywacja automatycznego planowania" },
            {
              type: "steps",
              items: [
                "Otwórz obiekt i przejdź do zakładki „Sprzątanie”.",
                "Aktywuj „Planuj sprzątanie automatycznie po wymeldowaniu”.",
                "Ustal, ile czasu po wymeldowaniu przeznaczone jest na sprzątanie.",
                "Opcjonalnie określ domyślny zespół lub domyślną osobę sprzątającą.",
                "Zapisz ustawienie.",
              ],
            },
            { type: "h2", text: "Współdziałanie z kalendarzem" },
            {
              type: "p",
              text: "Gdy tylko rezerwacja zostanie anulowana lub przesunięta, powiązane zadanie sprzątania automatycznie dostosowuje się do nowej daty wymeldowania. Dzięki temu plan sprzątania pozostaje zawsze zsynchronizowany z rzeczywistym stanem obłożenia.",
            },
            {
              type: "ul",
              items: [
                "Sprzątanie powstaje automatycznie przy każdym wymeldowaniu z aktywnym planem.",
                "Jeśli rezerwacja się przesuwa, zadanie sprzątania przesuwa się razem z nią.",
                "Jeśli gość anuluje pobyt, zadanie sprzątania jest usuwane.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez aktywowanego planu sprzątania nie powstają automatyczne zadania — utwórz wtedy sprzątania ręcznie w artykule [Tworzenie zadań](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Przydzielanie zadań",
          excerpt: "Celowo przydzielaj zadania osobom sprzątającym lub członkom zespołu.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Aby zadanie zostało wykonane, przydzielasz je konkretnemu członkowi zespołu — na przykład osobie sprzątającej lub pracownikowi odpowiedzialnemu za konserwację. Domyślnie tylko przydzielona osoba widzi zadanie we własnym przeglądzie.",
            },
            { type: "h2", text: "Ręczne przydzielanie zadania" },
            {
              type: "steps",
              items: [
                "Otwórz zadanie na liście „Zadania”.",
                "Kliknij „Przydziel”.",
                "Wybierz odpowiedzialnego członka zespołu z listy.",
                "Potwierdź przydzielenie.",
              ],
            },
            { type: "h2", text: "Przydzielanie według obiektu" },
            {
              type: "p",
              text: "Jeśli osoba sprzątająca ma już na stałe przypisany obiekt, możesz sprawić, aby zadania dla tego obiektu były przydzielane tej osobie automatycznie. Oszczędza to kliknięcia przy powtarzających się sprzątaniach i zmniejsza liczbę pytań zwrotnych.",
            },
            {
              type: "ul",
              items: [
                "Przydzielanie ręczne: osobę wybierasz sam dla każdego zadania.",
                "Stałe przypisanie do obiektu: nowe zadania dla tego obiektu trafiają automatycznie do zapisanej osoby.",
                "Zadanie ma zawsze dokładnie jedną odpowiedzialną osobę.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Osoby sprzątające i pracownicy widzą wyłącznie swoje własne przydzielone zadania, bez danych finansowych ani sprzedażowych obiektu.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Śledzenie statusu zadań",
          excerpt: "Miej na bieżąco wgląd w stan realizacji zadań w czasie rzeczywistym.",
          updated: "Zaktualizowano: lipiec 2026",
          body: [
            {
              type: "p",
              text: "Każde zadanie przechodzi przez wyraźny status — od otwartego przez w trakcie realizacji aż po zakończone. Dzięki temu w każdej chwili widzisz, czy sprzątanie lub konserwacja zostaną ukończone na czas przed kolejnym zameldowaniem.",
            },
            { type: "h2", text: "Przegląd statusów" },
            {
              type: "ul",
              items: [
                "Otwarte: zadanie jest utworzone, ale jeszcze nie rozpoczęte.",
                "W trakcie realizacji: przydzielona osoba rozpoczęła zadanie.",
                "Zakończone: zadanie jest wykonane i potwierdzone.",
              ],
            },
            { type: "h2", text: "Aktualizacja statusu" },
            {
              type: "steps",
              items: [
                "Otwórz zadanie z listy „Zadania”.",
                "Wybierz odpowiedni status, np. „W trakcie realizacji” lub „Zakończone”.",
                "W razie potrzeby dodaj krótką notatkę, na przykład o nieprawidłowościach w obiekcie.",
                "Zapisz zmianę.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Zmiany statusu pojawiają się natychmiast na współdzielonej liście zadań — ręczne ponowne ładowanie nie jest potrzebne.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jeśli sprzątanie jest wciąż otwarte tuż przed kolejnym zameldowaniem, sprawdź najpierw przydzielenie, zanim skontaktujesz się z gościem.",
            },
          ],
        },
      ],
    },
  ],
};
