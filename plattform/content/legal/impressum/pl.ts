import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Informacje prawne",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    `Dane usługodawcy platformy handlowej myBestDays. Operatorem jest ${ANBIETER.firma}; myBestDays jest znakiem towarowym tej spółki, a nie odrębną osobą prawną.`,
    "Informacje obowiązkowe zgodnie z § 7 duńskiej ustawy o handlu elektronicznym, wdrażającej art. 5 dyrektywy 2000/31/WE, oraz zgodnie z art. 11 i 12 rozporządzenia (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operator platformy",
      paragraphs: [
        `${ANBIETER.firma} — spółka z ograniczoną odpowiedzialnością (anpartsselskab, ApS) prawa duńskiego`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Dania`,
        `Zarząd uprawniony do reprezentacji: ${ANBIETER.direktion.join(" i ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "W sprawach dotyczących istniejącej rezerwacji prosimy korzystać z funkcji wiadomości na koncie — dysponujemy wtedy już rezerwacją i historią; zob. [Reklamacje i rozstrzyganie sporów](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Rejestr i VAT",
      paragraphs: [
        `CVR nr ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dania.`,
        ...(ANBIETER.ustId
          ? [`Numer identyfikacyjny VAT: ${ANBIETER.ustId}.`]
          : [
              "Obecnie nie istnieje numer identyfikacyjny VAT; § 7 ustawy o handlu elektronicznym wymaga jego podania wyłącznie przy istniejącej rejestracji VAT.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Punkty kontaktowe zgodnie z rozporządzeniem (UE) 2022/2065",
      paragraphs: [
        `Pojedynczy punkt kontaktowy dla organów zgodnie z art. 11 i dla użytkowników zgodnie z art. 12: ${ANBIETER.email}, korespondencyjnie pod wskazanym wyżej adresem.`,
        "Językami komunikacji są niemiecki, duński i angielski.",
        "Procedury przewidziane w tym rozporządzeniu — zgłaszanie treści bezprawnych, uzasadnianie środków, rozpatrywanie reklamacji — opisano w [Akcie o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Właściwe organy",
      paragraphs: [
        `Koordynator ds. usług cyfrowych zgodnie z art. 49 rozporządzenia (UE) 2022/2065: ${DSA_KOORDINATOR.name}, Dania ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Organ nadzorczy ds. ochrony danych: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dania, ${AUFSICHTSBEHOERDE.email}.`,
        "Pośrednictwo w usługach noclegowych nie wymaga w Danii szczególnego zezwolenia; nie istnieje zatem branżowy organ nadzoru.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Rozstrzyganie sporów konsumenckich",
      paragraphs: [
        "Platforma internetowego rozstrzygania sporów Komisji Europejskiej została uchylona rozporządzeniem (UE) 2024/3228 i zakończyła działalność.",
        "Nie jesteśmy zobowiązani ani gotowi do udziału w postępowaniu przed organem pozasądowego rozstrzygania sporów konsumenckich.",
        `Niezależnie od tego jako konsument mogą Państwo zwrócić się do właściwego organu duńskiego: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dania ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jeżeli mieszkają Państwo w innym państwie członkowskim, pomocy udzieli Europejskie Centrum Konsumenckie w Państwa kraju.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Uwagi o treściach i odnośnikach",
      paragraphs: [
        "Treści ogłoszeń pochodzą od danych dostawców. myBestDays nie przyjmuje ich za własne; zob. sekcję A4 [Warunków korzystania](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Za treść stron osób trzecich, do których prowadzą odnośniki, odpowiada ich operator. Gdy powzięliśmy wiedzę o naruszeniu prawa, niezwłocznie usuwamy odnośnik.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Prawo autorskie",
      paragraphs: [
        `Publikowane na tej platformie własne treści, teksty, grafiki i znaki towarowe są chronione prawem autorskim i prawem znaków towarowych. Wykorzystanie poza przypadkami dozwolonymi ustawowo wymaga uprzedniej pisemnej zgody ${ANBIETER.firma}; do znaków towarowych stosuje się [Zasady dotyczące znaków towarowych](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Prawo właściwe",
      paragraphs: [
        `${ANBIETER.firma} ma siedzibę w Danii i wyłącznie tam prowadzi działalność. Do niniejszej oferty internetowej stosuje się zatem prawo duńskie — także do wersji polskojęzycznej (zasada państwa pochodzenia zgodnie z art. 3 dyrektywy 2000/31/WE). Bezwzględnie obowiązujące przepisy o ochronie konsumentów Państwa państwa zamieszkania pozostają nienaruszone.`,
      ],
    },
  ],
};
