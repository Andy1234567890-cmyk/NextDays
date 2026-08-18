import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zasady przy poważnych zakłóceniach",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Czasem zdarzenie uniemożliwia podróż lub pobyt, a nie odpowiada za nie ani gość, ani dostawca. Niniejsze zasady opisują, o jakie zdarzenia chodzi i co wówczas obowiązuje.",
    "Mają pierwszeństwo przed warunkiem anulowania wybranym w ogłoszeniu.",
  ],
  sections: [
    {
      id: "erfasst",
      heading: "1. Jakie zdarzenia są objęte",
      paragraphs: [
        "Objęte są zdarzenia zaistniałe po rezerwacji, nieprzewidywalne dla obu stron i czyniące podróż lub pobyt niemożliwym albo prawnie niedopuszczalnym:",
      ],
      list: [
        "urzędowe zakazy podróży lub pobytu, godziny policyjne i zamknięcia granic dotyczące miejsca docelowego lub miejsca wyjazdu;",
        "klęski i zjawiska naturalne dotykające miejsca docelowego — trzęsienie ziemi, powódź, wichura, wielki pożar, wybuch wulkanu;",
        "wojna, konflikty zbrojne, zamachy terrorystyczne i zamieszki w miejscu docelowym;",
        "stwierdzona przez organy epidemia lub pandemia wraz ze środkami zakazującymi pobytu;",
        "długotrwała awaria dostaw energii elektrycznej, wody lub ciepła w miejscu docelowym;",
        "całkowity brak możliwości dotarcia do miejsca docelowego wskutek jednego z powyższych zdarzeń.",
      ],
    },
    {
      id: "nicht-erfasst",
      heading: "2. Jakie zdarzenia nie są objęte",
      paragraphs: ["Nie są objęte w szczególności:"],
      list: [
        "choroba lub uraz gościa albo jego bliskich — służy temu ubezpieczenie podróżne;",
        "przeszkody zawodowe, terminy egzaminów lub odwołanie urlopu;",
        "odwołanie wydarzenia, na które zarezerwowano podróż, jeżeli zakwaterowanie pozostaje zdatne do użytku;",
        "pogoda niebędąca klęską żywiołową — deszcz, chłód, upał, brak śniegu;",
        "awaria pojedynczych środków transportu, dopóki możliwy pozostaje rozsądny dojazd;",
        "odwołanie lotu lub strajk u przewoźnika — w tym zakresie przysługują roszczenia wobec przewoźnika.",
      ],
    },
    {
      id: "folgen",
      heading: "3. Co obowiązuje, gdy nastąpi objęte zdarzenie",
      paragraphs: [
        "Jeżeli zdarzenie dotyczy okresu Państwa rezerwacji, mogą Państwo anulować bezpłatnie. Otrzymają Państwo pełny zwrot kwoty zapłaconej przez platformę.",
        "Jeżeli pobyt już się rozpoczął, zwracamy część przypadającą na noce, z których nie można już skorzystać.",
        "Takie anulowanie nie powoduje dla dostawcy żadnych niekorzystnych skutków w ocenie jego rzetelności.",
        "Alternatywnie mogą Państwo uzgodnić z dostawcą przesunięcie terminu; pomożemy przy zmianie rezerwacji.",
      ],
    },
    {
      id: "geltendmachung",
      heading: "4. Jak się na to powołać",
      paragraphs: [
        "Prosimy skontaktować się z nami kanałami wskazanymi w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden), podając numer rezerwacji i zdarzenie.",
        "Weryfikujemy na podstawie źródeł publicznie dostępnych — aktów organów, ostrzeżeń urzędowych, doniesień uznanych źródeł informacyjnych — i rozstrzygamy szybko.",
        "Jeżeli sytuacji nie da się jeszcze ocenić ostatecznie, czekamy na rozwój wypadków do momentu tuż przed dniem przyjazdu i wtedy decydujemy. Do tego czasu Państwa rezerwacja pozostaje niezmieniona.",
      ],
    },
  ],
};
