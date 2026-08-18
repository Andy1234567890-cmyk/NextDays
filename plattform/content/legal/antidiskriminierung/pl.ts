import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Polityka niedyskryminacji",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "myBestDays jest otwarta dla wszystkich. Kto rezerwuje lub oferuje za pośrednictwem platformy, nie może nikogo traktować gorzej ze względu na cechy osobiste.",
    "Niniejsza polityka stanowi część [Warunków korzystania](https://mybestdays.dk/rechtliches/nutzungsbedingungen) i dotyczy zarówno gości, jak i dostawców.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zasada",
      paragraphs: [
        "W myBestDays niedopuszczalne jest gorsze traktowanie osoby ze względu na pochodzenie, kolor skóry, obywatelstwo, przynależność etniczną, religię lub światopogląd, płeć, tożsamość płciową, orientację seksualną, niepełnosprawność, wiek lub stan cywilny.",
        "Dotyczy to przyjmowania lub odrzucania rezerwacji, cen i warunków, traktowania podczas pobytu oraz komunikacji za pośrednictwem platformy.",
        "Dodatkowo obowiązuje art. 20 rozporządzenia (UE) 2018/302: dostawcy nie mogą ograniczać dostępu do swojej oferty ze względu na obywatelstwo, miejsce zamieszkania lub miejsce prowadzenia działalności gościa w Unii.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Co to oznacza dla dostawców",
      paragraphs: ["Jako dostawca nie mogą Państwo w szczególności:"],
      list: [
        "odrzucić zapytania rezerwacyjnego ze względu na którąkolwiek z wymienionych cech;",
        "żądać od gości odmiennych cen, kaucji lub warunków dlatego, że mają jedną z tych cech;",
        "oświadczać w ogłoszeniu lub w wiadomościach, że określone grupy osób są niepożądane;",
        "odmawiać przyjęcia psów asystujących lub psów przewodników, nawet jeżeli regulamin obiektu wyklucza zwierzęta;",
        "traktować gościa odmiennie ze względu na miejsce zamieszkania w innym państwie członkowskim Unii.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Co pozostaje dozwolone",
      paragraphs: [
        "Mogą Państwo określić maksymalne obłożenie, minimalny wiek osoby rezerwującej oraz rzeczowe zasady regulaminu (np. zakaz palenia lub godziny ciszy), o ile obowiązują jednakowo wszystkich gości.",
        "Jeżeli sami zamieszkują Państwo obiekt i dzielą przestrzeń z gościem, mogą to Państwo jasno wskazać w ogłoszeniu; cechy z sekcji 1 mimo to nie uzasadniają odmowy.",
        "Mogą Państwo odrzucić rezerwację, gdy istnieją konkretne przesłanki naruszenia regulaminu obiektu lub oszustwa. Powód musi odnosić się do zachowania, a nie do osoby.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Dostępność",
      paragraphs: [
        "Informacje o dostępności zakwaterowania muszą być zgodne z rzeczywistością. Opisanie jako dostępnego zakwaterowania, które takie nie jest, stanowi zarazem naruszenie [Zasad dotyczących odpowiednich treści](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Gdy dostosowanie jest możliwe bez nieproporcjonalnego nakładu, oczekujemy, że dostawcy je wykonają.",
      ],
    },
    {
      id: "melden",
      heading: "5. Zgłaszanie dyskryminacji",
      paragraphs: [
        "Jeżeli doświadczyli lub zaobserwowali Państwo dyskryminację, prosimy zgłosić to przez funkcję zgłaszania albo kanałami kontaktu wskazanymi w [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).",
        "Badamy każde zgłoszenie. W razie potwierdzenia naruszenia podejmujemy środki aż do trwałego zablokowania konta. Jeżeli z tego powodu odmówiono Państwu rezerwacji, pomożemy znaleźć porównywalne zakwaterowanie.",
      ],
    },
  ],
};
