import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Program partnerski",
  description: "Polecaj obiekty, buduj zespół i zarabiaj na przychodach z subskrypcji.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Jak to działa",
      articles: [
        {
          slug: "ueberblick",
          title: "Przegląd programu partnerskiego",
          excerpt: "Kto może wziąć udział, jak powstaje prowizja i co Państwo widzą.",
          updated: "Stan na: wrzesień 2026",
          body: [
            {
              type: "p",
              text: "Jako partner polecają Państwo myNextDays właścicielom obiektów, agencjom i hotelom. Jeśli obiekt zarejestruje się za pomocą Państwa kodu lub linku i opłaci swoje rachunki za subskrypcję, otrzymają Państwo udział w przychodach netto z subskrypcji przez dwanaście miesięcy. Poziomy w zależności od liczby płacących klientów są dostępne na stronie programu.",
            },
            { type: "h2", text: "Kto może zostać partnerem" },
            {
              type: "ul",
              items: [
                "Osoby fizyczne i firmy w UE, Szwajcarii lub Wielkiej Brytanii posiadające realny kanał dotarcia do gospodarzy: influencerzy, konsultanci, agencje, kancelarie podatkowe, stowarzyszenia.",
                "Również sami klienci myNextDays — subskrypcja nie jest warunkiem.",
                "Obowiązkowe w zgłoszeniu: co najmniej jedno konto w mediach społecznościowych (Instagram, TikTok, YouTube, Facebook, LinkedIn…) z adresem, nazwą użytkownika i zasięgiem. Strona internetowa lub newsletter mile widziane dodatkowo.",
              ],
            },
            { type: "h2", text: "Jak obiekt jest Państwu przypisywany" },
            {
              type: "steps",
              items: [
                "Udostępniają Państwo swój link (mynextdays.com/p/PAŃSTWA-KOD) lub swój kod.",
                "Obiekt widzi kod podczas rejestracji w polu „Polecone przez” i potwierdza go, wysyłając formularz — bez plików cookie.",
                "Dwanaście miesięcy rozpoczyna się od pierwszego opłaconego rachunku za subskrypcję.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Widzą Państwo swoich klientów anonimowo (Klient #1, #2…) z krajem, statusem i kwotami — nigdy imienia ani adresu e-mail. Obiekt jest przypisywany dokładnie jednemu partnerowi; pierwszy wygrywa.",
            },
            { type: "h2", text: "Co znajdą Państwo w panelu" },
            {
              type: "ul",
              items: [
                "Przegląd: ranking, kliknięcia, zarejestrowane i płacące obiekty, otwarte, do wypłaty i wypłacone prowizje.",
                "Prowizje: każdy opłacony rachunek za subskrypcję jako wiersz z podstawą, stawką, kwotą i statusem.",
                "Wypłaty: miesięcznie dla każdej waluty od minimalnej kwoty, z notą kredytową (self-billing) jako dowodem.",
                "Linki i materiały: Państwa kody, materiały promocyjne i obowiązkowe oznaczenia dla każdego kraju.",
                "Wiadomości: bezpośredni kontakt z zespołem partnerów.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Budowanie zespołu: prowizja zespołowa",
          excerpt: "Rekrutuj partnerów, którzy dołączą za pomocą Państwa kodu — i zarabiaj na przychodach ich klientów.",
          updated: "Stan na: wrzesień 2026",
          body: [
            {
              type: "p",
              text: "Mogą Państwo zapraszać innych partnerów do swojego zespołu. Jeśli ktoś złoży wniosek za pośrednictwem Państwa linku zespołowego (mynextdays.com/p/PAŃSTWA-KOD?team=1) i wyraźnie wpisze Państwa kod w zgłoszeniu, po zatwierdzeniu stanie się częścią Państwa zespołu. Otrzymają Państwo prowizję zespołową od przychodów netto z subskrypcji klientów Państwa partnerów zespołowych.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Stawka zespołowa zależy od PAŃSTWA rangi w momencie płatności — a nie od wielkości Państwa zespołu. Stawki są dostępne na stronie programu.",
                "Państwa ranga wynika wyłącznie z Państwa własnych płacących klientów. Klienci zespołowi nie liczą się do rangi.",
                "Dokładnie jeden poziom: Państwa partnerzy zespołowi nie budują własnego zespołu pod Państwem.",
                "Brak opłaty za uczestnictwo, brak pieniędzy za rekrutację partnera. Prowizja zespołowa powstaje wyłącznie z opłaconych przychodów z subskrypcji.",
                "Dwanaście miesięcy od pierwszej opłaconej faktury danego klienta zespołowego, 30-dniowe okno zwrotu, anulowanie w przypadku zwrotu lub obciążenia zwrotnego — tak jak w przypadku własnej prowizji.",
                "Prowizja zespołowa powstaje tylko, gdy Ty i Twój partner zespołowy zostaniecie zatwierdzeni; w przeciwnym razie zostanie wstrzymana.",
              ],
            },
            { type: "h2", text: "Ocena zespołu" },
            {
              type: "p",
              text: "W sekcji „Zespół” widzą Państwo każdego partnera zespołowego z jego rangą, płacącymi klientami, obrotami z subskrypcji jego klientów (30 dni i ogółem) oraz Państwa prowizją zespołową z tego tytułu — otwartą, do wypłaty, wypłaconą — a także historię ostatnich dwunastu miesięcy. Nie widzą Państwo szczegółów klientów swoich partnerów zespołowych; należą one do nich.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Poprzez „Zespół” mogą Państwo skontaktować się bezpośrednio z partnerami zespołowymi — a Państwa sponsor z Państwem.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ta sama domena e-mail lub to samo konto bankowe sponsora i partnera zespołowego zostaną oznaczone i sprawdzone przez zespół partnerów przed wypłatą prowizji zespołowej.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Wypłata, nota kredytowa i podatki",
          excerpt: "Kiedy prowizja staje się płatna, jak wygląda nota kredytowa i co obowiązuje w kwestiach podatkowych.",
          updated: "Stan na: wrzesień 2026",
          body: [
            {
              type: "steps",
              items: [
                "Wiersz prowizji powstaje wraz z opłaconą fakturą abonamentową i jest „otwarty” przez 30 dni (okno zwrotu).",
                "Następnie jest on płatny. Pierwszego dnia miesiąca grupujemy wszystkie płatne wiersze według waluty.",
                "Jeśli suma przekracza minimalną kwotę w Państwa walucie, powstaje wypłata z notą kredytową (self-billing). Nie muszą Państwo wystawiać faktury.",
                "Po przelewie wypłata widnieje jako „Zapłacona” z referencją w panelu kontrolnym.",
              ],
            },
            {
              type: "ul",
              items: [
                "Firmy: Nota kredytowa zawiera adnotację o odwrotnym obciążeniu; warunkiem jest potwierdzony numer VAT (sprawdzenie VIES).",
                "Osoby prywatne: Nota kredytowa nie wykazuje podatku VAT; prowizja podlega samodzielnemu opodatkowaniu.",
                "Wypłata za pośrednictwem SEPA, Wise lub PayPal — dane wprowadzają Państwo w profilu; zmiany wymagają Państwa hasła.",
                "Brak przeliczania: Prowizja w DKK jest wypłacana w DKK, prowizja w EUR w EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklama musi być rozpoznawalna jako reklama — na początku wpisu, w języku wpisu. Zatwierdzone sformułowania dla każdego kraju znajdą Państwo w sekcji „Linki i materiały”. Naruszenia mogą prowadzić do zablokowania konta.",
            },
          ],
        },
      ],
    },
  ],
};
