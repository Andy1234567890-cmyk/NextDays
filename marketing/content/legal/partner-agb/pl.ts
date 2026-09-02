// Partner-AGB — Polnisch. Maschinell aus de.ts übersetzt (Gemini, juristischer Prompt,
// 02.09.2026), NICHT anwaltlich geprüft — ENTWURF wie die deutsche Fassung. Struktur und
// Platzhalter sind die der Quelldatei; inhaltliche Änderungen zuerst in de.ts, dann hier.
import type { LegalDoc } from "../types";

import { ANBIETER } from "../anbieter";

export const partnerAgb: LegalDoc = {
  slug: "partner/agb",
  metaDescription:
    "Warunki uczestnictwa w programie partnerskim myNextDays: Atrybucja, podstawa prowizji, poziomy, prowizja zespołowa, zakazy, identyfikacja, wypłata.",
  numbered: false,
  toc: true,
  title: "Warunki uczestnictwa w programie partnerskim (OWU Partnera) — Projekt",
  standIso: "2026-09-02",
  intro: [
    "PROJEKT — Niniejsze warunki stanowią roboczą wersję myNextDays i nie zostały jeszcze zweryfikowane prawnie. Do czasu zatwierdzenia zweryfikowanej wersji, stanowią one opis programu, a nie ostateczny tekst umowy. Zweryfikowana wersja zostanie opublikowana pod tym adresem z nowym numerem wersji; Partnerzy zostaną poproszeni o ponowne wyrażenie zgody przy następnym logowaniu.",
    `Niniejsze warunki uczestnictwa regulują udział w programie partnerskim (programie afiliacyjnym) firmy ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr} (zwanej dalej „myNextDays” lub „my”) przez Partnerów (zwanych dalej „Partnerami”).`,
    "Program partnerski skierowany jest do osób i firm z siedzibą w UE, Szwajcarii lub Wielkiej Brytanii, które polecają obiekty (wynajmujących, agencje, hotele) na myNextDays.",
  ],
  sections: [
    {
      heading: "§ 1 Uczestnictwo i zatwierdzenie",
      paragraphs: [
        "Uczestnictwo wymaga złożenia wniosku za pośrednictwem panelu Partnera. Obowiązkowe dane to nazwa lub firma, forma prawna, kraj, co najmniej jedno konto w mediach społecznościowych z adresem, nazwą użytkownika i zasięgiem, a w przypadku firm numer identyfikacji podatkowej VAT.",
        "myNextDays osobiście rozpatruje każdy wniosek i swobodnie decyduje o jego zatwierdzeniu. Nie ma prawa do przyjęcia. Udział jest bezpłatny; subskrypcja myNextDays nie jest warunkiem.",
        "Partner aktualizuje swoje dane, w szczególności kanały, formę prawną, dane podatkowe i dane do wypłat.",
        "Podany zasięg jest początkowo deklaracją własną. Partner może dobrowolnie połączyć swoje konta na YouTube, Instagramie, Facebooku i TikToku; wówczas liczba obserwujących i wyświetleń zostanie odczytana z platformy i oznaczona jako zweryfikowana. Niezweryfikowany zasięg będzie miał mniejszą wagę przy zatwierdzaniu i późniejszych weryfikacjach. Połączenie można w każdej chwili rozłączyć w panelu; szczegóły dotyczące przetwarzania znajdują się w polityce prywatności.",
      ],
    },
    {
      heading: "§ 2 Przypisanie obiektów (atrybucja)",
      paragraphs: [
        "Obiekt zostaje przypisany Partnerowi, jeśli zarejestruje się za pomocą kodu polecającego Partnera. Kod jest widocznie wyświetlany obiektowi podczas rejestracji i potwierdzany poprzez wysłanie. Pliki cookie śledzące nie są ustawiane.",
        "Obiekt jest przypisywany dokładnie jednemu Partnerowi; decydujący jest kod potwierdzony podczas rejestracji. Późniejsze przeklasyfikowanie następuje wyłącznie przez myNextDays w przypadku udowodnionego błędu.",
        "Nie są przypisywane obiekty należące do samego Partnera, jego wspólników, pracowników lub członków rodziny, a także obiekty, które są lub były już klientami myNextDays.",
      ],
    },
    {
      heading: "§ 3 Prowizja od własnych klientów",
      paragraphs: [
        "Podstawą prowizji jest netto obrót z abonamentu przypisanego obiektu (taryfa podstawowa i moduły) z opłaconych faktur — bez podatku VAT, bez prowizji portalowych, usług dodatkowych, dopłat i innych pozycji przejściowych.",
        "Stawka prowizji zależy od rangi Partnera w momencie płatności. Rangi i stawki są publikowane na stronie programu. Ranga jest ustalana na podstawie liczby płacących klientów w strukturze Partnera: jego własnych płacących klientów oraz płacących klientów jego Partnerów Zespołowych (§ 4), każdy klient raz. Ranga jest ustalana miesięcznie w dniu referencyjnym; awans obowiązuje natychmiast, degradacja dopiero wtedy, gdy liczba klientów spadła poniżej progu przez dwa kolejne dni referencyjne.",
        "Jeśli Partner po raz pierwszy osiągnie rangę od „Aufsteiger” wzwyż, otrzyma jednorazowo premię za awans, wskazaną dla tej rangi na stronie programu (obecnie 50,00 EUR za rangę, dla wszystkich Partnerów w euro). Każda ranga jest wynagradzana tylko raz, nawet po degradacji i ponownym awansie. Bonus podlega okresowi zwrotu zgodnie z § 7.",
        "Prowizja powstaje dla każdego przedsiębiorstwa na okres dwunastu miesięcy od daty pierwszej płatnej faktury abonamentowej; bezpłatny okres próbny i bezpłatny miesiąc uzyskane za pośrednictwem Partnera nie są wliczane. Jeśli abonament zakończy się wcześniej, prowizja kończy się wraz z ostatnią opłaconą fakturą.",
        "Od rangi „Elite-Partner” Partner otrzymuje dodatkowo superprowizję w wysokości wskazanej na stronie programu (obecnie 2,5%) od obrotu netto z abonamentów wszystkich klientów w jego strukturze — własnych klientów i klientów jego Partnerów Zespołowych — bez ograniczenia dwunastu miesięcy, tak długo, jak dany klient posiada płatny abonament, a Partner posiada tę rangę w momencie płatności. Powstaje ona obok prowizji zgodnie z ust. 2 i § 4.",
        "Za każdą rezerwację otrzymaną i opłaconą za pośrednictwem myBestDays dla obiektu przypisanego do Partnera lub jednego z jego Partnerów Zespołowych, Partner otrzymuje udział w rezerwacji w wysokości wskazanej na stronie programu (obecnie 0,5%) od kwoty rezerwacji zapłaconej przez gościa w walucie rezerwacji, bez ograniczeń czasowych, tak długo, jak trwa przypisanie. Kaucje nie są kwotą rezerwacji. Zwroty dla gościa proporcjonalnie zmniejszają udział (§ 7).",
      ],
    },
    {
      heading: "§ 4 Prowizja Zespołowa",
      paragraphs: [
        "Od rangi „Aufsteiger” Partner może prowadzić Partnerów Zespołowych. Jeśli inny Partner złoży wniosek za pośrednictwem linku zespołowego Partnera i widocznie potwierdzi jego kod w swoim wniosku, zostanie on przypisany do zespołu Partnera (dalej „Sponsor”) po zatwierdzeniu. Jeśli Sponsor nie posiada rangi w momencie składania wniosku, wniosek pozostaje ważny, ale nie powstaje przypisanie do zespołu.",
        "Sponsor otrzymuje prowizję zespołową od obrotu netto z abonamentów klientów swoich Partnerów Zespołowych w wysokości różnicy między jego własną stawką prowizji a stawką prowizji Partnera Zespołowego, każdorazowo zgodnie z rangą w momencie płatności. Jeśli obaj są w tej samej randze lub Partner Zespołowy jest wyżej, prowizja zespołowa nie powstaje. Prowizja Partnera Zespołowego i prowizja zespołowa Sponsora nigdy nie przekraczają łącznie najwyższej stawki w tabeli (obecnie 30%).",
        "Prowizja zespołu obejmuje dokładnie jeden poziom w głąb: Partnerzy zespołu nie otrzymują prowizji zespołu od partnerów, których sami pozyskali. Za pozyskanie partnera nie jest wypłacane żadne wynagrodzenie; opłata za uczestnictwo nie jest pobierana. Prowizja zespołu powstaje wyłącznie z opłaconego obrotu z subskrypcji.",
        "Prowizja zespołu dla każdego klienta zespołu trwa dwanaście miesięcy od daty jego pierwszej opłaconej faktury, podlega temu samemu okresowi zwrotu i jest proporcjonalnie cofana w przypadku zwrotu lub obciążenia zwrotnego (§ 7). Powstaje ona tylko tak długo, jak Sponsor i Partner zespołu są zatwierdzeni; w przeciwnym razie jest wstrzymywana do czasu wyjaśnienia.",
        "Przypisanie do zespołu jest jednorazowe. Zmiana następuje wyłącznie przez myNextDays z udokumentowanym powodem.",
      ],
    },
    {
      heading: "§ 5 Obowiązki Partnera i Oznaczenie",
      paragraphs: [
        "Partner oznacza każde polecenie swoim linkiem lub kodem jako reklamę — na początku wpisu, w języku wpisu, zgodnie z wymogami swojego kraju (w Niemczech m.in. § 5a ust. 4 UWG, w Danii markedsføringsloven § 6 ust. 4). myNextDays udostępnia sformułowania dla każdego kraju w panelu Partnera.",
        "Partner przekazuje myNextDays wyłącznie informacje zgodne z opublikowanymi opisami usług i nie składa żadnych obietnic w imieniu myNextDays. Zabronione są w szczególności obietnice sukcesu i gwarancji (np. „gwarantowane pełne obłożenie w trzy dni”) oraz oświadczenia dotyczące dochodów, które nie wynikają z opublikowanych opisów usług.",
        "Każde wideo i każdy wpis, który wspomina myNextDays lub zawiera link Partnera, jest przed publikacją przesyłany jako plik do panelu Partnera w celu weryfikacji. Link Partnera powstaje dopiero po pisemnym zatwierdzeniu przez myNextDays; publikacja bez zatwierdzenia jest zabroniona. myNextDays może cofnąć zatwierdzenie; już powstałe prowizje pozostają nienaruszone.",
        "Do logo, zrzutów ekranu, B-Roll, nakładek i zrzutów ekranu Partner używa wyłącznie materiałów reklamowych dostarczonych przez myNextDays. Własne, niezweryfikowane nagrania oprogramowania są niedozwolone.",
      ],
    },
    {
      heading: "§ 6 Zabronione praktyki",
      paragraphs: ["W szczególności zabronione są:"],
      list: [
        "Brand-Bidding: płatne reklamy marki „myNextDays”, wariantów pisowni i kombinacji (np. „myNextDays Ceny”) w wyszukiwarkach i sieciach;",
        "Cookie-Dropping, ukryte przekierowania, iFrames, automatyczne wywoływanie linku Partnera lub inne techniczne manipulacje przypisaniem;",
        "Samoreklama: rejestracja własnych firm, wspólników, pracowników lub członków rodziny za pośrednictwem własnego kodu lub kodu Partnera zespołu;",
        "zakupiony zasięg (kupieni obserwatorzy, farmy kliknięć, ruch botów) oraz zachęty dla firm do rejestracji (zwroty, prezenty, konkursy);",
        "Obietnice rekrutacyjne: pozyskiwanie partnerów z obietnicami zarobków, które nie pochodzą z opłaconego obrotu z subskrypcji, lub przedstawianie programu jako źródła dochodu poprzez pozyskiwanie kolejnych partnerów;",
        "Spam, niedozwolone reklamy bezpośrednie oraz wykorzystywanie cudzych znaków towarowych lub treści bez uprawnień.",
      ],
    },
    {
      heading: "§ 7 Okres zwrotu, wycofanie, wstrzymanie",
      paragraphs: [
        "Każda pozycja prowizji jest otwarta przez 30 dni od jej powstania (okres zwrotu), a następnie podlega wypłacie. Jeżeli rachunek bazowy zostanie w całości lub częściowo zwrócony lub obciążony zwrotnie (chargeback), prowizja – w tym prowizja zespołowa na niej oparta – zostanie proporcjonalnie wycofana, również po wypłacie, poprzez potrącenie z przyszłymi prowizjami.",
        "W przypadku podejrzenia naruszenia § 2, § 5 lub § 6, myNextDays może wstrzymać przypisania i prowizje do czasu wyjaśnienia. W przypadku potwierdzenia naruszenia, dotknięte prowizje przepadają.",
      ],
    },
    {
      heading: "§ 8 Wypłata i nota uznaniowa",
      paragraphs: [
        "Prowizje podlegające wypłacie są grupowane miesięcznie według waluty i wypłacane, gdy tylko osiągną minimalną kwotę danej waluty określoną na stronie programu lub w panelu kontrolnym. Nie następuje przeliczanie między walutami.",
        "Rozliczenie odbywa się w procedurze noty uznaniowej (samofakturowanie, momsloven § 52a): myNextDays wystawia notę uznaniową za każdą wypłatę; Partner nie wystawia faktury. Partner wyraża zgodę na procedurę noty uznaniowej.",
        "Przedsiębiorcy otrzymują notę uznaniową z informacją o odpowiedzialności podatkowej odbiorcy usługi (odwrotne obciążenie); warunkiem jest ważny, potwierdzony numer identyfikacji podatkowej VAT. Osoby prywatne otrzymują notę uznaniową bez VAT i samodzielnie opodatkowują prowizję.",
        "Wypłata następuje przelewem SEPA, Wise lub PayPal na dane podane przez Partnera w panelu kontrolnym.",
      ],
    },
    {
      heading: "§ 9 Dane i wgląd",
      paragraphs: [
        "Partner widzi przypisane obiekty pseudonimowo (numer, kraj, status, kwoty). Nazwy, adresy e-mail ani dane rezerwacji obiektów nie są ujawniane. Sponsor widzi dane swoich Partnerów Zespołowych: imię/nazwę firmy, rangę, liczbę płacących klientów i wynikającą z tego prowizję zespołową, bez szczegółów klientów.",
        "W odniesieniu do połączonych kont i utworzonych postów, myNextDays widzi obserwujących, wyświetlenia, interakcje oraz kliknięcia i klientów dla każdego postu. Nieprawidłowości (np. nagły wzrost liczby obserwujących bez odpowiednich wyświetleń lub znaczna rozbieżność między deklaracją własną a zweryfikowaną wartością) są wskazówkami do osobistej weryfikacji zgodnie z § 6 i § 10, a nie automatyczną blokadą.",
        "Przetwarzanie danych osobowych w programie partnerskim jest opisane w polityce prywatności.",
      ],
    },
    {
      heading: "§ 10 Czas trwania, blokada i wypowiedzenie",
      paragraphs: [
        "Uczestnictwo trwa bezterminowo i może zostać zakończone przez obie strony w dowolnym momencie w formie tekstowej. Już powstałe, podlegające wypłacie prowizje zostaną wypłacone zgodnie z § 8; po zakończeniu nie powstają nowe prowizje.",
        "myNextDays może zablokować Partnera w przypadku naruszenia niniejszych warunków. W czasie blokady prowizje są wstrzymywane; w przypadku potwierdzonego naruszenia przepadają.",
      ],
    },
    {
      heading: "§ 11 Zmiany",
      paragraphs: [
        "myNextDays może zmienić niniejsze warunki i poziomy ze skutkiem na przyszłość. Zmiany zostaną opublikowane w panelu partnera i na tej stronie z numerem wersji; w przypadku istotnych zmian partner zostanie poproszony o ponowne wyrażenie zgody. Już naliczone prowizje pozostają nienaruszone.",
      ],
    },
    {
      heading: "§ 12 Prawo właściwe",
      paragraphs: [
        "Obowiązuje prawo duńskie z wyłączeniem norm kolizyjnych. Obowiązujące przepisy o ochronie konsumentów państwa, w którym partner prywatny ma swoje zwykłe miejsce zamieszkania, pozostają nienaruszone.",
      ],
    },
  ],
};
