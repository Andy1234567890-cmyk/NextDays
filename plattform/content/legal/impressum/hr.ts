import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pravne informacije",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    `Podaci o pružatelju tržišta myBestDays. Operator je ${ANBIETER.firma}; myBestDays je žig ovog društva, a ne zasebna pravna osoba.`,
    "Obvezni podaci prema § 7. danskog Zakona o elektroničkoj trgovini, koji prenosi članak 5. Direktive 2000/31/EZ, te prema člancima 11. i 12. Uredbe (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Operator Platforme",
      paragraphs: [
        `${ANBIETER.firma} — društvo s ograničenom odgovornošću (anpartsselskab, ApS) prema danskom pravu`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Danska`,
        `Zakonsko zastupanje: ${ANBIETER.direktion.join(" i ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakt",
      paragraphs: [
        `E-pošta: ${ANBIETER.email}`,
        `Telefon: ${ANBIETER.telefon}`,
        "U pitanjima koja se tiču postojeće rezervacije koristite funkciju poruka u svom računu — tada nam rezervacija i povijest već stoje na raspolaganju; vidi [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Registar i PDV",
      paragraphs: [
        `CVR br. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Danska.`,
        ...(ANBIETER.ustId
          ? [`PDV identifikacijski broj: ${ANBIETER.ustId}.`]
          : [
              "PDV identifikacijski broj trenutačno ne postoji; § 7. Zakona o elektroničkoj trgovini zahtijeva njegovo navođenje samo uz postojeću registraciju za PDV.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktne točke prema Uredbi (EU) 2022/2065",
      paragraphs: [
        `Jedinstvena kontaktna točka za tijela prema članku 11. i za korisnike prema članku 12.: ${ANBIETER.email}, poštom na gore navedenu adresu.`,
        "Jezici komunikacije su njemački, danski i engleski.",
        "Postupci prema toj uredbi — prijava protupravnog sadržaja, obrazloženje mjera, obrada pritužbi — opisani su u dijelu [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Nadležna tijela",
      paragraphs: [
        `Koordinator digitalnih usluga prema članku 49. Uredbe (EU) 2022/2065: ${DSA_KOORDINATOR.name}, Danska ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Nadzorno tijelo za zaštitu podataka: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Danska, ${AUFSICHTSBEHOERDE.email}.`,
        "Posredovanje usluga smještaja u Danskoj ne zahtijeva posebnu dozvolu; sektorsko nadzorno tijelo stoga ne postoji.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Rješavanje potrošačkih sporova",
      paragraphs: [
        "Platforma Europske komisije za internetsko rješavanje sporova stavljena je izvan snage Uredbom (EU) 2024/3228 i prestala je s radom.",
        "Nismo dužni niti spremni sudjelovati u postupku rješavanja sporova pred tijelom za alternativno rješavanje potrošačkih sporova.",
        `Neovisno o tome kao potrošač se možete obratiti nadležnom danskom tijelu: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danska ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ako živite u drugoj državi članici, pomaže Vam Europski potrošački centar u Vašoj zemlji.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Napomene o sadržaju i poveznicama",
      paragraphs: [
        "Sadržaj oglasa potječe od pojedinih pružatelja. myBestDays ga ne prisvaja; vidi odjeljak A4 [Uvjeta korištenja](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform).",
        "Za sadržaj povezanih stranica trećih strana odgovara njihov operator. Čim saznamo za povredu prava, poveznicu bez odgode uklanjamo.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Autorsko pravo",
      paragraphs: [
        `Vlastiti sadržaj, tekstovi, grafike i žigovi objavljeni na ovoj Platformi zaštićeni su autorskim i žigovnim pravom. Korištenje izvan zakonom dopuštenih slučajeva zahtijeva prethodni pisani pristanak društva ${ANBIETER.firma}; za žigove vrijede [Pravila o žigovima](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Mjerodavno pravo",
      paragraphs: [
        `${ANBIETER.firma} ima sjedište u Danskoj i ondje je isključivo poslovno nastanjeno. Na ovu internetsku ponudu stoga se primjenjuje dansko pravo — i na hrvatsku inačicu (načelo zemlje podrijetla prema članku 3. Direktive 2000/31/EZ). Prisilni propisi o zaštiti potrošača države Vašeg prebivališta ostaju nedirnuti.`,
      ],
    },
  ],
};
