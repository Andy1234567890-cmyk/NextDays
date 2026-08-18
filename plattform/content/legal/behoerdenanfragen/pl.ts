import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zasady dotyczące wniosków organów i organów ścigania",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsze zasady adresowane są do organów, sądów i organów ścigania, które żądają od myBestDays danych albo kierują nakaz dotyczący treści. Są tu jawne, aby również użytkownicy mogli sprawdzić, na jakich warunkach udostępniamy dane.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zasada",
      paragraphs: [
        "Dane użytkowników udostępniamy wyłącznie wtedy, gdy istnieje ważna podstawa prawna, a wniosek spełnia wymogi formalne. Nieformalna prośba o dane nie wystarcza.",
        "Badamy każdy wniosek pod kątem właściwości, podstawy prawnej, określoności i proporcjonalności i udostępniamy wyłącznie dane wskazane we wniosku.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Wymogi wobec wniosku",
      paragraphs: ["Wniosek powinien zawierać:"],
      list: [
        "organ wnioskujący, sygnaturę sprawy i dane kontaktowe osoby prowadzącej, na papierze firmowym;",
        "podstawę prawną wynikającą z prawa krajowego lub prawa Unii;",
        "dokładne oznaczenie osoby lub konta, których dotyczy — adres e-mail, numer rezerwacji lub adres URL ogłoszenia;",
        "dokładnie oznaczone dane i okres;",
        "w stosownych przypadkach orzeczenie sądu, o ile wymaga tego prawo właściwe;",
        "wskazanie, jeżeli poinformowanie osoby, której dane dotyczą, zagroziłoby postępowaniu, wraz z podaniem podstawy prawnej.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Nakazy na podstawie rozporządzenia (UE) 2022/2065",
      paragraphs: [
        "Nakazy podjęcia działań przeciwko treściom nielegalnym (art. 9) i nakazy udzielenia informacji (art. 10) muszą zawierać wskazane tam elementy, w szczególności podstawę prawną, dokładną lokalizację elektroniczną, uzasadnienie, środki odwoławcze i język.",
        "Potwierdzamy wpływ i informujemy organ wydający, jakie środki podjęliśmy i kiedy.",
        "O nakazie informujemy osobę, której dotyczy, najpóźniej w chwili jego wykonania, chyba że organ zarządzi odroczenie, wskazując podstawę prawną.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Sytuacje nadzwyczajne",
      paragraphs: [
        "W razie bezpośredniego zagrożenia życia lub zdrowia udostępniamy dane niezbędne do jego odwrócenia także bez uprzedniego formalnego nakazu. Prosimy wyraźnie oznaczyć taki wniosek jako sytuację nadzwyczajną i opisać zagrożenie.",
        "W razie przesłanek wskazujących na przestępstwo stwarzające zagrożenie dla życia lub bezpieczeństwa osoby zawiadamiamy właściwe organy z własnej inicjatywy (art. 18 rozporządzenia (UE) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Jakie dane posiadamy",
      paragraphs: [
        "Kategorie przetwarzanych przez nas danych i okresy ich przechowywania wskazano w [Polityce prywatności](https://mybestdays.dk/rechtliches/datenschutz). Poza wskazanymi tam terminami nie przechowujemy żadnych danych.",
        "Nie prowadzimy przechowywania wykraczającego poza potrzebę. Wezwanie do tymczasowego zabezpieczenia danych na potrzeby toczącego się postępowania realizujemy w granicach prawnie dopuszczalnych.",
        "Nie dysponujemy pełnymi danymi płatniczymi; należy ich żądać od dostawcy usług płatniczych.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Informowanie osoby, której dane dotyczą",
      paragraphs: [
        "Informujemy zainteresowanych użytkowników o wniosku dotyczącym ich danych, chyba że zakazuje tego przepis prawa lub uzasadniony nakaz organu albo istnieje bezpośrednie zagrożenie życia lub zdrowia.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Dokąd kierować wnioski",
      paragraphs: [
        "Wnioski prosimy kierować do pojedynczego punktu kontaktowego dla organów wskazanego w [Akcie o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa). Rozpatrujemy je w języku niemieckim, duńskim i angielskim.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Przejrzystość",
      paragraphs: [
        "Liczbę i rodzaj nakazów organów wskazujemy w naszym rocznym sprawozdaniu z przejrzystości; zob. [Akt o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
