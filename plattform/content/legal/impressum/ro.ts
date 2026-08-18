import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Informații juridice",
  stand: "Actualizat: 18 august 2026",
  intro: [
    `Datele furnizorului pieței myBestDays. Operator este ${ANBIETER.firma}; myBestDays este o marcă a acestei societăți și nu o persoană juridică distinctă.`,
    "Informații obligatorii conform § 7 din Legea daneză privind comerțul electronic, care transpune articolul 5 din Directiva 2000/31/CE, și conform articolelor 11 și 12 din Regulamentul (UE) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operatorul Platformei",
      paragraphs: [
        `${ANBIETER.firma} — societate cu răspundere limitată (anpartsselskab, ApS) de drept danez`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danemarca`,
        `Reprezentare legală: ${ANBIETER.direktion.join(" și ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Contact",
      paragraphs: [
        `E-mail: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "În chestiuni privind o rezervare existentă utilizați funcția de mesaje din contul dumneavoastră — atunci dispunem deja de rezervare și de istoric; a se vedea [Plângeri și soluționarea litigiilor](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Registru și TVA",
      paragraphs: [
        `Nr. CVR ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danemarca.`,
        ...(ANBIETER.ustId
          ? [`Cod de înregistrare în scopuri de TVA: ${ANBIETER.ustId}.`]
          : [
              "În prezent nu există un cod de înregistrare în scopuri de TVA; § 7 din Legea privind comerțul electronic impune indicarea acestuia numai în cazul unei înregistrări existente în scopuri de TVA.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Puncte de contact conform Regulamentului (UE) 2022/2065",
      paragraphs: [
        `Punct unic de contact pentru autorități conform articolului 11 și pentru utilizatori conform articolului 12: ${ANBIETER.email}, prin poștă la adresa de mai sus.`,
        "Limbile de comunicare sunt germana, daneza și engleza.",
        "Procedurile prevăzute de acest regulament — semnalarea conținutului ilegal, motivarea măsurilor, tratarea plângerilor — sunt descrise în [Actul privind serviciile digitale](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Autorități competente",
      paragraphs: [
        `Coordonatorul serviciilor digitale conform articolului 49 din Regulamentul (UE) 2022/2065: ${DSA_KOORDINATOR.name}, Danemarca ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Autoritatea de supraveghere pentru protecția datelor: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danemarca, ${AUFSICHTSBEHOERDE.email}.`,
        "Intermedierea serviciilor de cazare nu necesită în Danemarca o autorizație specială; nu există, prin urmare, o autoritate sectorială de supraveghere.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Soluționarea litigiilor cu consumatorii",
      paragraphs: [
        "Platforma Comisiei Europene de soluționare online a litigiilor a fost abrogată prin Regulamentul (UE) 2024/3228 și și-a încetat activitatea.",
        "Nu suntem obligați și nici dispuși să participăm la o procedură de soluționare a litigiilor în fața unui organism de soluționare alternativă a litigiilor cu consumatorii.",
        `Independent de aceasta, în calitate de consumator vă puteți adresa organismului danez competent: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danemarca ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Dacă locuiți în alt stat membru, vă ajută Centrul European al Consumatorilor din țara dumneavoastră.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Observații privind conținutul și linkurile",
      paragraphs: [
        "Conținutul anunțurilor provine de la furnizorii respectivi. myBestDays nu și-l însușește; a se vedea secțiunea A4 din [Condițiile de utilizare](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Pentru conținutul paginilor terților către care se face trimitere răspunde operatorul acestora. Îndată ce luăm cunoștință de o încălcare a legii, eliminăm linkul fără întârziere.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Drepturi de autor",
      paragraphs: [
        `Conținutul propriu, textele, elementele grafice și mărcile publicate pe această Platformă sunt protejate de dreptul de autor și de dreptul mărcilor. Utilizarea dincolo de cazurile permise de lege necesită acordul scris prealabil al ${ANBIETER.firma}; pentru mărci se aplică [Regulile privind mărcile](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Legea aplicabilă",
      paragraphs: [
        `${ANBIETER.firma} are sediul în Danemarca și este stabilită exclusiv acolo. Prezentei oferte online i se aplică, prin urmare, dreptul danez — inclusiv versiunii în limba română (principiul țării de origine conform articolului 3 din Directiva 2000/31/CE). Dispozițiile imperative de protecție a consumatorilor din statul dumneavoastră de reședință nu sunt afectate.`,
      ],
    },
  ],
};
