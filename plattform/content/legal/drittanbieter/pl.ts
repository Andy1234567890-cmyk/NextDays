import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Podmioty trzecie i usługi płatnicze",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "myBestDays korzysta z usług podmiotów trzecich przy prowadzeniu platformy. Niniejsza strona wymienia je i wyjaśnia ich rolę oraz to, czyje warunki mają zastosowanie.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zasada",
      paragraphs: [
        "Tam, gdzie podmiot trzeci świadczy usługę bezpośrednio na Państwa rzecz, obok naszych obowiązują jego warunki i jego polityka prywatności. Wskazujemy na to w odpowiednim miejscu.",
        "Tam, gdzie podmiot trzeci przetwarza dane wyłącznie na nasze zlecenie, pozostajemy Państwa punktem kontaktu. Podmioty przetwarzające, z których korzystamy, wymieniono w [Polityce prywatności](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Dostawca usług płatniczych",
      paragraphs: [
        "Płatności za pośrednictwem platformy obsługuje Stripe. Stripe zbiera i przetwarza dane płatnicze bezpośrednio i jest w tym zakresie samodzielnym administratorem. Dodatkowo obowiązuje [polityka prywatności Stripe](https://stripe.com/privacy).",
        "Na potrzeby wypłat dla gospodarzy Stripe przeprowadza wymaganą prawem weryfikację tożsamości.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Dyrektywa o usługach płatniczych i dostęp podmiotów trzecich",
      paragraphs: [
        "Dyrektywa (UE) 2015/2366 („PSD2”) wymaga silnego uwierzytelniania klienta przy wielu płatnościach. Przeprowadza je Państwa bank lub wydawca karty; bez pomyślnego uwierzytelnienia płatność może zostać odrzucona.",
        "myBestDays nie jest usługą inicjowania płatności ani usługą dostępu do informacji o rachunku i nie ma dostępu do Państwa rachunków bankowych.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Mapy, obrazy i treści osadzone",
      paragraphs: [
        "Do prezentacji map i informacji o lokalizacji osadzamy usługi map podmiotów trzecich. Wczytanie takich treści może spowodować przekazanie danych danemu dostawcy; szczegóły i sterowanie zgodą opisano w [Polityce plików cookie](https://mybestdays.dk/rechtliches/cookies).",
        "Zdjęcia i opisy w ogłoszeniach pochodzą od danego dostawcy, nie od nas.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Strony, do których prowadzą odnośniki",
      paragraphs: [
        "Platforma może odsyłać do stron podmiotów trzecich. Nie mamy wpływu na ich treść i nie ponosimy za nią odpowiedzialności. Gdy powzięliśmy wiedzę o naruszeniu prawa, niezwłocznie usuwamy odnośnik.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Sklepy z aplikacjami",
      paragraphs: [
        "Jeżeli pobierają Państwo aplikację myBestDays ze sklepu z aplikacjami, obowiązują dodatkowo warunki operatora tego sklepu. Operator sklepu nie jest stroną umowy między Państwem a nami i nie jest zobowiązany do wsparcia ani gwarancji za aplikację.",
      ],
    },
  ],
};
