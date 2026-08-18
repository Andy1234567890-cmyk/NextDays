import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zasady dotyczące odpowiednich treści",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsze zasady dotyczą wszystkich treści zamieszczanych przez użytkowników w myBestDays: ogłoszeń, zdjęć, opinii, wiadomości, danych profilu i odpowiedzi na opinie.",
    "Stanowią część [Warunków korzystania](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Naruszenie może skutkować usunięciem treści oraz środkami wobec konta.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Czego nie wolno",
      paragraphs: ["W myBestDays niedopuszczalne są w szczególności następujące treści:"],
      list: [
        "treści bezprawne wszelkiego rodzaju, w szczególności nawoływanie do przestępstw, treści terrorystyczne i materiały przedstawiające seksualne wykorzystywanie dzieci;",
        "treści nawołujące do nienawiści lub przemocy wobec osób lub grup ze względu na pochodzenie, kolor skóry, religię, światopogląd, płeć, tożsamość płciową, orientację seksualną, niepełnosprawność lub wiek;",
        "zniewagi, groźby, nękanie i celowe piętnowanie poszczególnych osób;",
        "dane osobowe osób trzecich bez ich zgody, w szczególności imiona i nazwiska, adresy, numery telefonów, dane dokumentów tożsamości lub dane płatnicze;",
        "wprowadzające w błąd informacje o zakwaterowaniu, jego położeniu, wyposażeniu, wielkości lub dostępności;",
        "cudze zdjęcia, teksty lub znaki towarowe bez niezbędnych praw;",
        "reklamy, spam i treści kierujące do innych kanałów rezerwacji poza platformą;",
        "złośliwe oprogramowanie, próby phishingu i odnośniki do takich treści;",
        "oferty czegokolwiek innego niż usługa noclegowa.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Zdjęcia",
      paragraphs: [
        "Zdjęcia muszą przedstawiać faktycznie oferowane zakwaterowanie i być wykonane w stanie odpowiadającym obecnemu.",
        "Zdjęcia nie mogą przedstawiać rozpoznawalnych osób bez ich zgody. Obróbka jest dopuszczalna, o ile nie zniekształca wrażenia o zakwaterowaniu — rozjaśnienie tak, wyretuszowany sąsiedni budynek nie.",
        "Monitoring wizyjny w zakwaterowaniu należy ujawnić w ogłoszeniu. W pomieszczeniach, w których goście mają uzasadnione oczekiwanie prywatności — sypialnie, łazienki — kamery są niedopuszczalne, także wyłączone.",
      ],
    },
    {
      id: "melden",
      heading: "3. Zgłaszanie treści",
      paragraphs: [
        "Jeżeli uważają Państwo treść za bezprawną lub sprzeczną z niniejszymi zasadami, mogą ją Państwo zgłosić przez funkcję zgłaszania dostępną przy każdym ogłoszeniu, każdej opinii i każdej wiadomości.",
        "Procedurę zgłaszania zgodnie z art. 16 rozporządzenia (UE) 2022/2065 oraz sposób rozpatrywania zgłoszeń opisano w [Akcie o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Jak egzekwujemy zasady",
      paragraphs: [
        "Badamy każdą zgłoszoną treść i wybieramy najłagodniejszy odpowiedni środek: pouczenie, usunięcie danej części, usunięcie całej treści, ograniczenie widoczności, zablokowanie funkcji albo zablokowanie konta.",
        "Naruszenia powtarzające się lub ciężkie mają większą wagę. W przypadku treści oczywiście bezprawnych lub zagrożenia dla osób działamy natychmiast.",
        "Każdy środek uzasadniamy wobec osoby, której dotyczy, i wskazujemy drogę reklamacyjną. Reklamację rozpatrują ludzie.",
      ],
    },
  ],
};
