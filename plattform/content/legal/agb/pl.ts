import type { LegalDoc } from "../types";

// Polnische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. Zielgruppe sind Verbraucher (Gäste).
export const agb: LegalDoc = {
  title: "Warunki korzystania dla gości (Regulamin)",
  stand: "Stan na: 3 lipca 2026 r.",
  intro: [
    "Niniejsze warunki korzystania określają zasady korzystania z portalu rezerwacyjnego myNextDays (zwanego dalej „Platformą”) przez podróżnych i osoby dokonujące rezerwacji (zwane dalej „Gościem”).",
    "Operatorem Platformy jest [pełna firma, forma prawna, adres i dane rejestrowe operatora — uzupełnić przed publikacją] (zwana dalej „myNextDays” lub „my”).",
  ],
  sections: [
    {
      heading: "§ 1 Zakres obowiązywania",
      paragraphs: [
        "Niniejsze warunki mają zastosowanie do korzystania z Platformy, w szczególności do wyszukiwania obiektów noclegowych oraz rezerwowania usług noclegowych za pośrednictwem Platformy.",
        "Do samej usługi noclegowej dodatkowo mają zastosowanie warunki danego dostawcy (np. regulamin obiektu, warunki anulowania) wskazane w ofercie.",
      ],
    },
    {
      heading: "§ 2 Rola myNextDays; zawarcie umowy",
      paragraphs: [
        "myNextDays pośredniczy w usługach noclegowych oferowanych przez poszczególnych dostawców (agencje, wynajmujących lub właścicieli, zwanych dalej „Dostawcą”). Umowa o nocleg jest zawierana wyłącznie między Gościem a danym Dostawcą. myNextDays nie staje się stroną umowy o nocleg.",
        "Dany Dostawca jest wskazany w ofercie oraz w potwierdzeniu rezerwacji.",
      ],
    },
    {
      heading: "§ 3 Rezerwacja i potwierdzenie rezerwacji",
      paragraphs: [
        "Prezentacja obiektów noclegowych na Platformie stanowi zaproszenie do złożenia oferty rezerwacji. Kończąc proces rezerwacji (kliknięcie przycisku rezerwacji z obowiązkiem zapłaty), Gość składa wiążącą ofertę zawarcia umowy o nocleg z Dostawcą.",
        "Umowa zostaje zawarta z chwilą potwierdzenia rezerwacji. Potwierdzenie rezerwacji jest przesyłane Gościowi na podany adres e-mail.",
        "Gość jest zobowiązany do podania przy rezerwacji prawdziwych i kompletnych danych (w szczególności imienia i nazwiska, danych kontaktowych oraz liczby podróżnych).",
      ],
    },
    {
      heading: "§ 4 Ceny i płatność",
      paragraphs: [
        "Obowiązują ceny wskazane w ofercie w chwili rezerwacji, łącznie ze wskazanymi tam podatkami, opłatami i kosztami dodatkowymi. Ceny są wyświetlane w walucie wskazanej w ofercie. Na miejscu mogą zostać naliczone dodatkowe opłaty lokalne (np. opłata klimatyczna), o ile zostało to wskazane w ofercie.",
        "Płatność jest realizowana za pośrednictwem dostawcy usług płatniczych Stripe. Dane płatnicze (np. dane karty) są zbierane i przetwarzane bezpośrednio przez Stripe; myNextDays nie przechowuje pełnych danych kart. Stripe przetwarza dane osobowe zgodnie z [Polityką prywatności Stripe](https://stripe.com/privacy).",
        "Jeżeli w ofercie wskazano kaucję, może ona zostać preautoryzowana przy rezerwacji lub przyjeździe i w przypadku szkody zatrzymana w całości lub w części; miarodajne są informacje zawarte w ofercie.",
      ],
    },
    {
      heading: "§ 5 Anulowanie, zmiana rezerwacji i odstąpienie od umowy",
      paragraphs: [
        "To, czy i na jakich warunkach rezerwację można bezpłatnie anulować lub zmienić, wynika ze wskazanych w ofercie warunków anulowania danego Dostawcy.",
        "W przypadku usług noclegowych rezerwowanych na określony termin, zgodnie z art. 16 lit. l) dyrektywy UE w sprawie praw konsumentów lub odpowiednimi przepisami krajowymi, co do zasady nie przysługuje ustawowe prawo odstąpienia od umowy. Bezwzględnie obowiązujące ustawowe prawa Gościa pozostają nienaruszone.",
      ],
    },
    {
      heading: "§ 6 Obowiązki Gościa",
      paragraphs: [
        "Gość korzysta z obiektu zgodnie z umową, przestrzega wskazanej w ofercie maksymalnej liczby osób oraz stosuje się do regulaminu obiektu ustalonego przez Dostawcę.",
        "Platformy nie wolno nadużywać, w szczególności do dokonywania rezerwacji pozornych, oszukańczych płatności lub zamieszczania treści niezgodnych z prawem (np. w opiniach lub wiadomościach).",
      ],
    },
    {
      heading: "§ 7 Odpowiedzialność myNextDays",
      paragraphs: [
        "Za wykonanie usługi noclegowej odpowiada wyłącznie Dostawca. myNextDays nie odpowiada za prawidłowość treści ofert zamieszczanych przez Dostawców, wykonuje jednak pośrednictwo i obsługę płatności z należytą starannością wymaganą w obrocie profesjonalnym.",
        "myNextDays ponosi nieograniczoną odpowiedzialność za winę umyślną i rażące niedbalstwo oraz za szkody wynikające z naruszenia życia, ciała lub zdrowia. W przypadku zwykłego niedbalstwa myNextDays odpowiada wyłącznie za naruszenie istotnych obowiązków umownych (obowiązków kardynalnych), w granicach typowej dla umowy, możliwej do przewidzenia szkody. Bezwzględnie obowiązujące ustawowe zasady odpowiedzialności pozostają nienaruszone.",
      ],
    },
    {
      heading: "§ 8 Ochrona danych",
      paragraphs: [
        "myNextDays przetwarza dane osobowe Gościa w celu realizacji pośrednictwa i rezerwacji. Dane rezerwacji są przekazywane danemu Dostawcy w zakresie niezbędnym do wykonania umowy o nocleg. Do obsługi płatności stosuje się § 4.",
        "Szczegóły wynikają z informacji o ochronie danych Platformy.",
      ],
    },
    {
      heading: "§ 9 Reklamacje i rozstrzyganie sporów",
      paragraphs: [
        "Zastrzeżenia dotyczące obiektu Gość kieruje w pierwszej kolejności do Dostawcy; w sprawach dotyczących rezerwacji lub płatności pomaga zespół wsparcia myNextDays za pośrednictwem kanałów kontaktu wskazanych na Platformie.",
        "myNextDays nie jest zobowiązana i nie jest gotowa do udziału w postępowaniach w sprawie pozasądowego rozstrzygania sporów przed konsumenckim organem polubownym, o ile nie istnieje taki obowiązek ustawowy.",
      ],
    },
    {
      heading: "§ 10 Zmiany niniejszych warunków",
      paragraphs: [
        "myNextDays może zmienić niniejsze warunki ze skutkiem na przyszłość, o ile jest to konieczne z ważnych przyczyn (w szczególności z powodu zmian przepisów prawa lub orzecznictwa), a Gość nie zostanie przez to nadmiernie pokrzywdzony. Do już dokonanych rezerwacji stosuje się wersję obowiązującą w chwili rezerwacji.",
      ],
    },
    {
      heading: "§ 11 Postanowienia końcowe",
      paragraphs: [
        "Zastosowanie ma prawo państwa, w którym operator ma swoją siedzibę, z wyłączeniem Konwencji Narodów Zjednoczonych o umowach międzynarodowej sprzedaży towarów. Jeżeli Gość jest konsumentem, bezwzględnie obowiązujące przepisy o ochronie konsumentów państwa, w którym ma on miejsce zwykłego pobytu, pozostają nienaruszone.",
        "Jeżeli poszczególne postanowienia niniejszych warunków są lub staną się nieskuteczne, nie narusza to skuteczności pozostałych postanowień.",
      ],
    },
  ],
};
