import {
  ANBIETER,
  AUFSICHTSBEHOERDE,
  DSA_KOORDINATOR,
  VERBRAUCHERSCHLICHTUNG,
} from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Juridiskā informācija",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    `Tirdzniecības vietas myBestDays pakalpojuma sniedzēja dati. Operators ir ${ANBIETER.firma}; myBestDays ir šīs sabiedrības preču zīme, nevis atsevišķa juridiska persona.`,
    "Obligātās norādes saskaņā ar Dānijas Elektroniskās tirdzniecības likuma 7. pantu, ar kuru transponēts Direktīvas 2000/31/EK 5. pants, un saskaņā ar Regulas (ES) 2022/2065 11. un 12. pantu.",
  ],
  sections: [
    {
      id: "betreiber",
      heading: "1. Platformas operators",
      paragraphs: [
        `${ANBIETER.firma} – sabiedrība ar ierobežotu atbildību (anpartsselskab, ApS) saskaņā ar Dānijas tiesībām`,
        `${ANBIETER.strasse}, ${ANBIETER.ort}, Dānija`,
        `Likumiskā pārstāvība: ${ANBIETER.direktion.join(" un ")} (direktører)`,
      ],
    },
    {
      id: "kontakt",
      heading: "2. Kontakti",
      paragraphs: [
        `E-pasts: ${ANBIETER.email}`,
        `Tālrunis: ${ANBIETER.telefon}`,
        "Jautājumos par esošu rezervāciju izmantojiet ziņojumu funkciju savā kontā – tad rezervācija un vēsture mums jau ir pieejama; sk. [Sūdzības un strīdu risināšana](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "register",
      heading: "3. Reģistrs un PVN",
      paragraphs: [
        `CVR Nr. ${ANBIETER.cvr}, Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dānija.`,
        ...(ANBIETER.ustId
          ? [`PVN maksātāja numurs: ${ANBIETER.ustId}.`]
          : [
              "PVN maksātāja numura pašlaik nav; Elektroniskās tirdzniecības likuma 7. pants prasa to norādīt tikai pastāvot PVN reģistrācijai.",
            ]),
      ],
    },
    {
      id: "kontaktstellen",
      heading: "4. Kontaktpunkti saskaņā ar Regulu (ES) 2022/2065",
      paragraphs: [
        `Vienotais kontaktpunkts iestādēm saskaņā ar 11. pantu un lietotājiem saskaņā ar 12. pantu: ${ANBIETER.email}, pa pastu uz iepriekš norādīto adresi.`,
        "Saziņas valodas ir vācu, dāņu un angļu.",
        "Procedūras saskaņā ar šo regulu – ziņošana par prettiesisku saturu, pasākumu pamatošana, sūdzību izskatīšana – aprakstītas sadaļā [Digitālo pakalpojumu akts](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
    {
      id: "aufsicht",
      heading: "5. Kompetentās iestādes",
      paragraphs: [
        `Digitālo pakalpojumu koordinators saskaņā ar Regulas (ES) 2022/2065 49. pantu: ${DSA_KOORDINATOR.name}, Dānija ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
        `Datu aizsardzības uzraudzības iestāde: ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dānija, ${AUFSICHTSBEHOERDE.email}.`,
        "Starpniecībai izmitināšanas pakalpojumos Dānijā nav nepieciešama īpaša atļauja; tāpēc nozares uzraudzības iestādes nav.",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "6. Patērētāju strīdu risināšana",
      paragraphs: [
        "Eiropas Komisijas strīdu izšķiršanas tiešsaistē platforma tika atcelta ar Regulu (ES) 2024/3228 un pārtrauca darbību.",
        "Mums nav pienākuma un mēs neesam gatavi piedalīties strīdu risināšanas procedūrā patērētāju strīdu alternatīvas risināšanas iestādē.",
        `Neatkarīgi no tā kā patērētājs varat vērsties kompetentajā Dānijas iestādē: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dānija ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ja dzīvojat citā dalībvalstī, Jums palīdz Jūsu valsts Eiropas Patērētāju centrs.`,
      ],
    },
    {
      id: "haftung-inhalte",
      heading: "7. Piezīmes par saturu un saitēm",
      paragraphs: [
        "Sludinājumu saturs nāk no attiecīgajiem sniedzējiem. myBestDays to nepiesavinās; sk. [Lietošanas noteikumu](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a4-unsere-plattform) A4 iedaļu.",
        "Par saistīto trešo pušu lapu saturu atbild to operators. Uzzinot par tiesību pārkāpumu, saiti nekavējoties noņemam.",
      ],
    },
    {
      id: "urheberrecht",
      heading: "8. Autortiesības",
      paragraphs: [
        `Šajā Platformā publicētais pašu saturs, teksti, grafika un preču zīmes ir aizsargāti ar autortiesībām un preču zīmju tiesībām. Izmantošanai, kas pārsniedz likumā atļautos gadījumus, nepieciešama ${ANBIETER.firma} iepriekšēja rakstiska piekrišana; preču zīmēm piemēro [Preču zīmju noteikumus](https://mybestdays.dk/rechtliches/markenzeichen).`,
      ],
    },
    {
      id: "anwendbares-recht",
      heading: "9. Piemērojamās tiesības",
      paragraphs: [
        `${ANBIETER.firma} juridiskā adrese ir Dānijā, un tā ir reģistrēta vienīgi tur. Tāpēc šim tiešsaistes piedāvājumam piemēro Dānijas tiesības – arī latviešu valodas versijai (izcelsmes valsts princips saskaņā ar Direktīvas 2000/31/EK 3. pantu). Imperatīvās Jūsu dzīvesvietas valsts patērētāju aizsardzības normas netiek skartas.`,
      ],
    },
  ],
};
