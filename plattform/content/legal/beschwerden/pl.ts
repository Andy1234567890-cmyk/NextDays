import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Reklamacje i rozstrzyganie sporów",
  stand: "Aktualizacja: 18 sierpnia 2026 r.",
  intro: [
    "Niniejsza strona opisuje, jak skontaktować się z myBestDays, jak rozpatrujemy reklamacje i jakie drogi pozostają Państwu otwarte, jeżeli nie zgadzają się Państwo z naszą decyzją.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Jak się z nami skontaktować",
      paragraphs: [
        "Najszybciej dotrą Państwo do nas przez centrum pomocy i wskazane tam kanały kontaktu. W przypadku istniejącej rezerwacji prosimy korzystać z funkcji wiadomości na koncie — dysponujemy wtedy już rezerwacją i historią.",
        `Pisemnie mogą Państwo dotrzeć do nas pod adresem ${ANBIETER.email} albo ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dania; telefonicznie pod numerem ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Co powinna zawierać reklamacja",
      paragraphs: ["Abyśmy mogli szybko pomóc, prosimy podać:"],
      list: [
        "numer rezerwacji i adres e-mail użyty do rezerwacji;",
        "krótki opis problemu;",
        "oczekiwane rozwiązanie;",
        "odpowiednie dowody — zdjęcia, wiadomości, paragony, wyciągi z rachunku.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Jak rozpatrujemy",
      paragraphs: [
        "Każda reklamacja jest rejestrowana i otrzymuje numer sprawy, pod którym mogą Państwo śledzić jej status.",
        "Niezwłocznie potwierdzamy wpływ i odpowiadamy merytorycznie z reguły w ciągu siedmiu dni. Jeżeli konieczna jest dłuższa analiza, informujemy o stanie pośrednim.",
        "Reklamacje, w których zagrożone są osoby albo zbliża się przyjazd, rozpatrujemy priorytetowo.",
        "Naszą decyzję uzasadniamy i wskazujemy podstawę, na której się opiera.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Reklamacja od zastosowanego przez nas środka",
      paragraphs: [
        "Jeżeli usunęliśmy treści, ograniczyliśmy ich widoczność, anulowaliśmy rezerwację albo zablokowaliśmy konto, mogą Państwo w terminie sześciu miesięcy złożyć bezpłatną reklamację. Odpowiada to art. 20 rozporządzenia (UE) 2022/2065.",
        "Reklamację badają ludzie, nie wyłącznie procedury automatyczne. Jeżeli okaże się zasadna, uchylamy środek.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Pozasądowe rozstrzyganie sporów",
      paragraphs: [
        "Platforma internetowego rozstrzygania sporów Komisji Europejskiej (platforma ODR) została uchylona rozporządzeniem (UE) 2024/3228 i zakończyła działalność. Tą drogą nie można już składać skarg.",
        "Nie jesteśmy zobowiązani ani gotowi do udziału w postępowaniu przed organem pozasądowego rozstrzygania sporów konsumenckich.",
        `Niezależnie od tego jako konsument mogą Państwo zwrócić się do właściwego organu duńskiego: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dania ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Jeżeli mieszkają Państwo w innym państwie członkowskim, pomocy udzieli Europejskie Centrum Konsumenckie w Państwa kraju.`,
        "Jeżeli spór dotyczy środka zastosowanego przez nas wobec Państwa treści lub konta, mogą Państwo dodatkowo zwrócić się do organu pozasądowego rozstrzygania sporów certyfikowanego zgodnie z art. 21 rozporządzenia (UE) 2022/2065. Jego decyzje nie są dla nas wiążące, a my nie jesteśmy zobowiązani do udziału w takich postępowaniach.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Droga sądowa",
      paragraphs: [
        "Droga sądowa pozostaje dla Państwa otwarta w każdej chwili, także bez uprzedniego postępowania reklamacyjnego. Właściwe sądy wskazano w sekcji A19 [Warunków korzystania](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Reklamacje dostawców",
      paragraphs: [
        "Dostawcy mogą tą samą drogą składać reklamacje dotyczące stosowania niniejszych warunków, decyzji o pozycjonowaniu oraz ograniczeń ich ogłoszenia. Odpowiada to art. 11 rozporządzenia (UE) 2019/1150.",
        "O liczbie, przedmiocie i średnim czasie rozpatrywania takich reklamacji informujemy corocznie; sprawozdanie dostępne jest w [Akcie o usługach cyfrowych](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
