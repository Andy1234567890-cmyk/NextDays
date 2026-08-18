import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pritužbe i rješavanje sporova",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "Ova stranica opisuje kako dosežete myBestDays, kako obrađujemo pritužbe i koji su Vam putovi otvoreni ako se s našom odlukom ne slažete.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Kako nas dosežete",
      paragraphs: [
        "Najbrže nas dosežete putem centra za pomoć i ondje navedenih kontaktnih putova. Za postojeću rezervaciju koristite funkciju poruka u svom računu — tada nam rezervacija i povijest već stoje na raspolaganju.",
        `Pisanim putem dosežete nas na ${ANBIETER.email} ili ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Danska; telefonom na ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Što bi Vaša pritužba trebala sadržavati",
      paragraphs: ["Kako bismo mogli brzo pomoći, molimo navedite:"],
      list: [
        "svoj broj rezervacije i adresu e-pošte korištenu za rezervaciju;",
        "kratak opis problema;",
        "koje rješenje želite;",
        "pripadajuće dokaze — fotografije, poruke, račune, izvatke računa.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Kako obrađujemo",
      paragraphs: [
        "Svaka se pritužba evidentira i dobiva broj predmeta pod kojim možete pratiti status.",
        "Primitak bez odgode potvrđujemo i sadržajno odgovaramo u pravilu u roku od sedam dana. Bude li potrebna dulja provjera, priopćavamo Vam međustanje.",
        "Pritužbe kod kojih su osobe ugrožene ili je dolazak neposredno predstojeći obrađujemo prioritetno.",
        "Svoju odluku obrazlažemo i navodimo osnovu na kojoj počiva.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Pritužba protiv naše mjere",
      paragraphs: [
        "Ako smo uklonili sadržaj, ograničili njegovu vidljivost, otkazali rezervaciju ili blokirali račun, protiv toga možete u roku od šest mjeseci besplatno podnijeti pritužbu. To odgovara članku 20. Uredbe (EU) 2022/2065.",
        "Pritužbu ispituju ljudi, a ne isključivo automatizirani postupci. Pokaže li se osnovanom, mjeru povlačimo.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Izvansudsko rješavanje sporova",
      paragraphs: [
        "Platforma Europske komisije za internetsko rješavanje sporova stavljena je izvan snage Uredbom (EU) 2024/3228 i prestala je s radom. Putem nje pritužbe se više ne mogu podnositi.",
        "Nismo dužni niti spremni sudjelovati u postupku rješavanja sporova pred tijelom za alternativno rješavanje potrošačkih sporova.",
        `Neovisno o tome kao potrošač se možete obratiti nadležnom danskom tijelu: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Danska ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ako živite u drugoj državi članici, pomaže Vam Europski potrošački centar u Vašoj zemlji.`,
        "Odnosi li se spor na mjeru koju smo poduzeli protiv Vašeg sadržaja ili računa, možete se dodatno obratiti tijelu za izvansudsko rješavanje sporova certificiranom prema članku 21. Uredbe (EU) 2022/2065. Njegove odluke za nas nisu obvezujuće i na sudjelovanje u takvim postupcima nismo obvezani.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Sudski put",
      paragraphs: [
        "Put do sudova stoji Vam otvoren u svakom trenutku, i bez prethodnog pritužbenog postupka. Koji su sudovi nadležni navedeno je u odjeljku A19 [Uvjeta korištenja](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand).",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Pritužbe pružatelja",
      paragraphs: [
        "Pružatelji mogu istim postupkom podnositi pritužbe o primjeni ovih uvjeta, o odlukama o rangiranju i o ograničenjima svoje ponude. To odgovara članku 11. Uredbe (EU) 2019/1150.",
        "O broju, predmetu i prosječnom trajanju obrade takvih pritužbi izvještavamo godišnje; izvješće je dostupno u dijelu [Akt o digitalnim uslugama](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
